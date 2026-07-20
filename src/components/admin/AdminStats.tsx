"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useSongs } from '@/contexts/SongContext';
import { authFetch } from '@/contexts/AuthContext';
import { AdminStats as AdminStatsType } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];

export default function AdminStats() {
  const { songs } = useSongs();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStatsType>({
    totalSongs: 0,
    totalUsers: 0,
    songsPerGenre: {},
    usersCount: 0,
    songsCount: 0,
    groupsCount: 0,
    organizationsCount: 0,
    recentlyAddedSongs: [],
    usersByRole: {}
  });

  const calculateGenreStats = useCallback((songList: any[]) => {
    const counts: Record<string, number> = {};
    songList.forEach(s => {
      const genres = Array.isArray(s.genre) ? s.genre : (s.genre ? [s.genre] : []);
      genres.forEach((g: string) => counts[g] = (counts[g] || 0) + 1);
    });
    return counts;
  }, []);

  const calculateRoleStats = useCallback((userList: any[]) => {
    const counts: Record<string, number> = {};
    userList.forEach(u => counts[u.role] = (counts[u.role] || 0) + 1);
    return counts;
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [usersRes, orgsRes, groupsRes] = await Promise.all([
          authFetch('/api/users?limit=1000'),
          authFetch('/api/organizations'),
          authFetch('/api/groups'),
        ]);

        if (usersRes.ok && orgsRes.ok && groupsRes.ok) {
          const [usersData, orgsData, groupsData] = await Promise.all([
            usersRes.json(),
            orgsRes.json(),
            groupsRes.json(),
          ]);

          setStats({
            totalSongs: songs.length,
            totalUsers: usersData.users.length,
            songsPerGenre: calculateGenreStats(songs),
            usersCount: usersData.users.length,
            songsCount: songs.length,
            groupsCount: groupsData.groups.length,
            organizationsCount: orgsData.organizations.length,
            recentlyAddedSongs: songs.slice(0, 5),
            usersByRole: calculateRoleStats(usersData.users)
          });
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [songs, calculateGenreStats, calculateRoleStats]);

  const genreChartData = Object.entries(stats.songsPerGenre).map(([name, value]) => ({
    name,
    value
  }));

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Songs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalSongs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.organizationsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Song Sets (Groups)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.groupsCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {genreChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Songs by Genre</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genreChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {genreChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {stats.usersByRole && Object.keys(stats.usersByRole).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Users by Role</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(stats.usersByRole).map(([name, value]) => ({ name, value }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {Object.entries(stats.usersByRole).map((entry, index) => (
                      <Cell key={`role-cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
