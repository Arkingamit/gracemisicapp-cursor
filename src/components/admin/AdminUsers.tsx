"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/contexts/AuthContext';
import { Filter, X, Trash2, ChevronDown } from 'lucide-react';
import { SYSTEM_ADMIN_EMAIL } from '@/lib/constants';
import { AdminResetPasswordModal } from '@/components/admin/AdminResetPasswordModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Loader2 } from 'lucide-react';
import { UserRole } from '@/lib/types';
import {
  ASSIGNABLE_SYSTEM_ROLES,
  hasAnyRole,
  normalizeRoles,
  sanitizeRolesInput,
} from '@/lib/roles';

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // User filter state
  const [userFilterName, setUserFilterName] = useState('');
  const [userFilterEmail, setUserFilterEmail] = useState('');
  const [userFilterRole, setUserFilterRole] = useState('all');
  const [userFilterGlobal, setUserFilterGlobal] = useState('all');

  // Delete User state
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Reset Password State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<{ id: string, name: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [usersRes, orgsRes] = await Promise.all([
        authFetch('/api/users?limit=1000'),
        authFetch('/api/organizations'),
      ]);

      if (usersRes.ok && orgsRes.ok) {
        const [usersData, orgsData] = await Promise.all([
          usersRes.json(),
          orgsRes.json()
        ]);
        setUsers(usersData.users || []);
        setOrganizations(orgsData.organizations || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getUserOrganizations = (userId: string) => {
    return organizations
      .filter(org => org.members.includes(userId) || org.managerId === userId || org.createdBy === userId)
      .map(org => ({
        name: org.name,
        role: (org.managerId === userId || org.createdBy === userId) ? 'Manager' : 'Member',
        id: org.id
      }));
  };

  const handleUpdateUserRoles = async (userId: string, nextRoles: UserRole[]) => {
    const roles = sanitizeRolesInput(nextRoles);
    try {
      const res = await authFetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ roles })
      });

      if (res.ok) {
        const data = await res.json();
        toast({ title: "Success", description: "User roles updated successfully" });
        setUsers(users.map(u => u.id === userId ? { ...u, ...data.user } : u));
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to update roles", variant: "destructive" });
      }
    } catch (error) {
      console.error('Failed to update user roles:', error);
      toast({ title: "Error", description: "Failed to update roles", variant: "destructive" });
    }
  };

  const toggleUserRole = (user: any, roleKey: UserRole, checked: boolean) => {
    if (user.email === SYSTEM_ADMIN_EMAIL) return;

    const current = normalizeRoles(user);

    if (roleKey === 'super_admin') {
      handleUpdateUserRoles(user.id, checked ? ['super_admin'] : ['user']);
      return;
    }

    // Leaving super_admin: start from empty capability set
    let next = current.filter((r) => r !== 'super_admin');

    if (checked) {
      next = Array.from(new Set([...next, roleKey]));
    } else {
      next = next.filter((r) => r !== roleKey);
    }

    if (next.length === 0) next = ['user'];
    handleUpdateUserRoles(user.id, next);
  };

  const handleModeration = async (userId: string, status: 'ok' | 'restricted') => {
    try {
      const res = await authFetch(`/api/users/${userId}/moderation`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          reason: status === 'restricted' ? 'Restricted by admin' : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Success',
          description: status === 'ok' ? 'Submission restriction cleared' : 'User restricted from submitting songs',
        });
        setUsers(users.map((u) => (u.id === userId ? { ...u, ...data.user } : u)));
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to update moderation', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'An error occurred', variant: 'destructive' });
    }
  };

  const handleUpdateUserLimit = async (userId: string, limitMB?: number) => {
    try {
      const res = await authFetch(`/api/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ aiChatLimitMB: limitMB })
      });

      if (res.ok) {
        toast({ title: "Success", description: "User chat limit updated" });
        const { user } = await res.json();
        setUsers(users.map(u => u.id === userId ? { ...u, aiChatLimitMB: user.aiChatLimitMB } : u));
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to update limit", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await authFetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast({ title: "Success", description: "User deleted successfully" });
        setUsers(users.filter(u => u.id !== userId));
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to delete user", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    } finally {
      setDeleteUserId(null);
      setDeleteConfirmOpen(false);
    }
  };

  const handleResetPassword = (userId: string, userName: string) => {
    setResetTargetUser({ id: userId, name: userName });
    setResetModalOpen(true);
  };

  const confirmResetPassword = async (adminPassword: string) => {
    if (!resetTargetUser) return;
    try {
      const res = await authFetch(`/api/users/${resetTargetUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ adminPassword })
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Success",
          description: `Password reset to '${data.temporaryPassword ?? 'the temporary password'}'`,
        });
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to reset password", variant: "destructive" });
        throw new Error(data.error);
      }
    } catch (error) {
      if (!(error instanceof Error && error.message)) {
        toast({ title: "Error", description: "An error occurred", variant: "destructive" });
      }
      throw error;
    }
  };

  if (loadingData && users.length === 0) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const filteredUsers = users.filter((user) => {
    if (userFilterName) {
      const name = (user.name || user.username || '').toLowerCase();
      if (!name.includes(userFilterName.toLowerCase())) return false;
    }
    if (userFilterEmail) {
      if (!user.email.toLowerCase().includes(userFilterEmail.toLowerCase())) return false;
    }
    if (userFilterRole !== 'all' && !normalizeRoles(user).includes(userFilterRole as UserRole)) return false;
    if (userFilterGlobal !== 'all') {
      const hasAccess = hasAnyRole(user, 'editor');
      if (userFilterGlobal === 'granted' && !hasAccess) return false;
      if (userFilterGlobal === 'no_access' && hasAccess) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>View all users and their organization memberships</CardDescription>
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
                value={userFilterName}
                onChange={(e) => setUserFilterName(e.target.value)}
                className="h-8 text-xs w-[140px] bg-transparent border-white/10"
              />
              <Input
                placeholder="Search email..."
                value={userFilterEmail}
                onChange={(e) => setUserFilterEmail(e.target.value)}
                className="h-8 text-xs w-[160px] bg-transparent border-white/10"
              />
              <select
                value={userFilterRole}
                onChange={(e) => setUserFilterRole(e.target.value)}
                className="h-8 text-xs rounded-md bg-transparent border border-white/10 px-2 text-zinc-300"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="editor">Editor</option>
                <option value="user">User</option>
              </select>
              <select
                value={userFilterGlobal}
                onChange={(e) => setUserFilterGlobal(e.target.value)}
                className="h-8 text-xs rounded-md bg-transparent border border-white/10 px-2 text-zinc-300"
              >
                <option value="all">Global Library: All</option>
                <option value="granted">Granted</option>
                <option value="no_access">No Access</option>
              </select>
              {(userFilterName || userFilterEmail || userFilterRole !== 'all' || userFilterGlobal !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-white px-2"
                  onClick={() => {
                    setUserFilterName('');
                    setUserFilterEmail('');
                    setUserFilterRole('all');
                    setUserFilterGlobal('all');
                  }}
                >
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground mb-2">
            Showing {filteredUsers.length} of {users.length} users
          </div>
          <div className="overflow-x-auto pb-4 scrollbar-hide">
            <table className="w-full text-sm min-w-[850px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">System Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground font-sans">Global Library</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground font-sans">Organizations & Roles</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const userOrgs = getUserOrganizations(user.id);
                  const userRoles = normalizeRoles(user);
                  const hasGlobalAccess = hasAnyRole(user, 'editor');
                  const isSystemAccount = user.email === SYSTEM_ADMIN_EMAIL;
                  return (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{user.name || user.username}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {user.email}
                        {isSystemAccount && (
                          <span className="block text-[8px] text-purple-500 font-bold uppercase tracking-tighter">System Account</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap gap-1">
                            {userRoles.map((r) => (
                              <span
                                key={r}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                                  r === 'super_admin'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    : r === 'editor'
                                      ? 'bg-blue-500/15 text-blue-400'
                                      : r === 'verifier'
                                        ? 'bg-emerald-500/15 text-emerald-400'
                                        : 'bg-secondary text-muted-foreground'
                                }`}
                              >
                                {r === 'super_admin' ? 'Super Admin' : r}
                              </span>
                            ))}
                          </div>
                          {user.moderationStatus === 'restricted' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400" title={user.moderationReason}>
                              Restricted
                            </span>
                          )}
                          {user.moderationStatus === 'flagged' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/15 text-orange-400" title={user.moderationReason}>
                              Flagged
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-sans">
                        {hasAnyRole(user, 'super_admin') ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium font-sans">
                            ✓ Full Access
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              if (hasGlobalAccess) {
                                const next = userRoles.filter((r) => r !== 'editor');
                                handleUpdateUserRoles(user.id, next.length ? next : ['user']);
                              } else {
                                handleUpdateUserRoles(
                                  user.id,
                                  Array.from(new Set([...userRoles.filter((r) => r !== 'super_admin'), 'editor']))
                                );
                              }
                            }}
                            disabled={isSystemAccount}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium font-sans transition-colors ${isSystemAccount
                              ? 'bg-green-500/10 text-green-500/50 cursor-not-allowed'
                              : hasGlobalAccess
                                ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20 cursor-pointer'
                                : 'bg-red-500/10 text-red-500 hover:bg-red-500/20 cursor-pointer'
                              }`}
                          >
                            {hasGlobalAccess ? '✓ Granted' : '✗ No Access'}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <div className="flex flex-wrap gap-1">
                          {userOrgs.length > 0 ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-sans rounded-full px-3 bg-secondary/50 hover:bg-secondary">
                                  View Roles ({userOrgs.length})
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[220px] font-sans">
                                <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Organizations</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {userOrgs.map((orgInfo: any) => (
                                  <DropdownMenuItem key={orgInfo.id} className="text-xs flex items-center justify-between py-2">
                                    <span className="flex items-center gap-2 font-medium">
                                      <span className="text-sm">{orgInfo.role === 'Manager' ? '👑' : '👤'}</span> {orgInfo.name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                                      {orgInfo.role}
                                    </span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-muted-foreground italic text-xs font-sans">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-8 text-xs gap-1.5 ${isSystemAccount ? 'opacity-50' : ''}`}
                                disabled={isSystemAccount || loadingData}
                              >
                                Assign roles
                                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[260px]">
                              <DropdownMenuLabel className="text-xs text-muted-foreground">
                                Select one or more roles
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {ASSIGNABLE_SYSTEM_ROLES.map((opt) => {
                                const checked = userRoles.includes(opt.key);
                                return (
                                  <DropdownMenuCheckboxItem
                                    key={opt.key}
                                    checked={checked}
                                    onCheckedChange={(v) => toggleUserRole(user, opt.key, !!v)}
                                    onSelect={(e) => e.preventDefault()}
                                    className="items-start py-2.5"
                                  >
                                    <div className="flex flex-col gap-0.5 pl-1">
                                      <span className="text-sm font-medium leading-none">{opt.label}</span>
                                      <span className="text-[10px] text-muted-foreground font-normal">
                                        {opt.description}
                                      </span>
                                    </div>
                                  </DropdownMenuCheckboxItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-0"
                            onClick={() => {
                              const val = window.prompt(`Enter custom AI Chat Limit in MB for ${user.name} (leave empty to use global default):`, user.aiChatLimitMB?.toString() || "");
                              if (val !== null) {
                                handleUpdateUserLimit(user.id, val ? parseInt(val) : undefined);
                              }
                            }}
                            disabled={user.email === SYSTEM_ADMIN_EMAIL || loadingData}
                          >
                            {user.aiChatLimitMB ? `${user.aiChatLimitMB}MB Limit` : 'Set Limit'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 border-0"
                            onClick={() => handleResetPassword(user.id, user.name || user.username)}
                            disabled={user.email === SYSTEM_ADMIN_EMAIL || loadingData}
                          >
                            Reset Pwd
                          </Button>

                          {user.email !== SYSTEM_ADMIN_EMAIL && (
                            user.moderationStatus === 'restricted' || user.moderationStatus === 'flagged' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] bg-green-500/10 text-green-500 hover:bg-green-500/20 border-0"
                                onClick={() => handleModeration(user.id, 'ok')}
                                disabled={loadingData}
                              >
                                Clear Flag
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border-0"
                                onClick={() => handleModeration(user.id, 'restricted')}
                                disabled={loadingData}
                              >
                                Restrict
                              </Button>
                            )
                          )}

                          {user.email !== SYSTEM_ADMIN_EMAIL && (
                            <AlertDialog open={deleteConfirmOpen && deleteUserId === user.id} onOpenChange={(open) => {
                              setDeleteConfirmOpen(open);
                              if (!open) setDeleteUserId(null);
                            }}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-0 transition-colors"
                                  onClick={() => setDeleteUserId(user.id)}
                                  disabled={loadingData}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent size="sm">
                                <AlertDialogHeader>
                                  <AlertDialogMedia className="bg-red-950/60 text-red-400">
                                    <Trash2 />
                                  </AlertDialogMedia>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the user <span className="font-bold text-white">"{user.name || user.username}"</span>.
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-red-500 hover:bg-red-600">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground italic">
                      {users.length === 0 ? 'No users found.' : 'No users match your filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      <AdminResetPasswordModal
        isOpen={resetModalOpen}
        onClose={() => {
          setResetModalOpen(false);
          setResetTargetUser(null);
        }}
        onConfirm={confirmResetPassword}
        targetUser={resetTargetUser}
      />
    </div>
  );
}
