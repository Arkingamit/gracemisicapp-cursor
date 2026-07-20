"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/contexts/AuthContext';
import { Search, X, ArrowUp, ArrowDown, ArrowUpDown, Loader2 } from 'lucide-react';

export default function AdminStorage() {
  const { toast } = useToast();
  
  const [storageStats, setStorageStats] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Storage org breakdown filter state
  const [storageOrgSearch, setStorageOrgSearch] = useState('');
  const [storageOrgSort, setStorageOrgSort] = useState<'name' | 'size' | 'date'>('size');
  const [storageOrgSortDir, setStorageOrgSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const storageRes = await authFetch('/api/admin/storage');

      if (storageRes.ok) {
        const data = await storageRes.json();
        setStorageStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch storage stats:', error);
      toast({ title: "Error", description: "Failed to load storage stats", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loadingData && !storageStats) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Database Storage</CardTitle>
            <CardDescription>Module-wise database storage consumption (in KB)</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loadingData} className="w-full sm:w-auto">
            {loadingData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {storageStats ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                <h3 className="text-lg font-bold mb-4 text-zinc-300">Overall Database Stats</h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-zinc-900 border border-white/5">
                      <span className="text-zinc-400">Total Collections</span>
                      <span className="font-bold">{storageStats.dbStats.collections}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-zinc-900 border border-white/5">
                      <span className="text-zinc-400">Total Documents</span>
                      <span className="font-bold">{storageStats.dbStats.objects}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-zinc-900 border border-white/5">
                      <span className="text-zinc-400">Data Size</span>
                      <span className="font-bold">{(storageStats.dbStats.dataSizeKB).toFixed(2)} KB</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-zinc-900 border border-white/5">
                      <span className="text-zinc-400">Storage Size (Allocated)</span>
                      <span className="font-bold text-orange-500">{(storageStats.dbStats.storageSizeKB).toFixed(2)} KB</span>
                    </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold mb-4 text-zinc-300">Module Segregation</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left py-2 font-semibold text-muted-foreground">Module</th>
                        <th className="text-right py-2 font-semibold text-muted-foreground">Documents</th>
                        <th className="text-right py-2 font-semibold text-muted-foreground">Size (KB)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storageStats.collectionStats.map((coll: any) => {
                        // For Songs, show org sub-rows
                        const isSongs = coll.name === 'songs';
                        let globalSongs = { count: 0, sizeKB: 0 };
                        const privateSongs = { count: 0, sizeKB: 0 };
                        if (isSongs && storageStats.organizationStats) {
                          storageStats.organizationStats.forEach((os: any) => {
                            if (os.modules?.songs) {
                              if (os.orgId === '__global__') {
                                globalSongs = { count: os.modules.songs.count, sizeKB: os.modules.songs.sizeKB };
                              } else {
                                privateSongs.count += os.modules.songs.count;
                                privateSongs.sizeKB += os.modules.songs.sizeKB;
                              }
                            }
                          });
                        }
                        const hasSongBreakdown = isSongs && (globalSongs.count > 0 || privateSongs.count > 0);
                        return (
                          <React.Fragment key={coll.name}>
                            <tr className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                              <td className="py-2 capitalize font-medium">{coll.name}</td>
                              <td className="py-2 text-right text-zinc-400">{coll.count}</td>
                              <td className="py-2 text-right text-orange-500 font-bold">{(coll.sizeKB).toFixed(1)}</td>
                            </tr>
                            {hasSongBreakdown && (
                              <>
                                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors bg-white/[0.02]">
                                  <td className="py-1.5 pl-6 text-xs text-zinc-500 flex items-center gap-1.5">
                                    <span className="text-zinc-700">└</span>
                                    Global Library
                                  </td>
                                  <td className="py-1.5 text-right text-xs text-zinc-500">{globalSongs.count}</td>
                                  <td className="py-1.5 text-right text-xs text-purple-400/70 font-medium">{globalSongs.sizeKB.toFixed(1)}</td>
                                </tr>
                                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors bg-white/[0.02]">
                                  <td className="py-1.5 pl-6 text-xs text-zinc-500 flex items-center gap-1.5">
                                    <span className="text-zinc-700">└</span>
                                    Private Library
                                    <span className="text-zinc-600 text-[10px]">({storageStats.organizationStats.filter((os: any) => os.orgId !== '__global__' && os.modules?.songs).length} orgs)</span>
                                  </td>
                                  <td className="py-1.5 text-right text-xs text-zinc-500">{privateSongs.count}</td>
                                  <td className="py-1.5 text-right text-xs text-purple-400/70 font-medium">{privateSongs.sizeKB.toFixed(1)}</td>
                                </tr>
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            {/* Organization Storage Breakdown */}
            {storageStats.organizationStats && storageStats.organizationStats.length > 0 && (
              <div className="mt-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-bold text-zinc-300">Organization Storage Breakdown</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <Input
                        placeholder="Search org..."
                        value={storageOrgSearch}
                        onChange={(e) => setStorageOrgSearch(e.target.value)}
                        className="pl-8 h-8 w-44 text-xs bg-zinc-900/60 border-white/10"
                      />
                      {storageOrgSearch && (
                        <button onClick={() => setStorageOrgSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {/* Sort buttons */}
                    {(['name', 'size'] as const).map((field) => {
                      const active = storageOrgSort === field;
                      return (
                        <Button
                          key={field}
                          variant={active ? 'secondary' : 'ghost'}
                          size="sm"
                          className={`h-8 text-xs gap-1 rounded-full px-3 ${
                            active
                              ? 'bg-orange-500/15 text-orange-500 border border-orange-500/20'
                              : 'text-zinc-400 hover:text-white border border-white/5'
                          }`}
                          onClick={() => {
                            if (active) {
                              setStorageOrgSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
                            } else {
                              setStorageOrgSort(field);
                              setStorageOrgSortDir(field === 'name' ? 'asc' : 'desc');
                            }
                          }}
                        >
                          {field === 'name' ? 'Name' : 'Size'}
                          {active ? (
                            storageOrgSortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {storageStats.organizationStats
                    .filter((orgStat: any) =>
                      orgStat.orgName.toLowerCase().includes(storageOrgSearch.toLowerCase())
                    )
                    .sort((a: any, b: any) => {
                      let cmp = 0;
                      if (storageOrgSort === 'name') {
                        cmp = a.orgName.localeCompare(b.orgName);
                      } else if (storageOrgSort === 'size') {
                        cmp = a.totalSizeKB - b.totalSizeKB;
                      }
                      return storageOrgSortDir === 'asc' ? cmp : -cmp;
                    })
                    .map((orgStat: any) => (
                    <div key={orgStat.orgId} className="bg-zinc-900/50 border border-white/5 rounded-xl p-5 hover:bg-zinc-900/80 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-white text-base">{orgStat.orgName}</h4>
                        <span className="text-xs font-bold text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                          {orgStat.totalSizeKB.toFixed(1)} KB
                        </span>
                      </div>
                      
                      <div className="space-y-2 mt-4">
                        {Object.entries(orgStat.modules).sort((a: any, b: any) => b[1].sizeKB - a[1].sizeKB).map(([modName, modStat]: [string, any]) => (
                          <div key={modName} className="flex justify-between items-center text-sm">
                            <span className="text-zinc-400 capitalize">{modName} <span className="text-zinc-600 text-xs ml-1">({modStat.count} items)</span></span>
                            <span className="text-zinc-300 font-medium">{modStat.sizeKB.toFixed(1)} KB</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {storageStats.organizationStats.filter((orgStat: any) =>
                  orgStat.orgName.toLowerCase().includes(storageOrgSearch.toLowerCase())
                ).length === 0 && (
                  <p className="text-center text-zinc-500 py-6 text-sm">No organizations match "{storageOrgSearch}"</p>
                )}
              </div>
            )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Loading storage stats...</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
