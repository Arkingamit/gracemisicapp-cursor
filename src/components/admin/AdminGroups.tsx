"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/contexts/AuthContext';
import { Filter, X, Loader2 } from 'lucide-react';

export default function AdminGroups() {
  const { toast } = useToast();
  
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Group filter state
  const [groupFilterName, setGroupFilterName] = useState('');
  const [groupFilterOrg, setGroupFilterOrg] = useState('');
  const [excludedOrgIds, setExcludedOrgIds] = useState<string[]>([]);
  const [groupFilterExcludeOrg, setGroupFilterExcludeOrg] = useState('');
  const [isExcludeOrgFocused, setIsExcludeOrgFocused] = useState(false);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [orgsRes, groupsRes] = await Promise.all([
        authFetch('/api/organizations'),
        authFetch('/api/groups')
      ]);

      if (orgsRes.ok && groupsRes.ok) {
        const [orgsData, groupsData] = await Promise.all([
          orgsRes.json(),
          groupsRes.json()
        ]);
        setOrganizations(orgsData.organizations || []);
        setGroups(groupsData.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch orgs and groups:', error);
      toast({ title: "Error", description: "Failed to load song sets", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getOrgName = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    return org ? org.name : 'Unknown';
  };

  const filteredGroups = groups.filter((group) => {
    if (groupFilterName && !group.name.toLowerCase().includes(groupFilterName.toLowerCase())) return false;
    if (groupFilterOrg) {
      const orgName = getOrgName(group.organizationId).toLowerCase();
      if (!orgName.includes(groupFilterOrg.toLowerCase())) return false;
    }
    if (excludedOrgIds.length > 0) {
      const isSystemGroup = !group.organizationId;
      if (isSystemGroup && excludedOrgIds.includes('_system')) {
        return false;
      }
      if (group.organizationId && excludedOrgIds.includes(group.organizationId)) {
        return false;
      }
    }
    return true;
  });

  if (loadingData && groups.length === 0) {
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
            <CardTitle>Song Sets (Groups)</CardTitle>
            <CardDescription>Overview of all song sets across organizations</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loadingData} className="w-full sm:w-auto">
            {loadingData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4 p-4 rounded-xl bg-zinc-900/50 border border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5" />
              Filters
            </div>
            <div className="flex flex-wrap gap-2 flex-1">
              <Input
                placeholder="Search set name..."
                value={groupFilterName}
                onChange={(e) => setGroupFilterName(e.target.value)}
                className="h-8 text-xs w-[160px] bg-transparent border-white/10"
              />
              <Input
                placeholder="Search organization..."
                value={groupFilterOrg}
                onChange={(e) => setGroupFilterOrg(e.target.value)}
                className="h-8 text-xs w-[160px] bg-transparent border-white/10"
              />
              <div className="relative">
                <Input
                  placeholder="Exclude organization..."
                  value={groupFilterExcludeOrg}
                  onChange={(e) => setGroupFilterExcludeOrg(e.target.value)}
                  onFocus={() => setIsExcludeOrgFocused(true)}
                  onBlur={() => setIsExcludeOrgFocused(false)}
                  className="h-8 text-xs w-[160px] bg-transparent border-red-500/20 focus-visible:ring-red-500/30"
                />
                {isExcludeOrgFocused && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border border-white/10 bg-zinc-950 p-1 text-white shadow-md">
                    {!excludedOrgIds.includes('_system') && (
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setExcludedOrgIds([...excludedOrgIds, '_system']);
                          setGroupFilterExcludeOrg('');
                        }}
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-zinc-900 focus:bg-zinc-900 text-white"
                      >
                        System / No Org
                      </div>
                    )}
                    {organizations
                      .filter(org =>
                        org.name.toLowerCase().includes(groupFilterExcludeOrg.toLowerCase()) &&
                        !excludedOrgIds.includes(org.id)
                      )
                      .map((org) => (
                        <div
                          key={org.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setExcludedOrgIds([...excludedOrgIds, org.id]);
                            setGroupFilterExcludeOrg('');
                          }}
                          className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-zinc-900 focus:bg-zinc-900 text-white"
                        >
                          {org.name}
                        </div>
                      ))}
                    {organizations.filter(org =>
                      org.name.toLowerCase().includes(groupFilterExcludeOrg.toLowerCase()) &&
                      !excludedOrgIds.includes(org.id)
                    ).length === 0 && (!groupFilterExcludeOrg || excludedOrgIds.includes('_system')) && (
                      <div className="p-2 text-[10px] text-muted-foreground italic">No options left</div>
                    )}
                  </div>
                )}
              </div>

              {(groupFilterName || groupFilterOrg || groupFilterExcludeOrg || excludedOrgIds.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-white px-2"
                  onClick={() => {
                    setGroupFilterName('');
                    setGroupFilterOrg('');
                    setGroupFilterExcludeOrg('');
                    setExcludedOrgIds([]);
                  }}
                >
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

          {excludedOrgIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4 p-3 rounded-xl bg-red-500/5 border border-red-500/10 items-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-400/80 mr-1 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Excluded:
              </span>
              {excludedOrgIds.map((id) => {
                const name = id === '_system' ? 'System / No Org' : getOrgName(id);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-transparent border border-red-500/20 text-red-300 shadow-sm"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => setExcludedOrgIds(excludedOrgIds.filter(x => x !== id))}
                      className="hover:text-red-100 text-red-500/80 hover:bg-white/5 rounded-full p-0.5 transition-colors focus:outline-none"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-xs text-muted-foreground mb-2">
            Showing {filteredGroups.length} of {groups.length} song sets
          </div>
          <div className="overflow-x-auto pb-4 scrollbar-hide">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Organization</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Songs</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((group) => (
                  <tr key={group.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{group.name}</td>
                    <td className="px-4 py-3">
                      {group.organizationId ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs">
                          {getOrgName(group.organizationId)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">System (No Org)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">{group.songIds?.length || 0}</td>
                  </tr>
                ))}
                {filteredGroups.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground italic">
                      {groups.length === 0 ? 'No song sets found.' : 'No song sets match your filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
