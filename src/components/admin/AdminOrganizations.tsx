"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/contexts/AuthContext';
import { Filter, X, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminOrganizations() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filters
  const [orgFilterName, setOrgFilterName] = useState('');
  const [orgFilterManager, setOrgFilterManager] = useState('');

  // Limits Modal
  const [orgLimitModalOpen, setOrgLimitModalOpen] = useState(false);
  const [orgLimitTarget, setOrgLimitTarget] = useState<any>(null);
  const [orgLimitForm, setOrgLimitForm] = useState({
    maxMembersLimit: '',
    maxSongsPerGroupLimit: '',
    maxCustomSongsLimit: ''
  });

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [orgsRes, usersRes, groupsRes] = await Promise.all([
        authFetch('/api/organizations'),
        authFetch('/api/users?limit=1000'),
        authFetch('/api/groups')
      ]);

      if (orgsRes.ok && usersRes.ok && groupsRes.ok) {
        const [orgsData, usersData, groupsData] = await Promise.all([
          orgsRes.json(),
          usersRes.json(),
          groupsRes.json()
        ]);
        setOrganizations(orgsData.organizations || []);
        setUsers(usersData.users || []);
        setGroups(groupsData.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch orgs:', error);
      toast({ title: "Error", description: "Failed to load organizations", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? (user.name || user.username) : 'Unknown';
  };

  const getOrgManagers = (org: any) => {
    if (org.managerIds && org.managerIds.length > 0) {
      return org.managerIds.map((id: string) => getUserName(id)).join(', ');
    }
    if (org.managerId) {
      return getUserName(org.managerId);
    }
    return 'Unknown';
  };

  const handleOpenOrgLimits = (org: any) => {
    setOrgLimitTarget(org);
    setOrgLimitForm({
      maxMembersLimit: org.maxMembersLimit?.toString() || '',
      maxSongsPerGroupLimit: org.maxSongsPerGroupLimit?.toString() || '',
      maxCustomSongsLimit: org.maxCustomSongsLimit?.toString() || ''
    });
    setOrgLimitModalOpen(true);
  };

  const handleSaveOrgLimits = async () => {
    if (!orgLimitTarget) return;
    
    try {
      const updates = {
        maxMembersLimit: orgLimitForm.maxMembersLimit ? parseInt(orgLimitForm.maxMembersLimit) : null,
        maxSongsPerGroupLimit: orgLimitForm.maxSongsPerGroupLimit ? parseInt(orgLimitForm.maxSongsPerGroupLimit) : null,
        maxCustomSongsLimit: orgLimitForm.maxCustomSongsLimit ? parseInt(orgLimitForm.maxCustomSongsLimit) : null,
      };

      const res = await authFetch(`/api/organizations/${orgLimitTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        toast({ title: "Success", description: "Organization limits updated" });
        const { organization } = await res.json();
        setOrganizations(organizations.map(o => o.id === organization.id ? organization : o));
        setOrgLimitModalOpen(false);
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to update limits", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    }
  };

  const filteredOrgs = organizations.filter((org) => {
    if (orgFilterName && !org.name.toLowerCase().includes(orgFilterName.toLowerCase())) return false;
    if (orgFilterManager) {
      const managerNames = getOrgManagers(org).toLowerCase();
      if (!managerNames.includes(orgFilterManager.toLowerCase())) return false;
    }
    return true;
  });

  if (loadingData && organizations.length === 0) {
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
            <CardTitle>Organizations</CardTitle>
            <CardDescription>Overview of all defined organizations</CardDescription>
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
                placeholder="Search name..."
                value={orgFilterName}
                onChange={(e) => setOrgFilterName(e.target.value)}
                className="h-8 text-xs w-[160px] bg-transparent border-white/10"
              />
              <Input
                placeholder="Search manager..."
                value={orgFilterManager}
                onChange={(e) => setOrgFilterManager(e.target.value)}
                className="h-8 text-xs w-[160px] bg-transparent border-white/10"
              />
              {(orgFilterName || orgFilterManager) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-white px-2"
                  onClick={() => {
                    setOrgFilterName('');
                    setOrgFilterManager('');
                  }}
                >
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground mb-2">
            Showing {filteredOrgs.length} of {organizations.length} organizations
          </div>
          <div className="overflow-x-auto pb-4 scrollbar-hide">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Manager</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Members</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Song Sets</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((org) => {
                  const orgGroups = groups.filter(g => g.organizationId === org.id);
                  return (
                    <tr key={org.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{org.name}</td>
                      <td className="px-4 py-3">{getOrgManagers(org)}</td>
                      <td className="px-4 py-3 text-center">{org.members?.length || 0}</td>
                      <td className="px-4 py-3 text-center">{orgGroups.length}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-0"
                            onClick={() => handleOpenOrgLimits(org)}
                            disabled={loadingData}
                          >
                            Set Limits
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/organizations/view?id=${org.id}`)}>
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrgs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                      {organizations.length === 0 ? 'No organizations found.' : 'No organizations match your filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={orgLimitModalOpen} onOpenChange={setOrgLimitModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Organization Limits</DialogTitle>
            <DialogDescription>
              Override global system limits for <span className="font-bold text-white">{orgLimitTarget?.name}</span>. Leave empty to use system defaults.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Max Members</Label>
              <Input
                type="number"
                placeholder="Global default"
                value={orgLimitForm.maxMembersLimit}
                onChange={(e) => setOrgLimitForm({ ...orgLimitForm, maxMembersLimit: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Song Sets</Label>
              <Input
                type="number"
                placeholder="Global default"
                value={orgLimitForm.maxSongsPerGroupLimit}
                onChange={(e) => setOrgLimitForm({ ...orgLimitForm, maxSongsPerGroupLimit: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Custom Songs</Label>
              <Input
                type="number"
                placeholder="Global default"
                value={orgLimitForm.maxCustomSongsLimit}
                onChange={(e) => setOrgLimitForm({ ...orgLimitForm, maxCustomSongsLimit: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrgLimitModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveOrgLimits}>Save Limits</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
