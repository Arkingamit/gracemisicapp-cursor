
import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { useGroups } from '@/contexts/groups';
import { useAuth, authFetch } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Group } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import GroupList from './GroupList';
import GroupForm from './GroupForm';
import InviteMemberForm from '@/components/InviteMemberForm';
import MusicianStatsPanel from '@/components/MusicianStatsPanel';
import SongStatsPanel from '@/components/SongStatsPanel';
import ManageInstrumentsPanel from '@/components/ManageInstrumentsPanel';
import { Crown, UserPlus, Users, Shield, Trash2, Pencil, AlertTriangle, BarChart3, Settings } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface OrgMember {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  isManager: boolean;
  isEditor: boolean;
}

interface OrganizationDetailProps {
  id: string;
}

const OrganizationDetail: React.FC<OrganizationDetailProps> = ({ id: propId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = propId || searchParams.get('id');
  const {
    getOrganization,
    deleteOrganization,
    addMemberToOrganization,
    removeMemberFromOrganization,
    assignManagerToOrganization,
    setOrgMemberRole,
    getOrganizationMembers,
    updateOrganization,
  } = useOrganizations();
  const { getGroups, deleteGroup } = useGroups();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const organization = React.useMemo(() => id ? getOrganization(id) : undefined, [id, getOrganization]);
  const [groups, setGroups] = useState<Group[]>([]);
  const isMember = React.useMemo(() => {
    if (!organization || !currentUser) return false;
    return organization.members.includes(currentUser.id);
  }, [organization, currentUser]);

  const isOrgEditor = React.useMemo(() => {
    if (!organization || !currentUser) return false;
    return organization.editorIds?.includes(currentUser.id);
  }, [organization, currentUser]);

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [managerEmail, setManagerEmail] = useState('');
  const [assigningManager, setAssigningManager] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [showAllMembers, setShowAllMembers] = useState(false);

  // Delete confirmation state
  const [deleteOrgOpen, setDeleteOrgOpen] = useState(false);
  const [deleteOrgConfirmText, setDeleteOrgConfirmText] = useState('');
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteGroupConfirmText, setDeleteGroupConfirmText] = useState('');

  useEffect(() => {
    if (id) {
      const groupList = getGroups({ organizationId: id });
      setGroups(groupList);
    }
  }, [id, getGroups]);

  // derived state isMember replaces this effect

  // Load members when organization is available and user is a member
  useEffect(() => {
    const loadMembers = async () => {
      if (id && organization && currentUser && (isMember || canManage())) {
        setLoadingMembers(true);
        try {
          const memberList = await getOrganizationMembers(id);
          setMembers(memberList);
        } catch (error) {
          console.error('Failed to load members:', error);
        } finally {
          setLoadingMembers(false);
        }
      }
    };
    loadMembers();
  }, [id, organization, currentUser]);

  const handleDeleteOrganization = async () => {
    try {
      if (id) {
        await deleteOrganization(id);
        router.push('/organizations');
      }
    } catch (error) {
      console.error('Failed to delete organization:', error);
    }
  };

  const handleJoinOrganization = async () => {
    if (id && currentUser) {
      try {
        await addMemberToOrganization(id, currentUser.id);
        toast({ title: 'Joined organization', description: `You are now a member of ${organization?.name}` });
      } catch (error) {
        console.error('Failed to join organization:', error);
      }
    }
  };

  const handleLeaveOrganization = async () => {
    if (id && currentUser) {
      try {
        await removeMemberFromOrganization(id, currentUser.id);
        toast({ title: 'Left organization', description: `You are no longer a member of ${organization?.name}` });
      } catch (error) {
        console.error('Failed to leave organization:', error);
      }
    }
  };

  const handleAssignManagerFromEmail = async (email: string) => {
    if (!email.trim() || !id) return;
    setAssigningManager(true);
    try {
      await assignManagerToOrganization(id, email.trim());
      setManagerEmail('');
      // Refresh members
      const memberList = await getOrganizationMembers(id);
      setMembers(memberList);
      router.refresh();
    } catch (error) {
      // Toast handled by context
    } finally {
      setAssigningManager(false);
    }
  };

  const handleAssignManager = () => handleAssignManagerFromEmail(managerEmail);

  const handleRoleChange = async (memberId: string, newRole: 'user' | 'editor' | 'manager') => {
    if (!id) return;
    try {
      await setOrgMemberRole(id, memberId, newRole);
      // Refresh members
      const memberList = await getOrganizationMembers(id);
      setMembers(memberList);
    } catch (error) {
      // Toast handled by context
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!id) return;
    if (window.confirm('Are you sure you want to remove this member?')) {
      try {
        await removeMemberFromOrganization(id, userId);
        setMembers(prev => prev.filter(m => m.id !== userId));
      } catch (error) {
        console.error('Failed to remove member:', error);
      }
    }
  };

  const isSuperAdmin = () => currentUser?.role === 'super_admin';
  const isManager = () => currentUser && organization ? organization.managerIds.includes(currentUser.id) : false;
  const canManage = () => {
    if (!currentUser || !organization) return false;
    return isSuperAdmin() || isManager();
  };

  const canViewStats = (() => {
    const visibility = organization?.musicianStatsVisibility || 'all';
    if (visibility === 'managers') return canManage();
    if (visibility === 'editors') return canManage() || isOrgEditor;
    return isMember || canManage();
  })();

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    try {
      await deleteGroup(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
      toast({ title: 'Song set deleted', description: `Successfully deleted "${groupName}"` });
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  if (!organization) {
    return <div>Loading organization...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
            <div>
              {isEditingName ? (
                <form 
                  className="flex items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (editNameValue.trim() && editNameValue !== organization.name) {
                      await updateOrganization(organization.id, { name: editNameValue.trim() });
                    }
                    setIsEditingName(false);
                  }}
                >
                  <input 
                    autoFocus
                    className="text-3xl font-bold bg-transparent border-b-2 border-primary/50 focus:border-primary outline-none focus:ring-0 px-0 py-0 w-full"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onBlur={async () => {
                      if (editNameValue.trim() && editNameValue !== organization.name) {
                        await updateOrganization(organization.id, { name: editNameValue.trim() });
                      }
                      setIsEditingName(false);
                    }}
                  />
                </form>
              ) : (
                <div 
                  className={`flex items-center gap-3 w-fit ${canManage() ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (canManage()) {
                      setEditNameValue(organization.name);
                      setIsEditingName(true);
                    }
                  }}
                >
                  <h1 className="text-3xl font-bold">{organization.name}</h1>
                  {canManage() && (
                    <Pencil className="w-5 h-5 text-zinc-500 hover:text-white transition-colors" />
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {currentUser && !isMember && (
                <Button onClick={handleJoinOrganization}>Join Organization</Button>
              )}
              {currentUser && isMember && !isManager() && !isSuperAdmin() && (
                <Button variant="destructive" onClick={handleLeaveOrganization}>
                  Leave Organization
                </Button>
              )}
              {canManage() && (
                <>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Settings className="w-4 h-4" />
                        Settings
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] bg-transparent border-zinc-800 text-zinc-100 p-0 overflow-hidden">
                      <DialogHeader className="p-6 border-b border-white/5 bg-zinc-900/30">
                        <DialogTitle className="text-xl">Organization Settings</DialogTitle>
                      </DialogHeader>
                      <div className="p-6 max-h-[80vh] overflow-y-auto">
                        <div className="grid gap-4 max-w-md">
                          <div>
                            <label className="text-sm font-medium text-zinc-300 mb-1 block">
                              Musician Stats Visibility
                            </label>
                            <select
                              className="w-full bg-transparent border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary"
                              value={organization?.musicianStatsVisibility || 'all'}
                              onChange={async (e) => {
                                await updateOrganization(organization!.id, { 
                                  musicianStatsVisibility: e.target.value as 'all' | 'editors' | 'managers' 
                                });
                              }}
                            >
                              <option value="all">Everyone (All Members)</option>
                              <option value="editors">Editors & Managers Only</option>
                              <option value="managers">Managers Only</option>
                            </select>
                            <p className="text-xs text-zinc-500 mt-1">
                              Control who can view the detailed musician instrument statistics.
                            </p>
                          </div>
                          
                          <div className="pt-2 border-t border-white/5 mt-4">
                            <label className="text-sm font-medium text-zinc-300 mb-1 block">
                              Maximum Visible Stats Period
                            </label>
                            <p className="text-xs text-muted-foreground mb-2">Limit how far back the Song Usage and Musician Stats panels fetch data.</p>
                            <select
                              className="w-full bg-transparent border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary"
                              value={organization?.statsDataRetentionMonths === null ? 'infinite' : String(organization?.statsDataRetentionMonths || 'infinite')}
                              onChange={async (e) => {
                                const val = e.target.value === 'infinite' ? null : parseInt(e.target.value, 10);
                                await updateOrganization(organization!.id, { 
                                  statsDataRetentionMonths: val 
                                });
                              }}
                            >
                              <option value="infinite">Infinite (All Time)</option>
                              <option value="1">Last 1 Month</option>
                              <option value="3">Last 3 Months</option>
                              <option value="6">Last 6 Months</option>
                              <option value="12">Last 1 Year</option>
                              <option value="24">Last 2 Years</option>
                            </select>
                          </div>
                        </div>
                        <ManageInstrumentsPanel organization={organization} />
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button variant="destructive" onClick={() => { setDeleteOrgConfirmText(''); setDeleteOrgOpen(true); }}>
                    Delete Organization
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Manager / Super admin: Add members */}
          {canManage() && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Add Members
              </h2>
              <InviteMemberForm organizationId={id!} />
            </div>
          )}

          {/* All members can see the members list */}
          {(isMember || canManage()) && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Members ({members.filter(m => m.role !== 'super_admin').length})
              </h2>
              {loadingMembers ? (
                <p className="text-muted-foreground">Loading members...</p>
              ) : members.length > 0 ? (
                <div className="relative border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50 whitespace-nowrap">
                          <th className="text-left px-4 py-2 text-sm font-medium">Name</th>
                          <th className="text-left px-4 py-2 text-sm font-medium">Email</th>
                          <th className="text-left px-4 py-2 text-sm font-medium">Org Role</th>
                          {canManage() && (
                            <th className="text-right px-4 py-2 text-sm font-medium">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                      {(() => {
                        const filtered = members.filter(member => member.role !== 'super_admin');
                        const INITIAL_LIMIT = 4;
                        const displayMembers = showAllMembers ? filtered : filtered.slice(0, INITIAL_LIMIT);
                        const hasMore = filtered.length > INITIAL_LIMIT;
                        return (
                          <>
                            {displayMembers.map((member) => (
                        <tr key={member.id} className="border-t whitespace-nowrap">
                          <td className="px-4 py-3 flex items-center gap-2">
                            {member.name || member.username}
                            {member.isManager && (
                              <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                                <Crown className="w-3 h-3" /> Manager
                              </span>
                            )}
                            {member.isEditor && !member.isManager && (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                                <Pencil className="w-3 h-3" /> Editor
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-sm">{member.email}</td>
                          <td className="px-4 py-3 text-sm capitalize">
                            {member.isManager ? 'Manager' : member.isEditor ? 'Editor' : 'User'}
                          </td>
                          {canManage() && (
                            <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                              {member.id !== currentUser?.id && (
                                <div className="flex gap-2 items-center">
                                  {/* Role Dropdown */}
                                  <select
                                    className="bg-background border rounded px-2 py-1 text-xs h-8 min-w-[100px]"
                                    value={member.isManager ? 'manager' : member.isEditor ? 'editor' : 'user'}
                                    onChange={(e) => handleRoleChange(member.id, e.target.value as 'user' | 'editor' | 'manager')}
                                  >
                                    <option value="user">User</option>
                                    <option value="editor">Editor</option>
                                    <option value="manager">Manager</option>
                                  </select>
                                </div>
                              )}
                              {!member.isManager && member.id !== currentUser?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive h-8 w-8 p-0"
                                  onClick={() => handleRemoveMember(member.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                      {hasMore && !showAllMembers && (
                        <tr>
                          <td colSpan={canManage() ? 4 : 3} className="h-0 p-0 border-0"></td>
                        </tr>
                      )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                  </div>
                  {/* Glassy fade overlay + View More */}
                  {(() => {
                    const filtered = members.filter(m => m.role !== 'super_admin');
                    const hasMore = filtered.length > 4;
                    if (!hasMore) return null;
                    return (
                      <>
                        {!showAllMembers && (
                          <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{
                            background: 'linear-gradient(to bottom, transparent, hsl(var(--card)) 90%)'
                          }} />
                        )}
                        <div className={`flex justify-center py-3 border-t border-white/5 ${!showAllMembers ? 'relative z-10' : ''}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary/80 text-xs font-medium gap-1.5 backdrop-blur-sm bg-white/5 hover:bg-white/10 rounded-full px-4"
                            onClick={() => setShowAllMembers(!showAllMembers)}
                          >
                            {showAllMembers ? '↑ Show Less' : `↓ View More (${filtered.length - 4} more)`}
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-muted-foreground">No members yet.</p>
              )}
            </div>
          )}

          <div className="mb-8 space-y-6">
            {canViewStats && (
              <MusicianStatsPanel organizationId={id} />
            )}
            
            {(canManage() || isOrgEditor) && (
              <SongStatsPanel organizationId={id} />
            )}
            

          </div>

          {showGroupForm && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Create New Song Set</h2>
              <GroupForm
                organizationId={id}
                members={currentUser ? [currentUser.id] : []}
                onClose={() => setShowGroupForm(false)}
              />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Song Sets</h2>
              {canManage() && (
                <Button onClick={() => setShowGroupForm(true)} size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Song Set
                </Button>
              )}
            </div>
            {groups.length > 0 ? (
              <div className="grid gap-4">
                {groups.map(group => (
                  <Card key={group.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium">{group.name}</h3>
                        <Button
                          variant="link"
                          onClick={() => router.push(`/groups/view?id=${group.id}`)}
                          className="p-0 h-auto mt-2 text-purple-600 hover:text-purple-700"
                        >
                          View Song Set
                        </Button>
                      </div>
                      {canManage() && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => { setDeleteGroupConfirmText(''); setDeleteGroupTarget({ id: group.id, name: group.name }); }}
                            title="Delete Song Set"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">No song sets in this organization yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Organization Confirmation Modal */}
      <AlertDialog open={deleteOrgOpen} onOpenChange={setDeleteOrgOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Organization
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will permanently delete <span className="font-bold text-foreground">"{organization.name}"</span> and all its data.
                This action cannot be undone.
              </p>
              <p className="text-sm">
                Type <span className="font-mono font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">confirm</span> below to proceed:
              </p>
              <Input
                placeholder='Type "confirm" here...'
                value={deleteOrgConfirmText}
                onChange={(e) => setDeleteOrgConfirmText(e.target.value)}
                className="mt-2"
                autoFocus
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOrgConfirmText('')}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteOrgConfirmText.toLowerCase() !== 'confirm'}
              onClick={async () => {
                setDeleteOrgOpen(false);
                setDeleteOrgConfirmText('');
                await handleDeleteOrganization();
              }}
            >
              Delete Organization
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Song Set Confirmation Modal */}
      <AlertDialog open={!!deleteGroupTarget} onOpenChange={(open) => { if (!open) { setDeleteGroupTarget(null); setDeleteGroupConfirmText(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Song Set
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will permanently delete the song set <span className="font-bold text-foreground">"{deleteGroupTarget?.name}"</span>.
                This action cannot be undone.
              </p>
              <p className="text-sm">
                Type <span className="font-mono font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">confirm</span> below to proceed:
              </p>
              <Input
                placeholder='Type "confirm" here...'
                value={deleteGroupConfirmText}
                onChange={(e) => setDeleteGroupConfirmText(e.target.value)}
                className="mt-2"
                autoFocus
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteGroupTarget(null); setDeleteGroupConfirmText(''); }}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteGroupConfirmText.toLowerCase() !== 'confirm'}
              onClick={async () => {
                if (deleteGroupTarget) {
                  const { id: gId, name: gName } = deleteGroupTarget;
                  setDeleteGroupTarget(null);
                  setDeleteGroupConfirmText('');
                  await handleDeleteGroup(gId, gName);
                }
              }}
            >
              Delete Song Set
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
export default OrganizationDetail;

