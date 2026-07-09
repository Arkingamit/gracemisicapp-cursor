import { NextRequest } from 'next/server';
import { getAuthUser, authError } from '@/lib/auth';
import { connectToDatabase } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth || auth.role !== 'super_admin') {
      return authError('Not authorized');
    }

    const db = await connectToDatabase();

    // Fetch organizations to build the org name map
    const orgsCursor = await db.collection(COLLECTIONS.ORGANIZATIONS).find({}).project({ _id: 1, name: 1 }).toArray();
    const orgMap: Record<string, string> = {
      '__global__': 'System / Global'
    };
    orgsCursor.forEach(org => {
      orgMap[org._id.toString()] = org.name;
    });

    const orgStatsMap: Record<string, { totalSize: number, count: number, modules: Record<string, { count: number, size: number }> }> = {};
    const initOrgStat = (orgId: string) => {
      if (!orgStatsMap[orgId]) {
        orgStatsMap[orgId] = { totalSize: 0, count: 0, modules: {} };
      }
    };

    const collectionNames = Object.values(COLLECTIONS);
    const collectionStats = await Promise.all(
      collectionNames.map(async (collectionName) => {
        try {
          const collection = db.collection(collectionName);
          let sizeResult: any[] = [];

          if (collectionName === COLLECTIONS.SONGS || collectionName === COLLECTIONS.GROUPS) {
            sizeResult = await collection.aggregate([
              {
                $group: {
                  _id: { $ifNull: ["$organizationId", "__global__"] },
                  totalSize: { $sum: { $bsonSize: '$$ROOT' } },
                  count: { $sum: 1 }
                }
              }
            ]).toArray();
          } else if (collectionName === COLLECTIONS.MESSAGES) {
            sizeResult = await collection.aggregate([
              {
                $lookup: {
                  from: COLLECTIONS.GROUPS,
                  let: { groupIdStr: "$groupId" },
                  pipeline: [
                    { $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$groupIdStr"] } } },
                    { $project: { organizationId: 1 } }
                  ],
                  as: "groupInfo"
                }
              },
              { $unwind: { path: "$groupInfo", preserveNullAndEmptyArrays: true } },
              {
                $group: {
                  _id: { $ifNull: ["$groupInfo.organizationId", "__global__"] },
                  totalSize: { $sum: { $bsonSize: '$$ROOT' } },
                  count: { $sum: 1 }
                }
              }
            ]).toArray();
          } else if (collectionName === COLLECTIONS.ORGANIZATIONS) {
            sizeResult = await collection.aggregate([
              {
                $group: {
                  _id: { $toString: "$_id" },
                  totalSize: { $sum: { $bsonSize: '$$ROOT' } },
                  count: { $sum: 1 }
                }
              }
            ]).toArray();
          } else {
            // System/Global collections (Users, AuditLogs, Settings, etc)
            sizeResult = await collection.aggregate([
              {
                $group: {
                  _id: "__global__",
                  totalSize: { $sum: { $bsonSize: '$$ROOT' } },
                  count: { $sum: 1 }
                }
              }
            ]).toArray();
          }

          let colTotalSize = 0;
          let colTotalCount = 0;

          sizeResult.forEach(res => {
            const orgId = res._id || "__global__";
            initOrgStat(orgId);
            
            orgStatsMap[orgId].totalSize += res.totalSize;
            orgStatsMap[orgId].count += res.count;
            orgStatsMap[orgId].modules[collectionName] = {
              count: res.count,
              size: res.totalSize
            };

            colTotalSize += res.totalSize;
            colTotalCount += res.count;
          });

          return {
            name: collectionName,
            count: colTotalCount,
            sizeKB: parseFloat((colTotalSize / 1024).toFixed(2)),
            avgObjSize: colTotalCount > 0 ? Math.round(colTotalSize / colTotalCount) : 0
          };
        } catch (e) {
          // Collection might not exist
          return { name: collectionName, count: 0, sizeKB: 0, avgObjSize: 0 };
        }
      })
    );

    // Calculate totals
    const totalDocuments = collectionStats.reduce((sum, c) => sum + c.count, 0);
    const totalDataSizeKB = collectionStats.reduce((sum, c) => sum + c.sizeKB, 0);

    // Format organizationStats
    const organizationStats = Object.entries(orgStatsMap).map(([orgId, stat]) => {
      const formattedModules: Record<string, { count: number, sizeKB: number }> = {};
      Object.entries(stat.modules).forEach(([modName, modStat]) => {
        formattedModules[modName] = {
          count: modStat.count,
          sizeKB: parseFloat((modStat.size / 1024).toFixed(2))
        };
      });

      return {
        orgId,
        orgName: orgMap[orgId] || 'Unknown Organization',
        totalSizeKB: parseFloat((stat.totalSize / 1024).toFixed(2)),
        totalDocuments: stat.count,
        modules: formattedModules
      };
    }).sort((a, b) => b.totalSizeKB - a.totalSizeKB);

    return Response.json({
      dbStats: {
        collections: collectionNames.length,
        objects: totalDocuments,
        avgObjSize: totalDocuments > 0 ? Math.round((totalDataSizeKB * 1024) / totalDocuments) : 0,
        dataSizeKB: parseFloat(totalDataSizeKB.toFixed(2)),
        storageSizeKB: parseFloat(totalDataSizeKB.toFixed(2))
      },
      collectionStats: collectionStats.sort((a, b) => b.sizeKB - a.sizeKB),
      organizationStats
    });
  } catch (error) {
    console.error('Admin storage stats error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

