
import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { useGroups } from '@/contexts/groups';
import { useAuth, authFetch } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Group } from '@/lib/types';
import { Group, JoinRequest } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import GroupList from './GroupList';
import GroupForm from './GroupForm';
import InviteMemberForm from '@/components/InviteMemberForm';
import MusicianStatsPanel from '@/components/MusicianStatsPanel';
import SongStatsPanel from '@/components/SongStatsPanel';
import ManageInstrumentsPanel from '@/components/ManageInstrumentsPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Crown, UserPlus, Users, Shield, Trash2, Pencil, AlertTriangle, BarChart3, Settings, User, Mail, MoreVertical, Music, Plus, Check, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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
    getJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
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
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

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

  useEffect(() => {
    const loadRequests = async () => {
      if (id && canManage()) {
        setLoadingRequests(true);
        try {
          const reqs = await getJoinRequests(id);
          setJoinRequests(reqs);
        } catch (error) {
          console.error('Failed to load join requests:', error);
        } finally {
          setLoadingRequests(false);
        }
      }
    };
    loadRequests();
  }, [id, currentUser, organization]);

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

  const handleApproveRequest = async (requestId: string) => {
    if (!id) return;
    try {
      await approveJoinRequest(id, requestId);
      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
      // Refresh members
      const memberList = await getOrganizationMembers(id);
      setMembers(memberList);
    } catch (error) {
      console.error('Failed to approve request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!id) return;
    try {
      await rejectJoinRequest(id, requestId);
      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error) {
      console.error('Failed to reject request:', error);
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
    <div className="container mx-auto px-4 pt-20 md:pt-28 pb-8">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="w-full sm:w-auto">
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
                <div className="flex flex-col gap-1.5">
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
                  {organization.joinCode && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400 mt-1">
                      <span>Join Code:</span>
                      <code className="bg-zinc-900 px-2 py-1 rounded text-primary font-mono tracking-widest uppercase border border-zinc-800">
                        {organization.joinCode}
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-row w-full sm:w-auto gap-2">
              {currentUser && !isMember && (
                <Button className="flex-1 sm:flex-none sm:w-auto" onClick={handleJoinOrganization}>Join Organization</Button>
              )}
              {currentUser && isMember && !isManager() && !isSuperAdmin() && (
                <Button className="flex-1 sm:flex-none sm:w-auto" variant="destructive" onClick={handleLeaveOrganization}>
                  Leave Organization
                </Button>
              )}
              {canManage() && (
                <>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2 flex-1 sm:flex-none sm:w-auto justify-center sm:justify-start">
                        <Settings className="w-4 h-4" />
                        Settings
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden">
                      <DialogHeader className="p-6 border-b border-white/5 bg-zinc-900/30">
                        <DialogTitle className="text-xl">Organization Settings</DialogTitle>
                      </DialogHeader>
                      <div className="p-6 max-h-[80vh] overflow-y-auto">
                        <div className="grid gap-4 max-w-md">
                          <div>
                            <label className="text-sm font-medium text-zinc-300 mb-1 block">
                              Musician Stats Visibility
                            </label>
                            <Select
                              value={organization?.musicianStatsVisibility || 'all'}
                              onValueChange={async (value) => {
                                await updateOrganization(organization!.id, { 
                                  musicianStatsVisibility: value as 'all' | 'editors' | 'managers' 
                                });
                              }}
                            >
                              <SelectTrigger className="w-full border-zinc-800 bg-transparent text-zinc-100 focus:ring-1 focus:ring-primary focus:ring-offset-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectItem value="all">Everyone (All Members)</SelectItem>
                                <SelectItem value="editors">Editors & Managers Only</SelectItem>
                                <SelectItem value="managers">Managers Only</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-zinc-500 mt-1">
                              Control who can view the detailed musician instrument statistics.
                            </p>
                          </div>
                          
                          <div className="pt-2 border-t border-white/5 mt-4">
                            <label className="text-sm font-medium text-zinc-300 mb-1 block">
                              Maximum Visible Stats Period
                            </label>
                            <p className="text-xs text-muted-foreground mb-2">Limit how far back the Song Usage and Musician Stats panels fetch data.</p>
                            <Select
                              value={organization?.statsDataRetentionMonths === null ? 'infinite' : String(organization?.statsDataRetentionMonths || 'infinite')}
                              onValueChange={async (value) => {
                                const val = value === 'infinite' ? null : parseInt(value, 10);
                                await updateOrganization(organization!.id, { 
                                  statsDataRetentionMonths: val 
                                });
                              }}
                            >
                              <SelectTrigger className="w-full border-zinc-800 bg-transparent text-zinc-100 focus:ring-1 focus:ring-primary focus:ring-offset-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectItem value="infinite">Infinite (All Time)</SelectItem>
                                <SelectItem value="1">Last 1 Month</SelectItem>
                                <SelectItem value="3">Last 3 Months</SelectItem>
                                <SelectItem value="6">Last 6 Months</SelectItem>
                                <SelectItem value="12">Last 1 Year</SelectItem>
                                <SelectItem value="24">Last 2 Years</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <ManageInstrumentsPanel organization={organization} />
                        
                        <div className="pt-6 mt-6 border-t border-white/5">
                          <h3 className="text-sm font-medium text-red-400 mb-3">Danger Zone</h3>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" className="w-full">
                                Delete Organization
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                                <AlertDialogDescription className="text-zinc-400">
                                  Are you sure you want to delete {organization.name}? This action cannot be undone and will remove all members and song sets.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-zinc-800 hover:bg-zinc-800 hover:text-white">Cancel</AlertDialogCancel>
                                <Button variant="destructive" onClick={handleDeleteOrganization}>
                                  Delete Organization
                                </Button>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button variant="outline" className="gap-2 flex-1 sm:flex-none sm:w-auto justify-center sm:justify-start" onClick={() => router.push('/songs/new')}>
                    <Plus className="w-4 h-4" />
                    Add Songs
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Manager / Super admin: Add members */}
          {canManage() && (
            <Accordion type="single" collapsible className="mb-6 border border-zinc-800 rounded-xl bg-zinc-900/20 overflow-hidden">
              <AccordionItem value="add-members" className="border-none">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-zinc-800/30">
                  <h2 className="text-xl font-semibold flex items-center justify-center flex-1 gap-2">
                    <UserPlus className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-center">Add Members</span>
                  </h2>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  <InviteMemberForm organizationId={id!} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Manager: Pending Join Requests */}
          {canManage() && joinRequests.length > 0 && (
            <Accordion type="single" collapsible className="mb-6 border border-indigo-900/50 rounded-xl bg-indigo-950/10 overflow-hidden">
              <AccordionItem value="requests" className="border-none">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-indigo-900/20">
                  <h2 className="text-xl font-semibold flex items-center justify-center flex-1 gap-2 text-indigo-400">
                    <UserPlus className="w-5 h-5 shrink-0" />
                    <span className="text-center">Pending Requests ({joinRequests.length})</span>
                  </h2>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2 space-y-3">
                  {joinRequests.map(request => (
                    <div key={request.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-zinc-800 rounded-lg bg-zinc-950/50 gap-4">
                      <div>
                        <p className="font-medium text-zinc-200">{request.userName}</p>
                        <p className="text-sm text-zinc-400">{request.userEmail}</p>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="flex-1 sm:flex-none text-red-400 hover:text-red-300 hover:bg-red-950/30"
                          onClick={() => handleRejectRequest(request.id)}
                        >
                          <X className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 sm:flex-none bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/20"
                          onClick={() => handleApproveRequest(request.id)}
                        >
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* All members can see the members list */}
          {(isMember || canManage()) && (
            <Accordion type="single" collapsible className="mb-6 border border-zinc-800 rounded-xl bg-zinc-900/20 overflow-hidden">
              <AccordionItem value="members" className="border-none">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-zinc-800/30">
                  <h2 className="text-xl font-semibold flex items-center justify-center flex-1 gap-2">
                    <Users className="w-5 h-5 shrink-0" />
                    <span className="text-center">Members ({members.filter(m => m.role !== 'super_admin').length})</span>
                  </h2>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  {loadingMembers ? (
                    <p className="text-muted-foreground">Loading members...</p>
                  ) : members.filter(m => m.role !== 'super_admin').length > 0 ? (
                    <div className="relative border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/30">
                      <div className="px-4 py-3 bg-muted/50 border-b border-zinc-800 flex items-center text-sm font-medium">
                        <User className="w-4 h-4 mr-2" />
                        Name
                      </div>
                      <Accordion type="single" collapsible className="w-full">
                        {(() => {
                          const filtered = members.filter(member => member.role !== 'super_admin');
                          const INITIAL_LIMIT = 4;
                          const displayMembers = showAllMembers ? filtered : filtered.slice(0, INITIAL_LIMIT);
                          return (
                            <>
                              {displayMembers.map((member) => (
                                <AccordionItem value={member.id} key={member.id} className="border-b border-zinc-800/50 last:border-0">
                                  <AccordionTrigger hideIcon className="px-4 py-3 hover:no-underline hover:bg-zinc-900/50 transition-colors">
                                    <div className="flex items-center justify-between w-full">
                                      <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
                                        <span className="truncate text-base font-medium">{member.name || member.username}</span>
                                        {member.isManager && (
                                          <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] sm:text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
                                            <Shield className="w-3 h-3" /> <span className="hidden sm:inline">Manager</span>
                                          </span>
                                        )}
                                        {member.isEditor && !member.isManager && (
                                          <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] sm:text-xs bg-zinc-800/50 text-zinc-300 border border-zinc-700/50 px-2 py-0.5 rounded-full font-medium">
                                            <Pencil className="w-3 h-3" /> <span className="hidden sm:inline">Editor</span>
                                          </span>
                                        )}
                                      </div>
                                      <MoreVertical className="w-4 h-4 text-zinc-500 shrink-0" />
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="px-4 py-4 bg-black/20 border-t border-zinc-800/30">
                                    <div className="space-y-4">
                                      <div>
                                        <label className="text-xs text-zinc-500 block mb-1 font-medium">Email Address</label>
                                        <p className="text-sm text-zinc-300 break-all">{member.email}</p>
                                      </div>
                                      
                                      {canManage() && member.id !== currentUser?.id && (
                                        <div className="flex flex-col gap-3 pt-3 border-t border-zinc-800/50">
                                          <div>
                                            <label className="text-xs text-zinc-500 block mb-2 font-medium">Role</label>
                                            <Select
                                              value={member.isManager ? 'manager' : member.isEditor ? 'editor' : 'user'}
                                              onValueChange={(value) => handleRoleChange(member.id, value as 'user' | 'editor' | 'manager')}
                                            >
                                              <SelectTrigger className="w-full sm:w-[250px] border-zinc-800 bg-zinc-900 text-zinc-100 h-9">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                                <SelectItem value="user">User</SelectItem>
                                                <SelectItem value="editor">Editor</SelectItem>
                                                <SelectItem value="manager">Manager</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          
                                          {!member.isManager && (
                                            <div className="pt-2">
                                              <Button
                                                variant="destructive"
                                                size="sm"
                                                className="w-full sm:w-auto"
                                                onClick={() => handleRemoveMember(member.id)}
                                              >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Remove Member
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </>
                          );
                        })()}
                      </Accordion>
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
                    <div className="p-12 text-center border border-zinc-800 rounded-lg bg-zinc-950/50 flex flex-col items-center justify-center">
                      <Users className="w-12 h-12 text-zinc-800 mb-4" />
                      <p className="text-zinc-400 font-medium">No members yet</p>
                      {canManage() && <p className="text-sm text-zinc-500 mt-1">Add members using the form above</p>}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          <div className="mb-8 space-y-6">
            {canViewStats && (
              <MusicianStatsPanel organizationId={id} />
            )}
            
            {(canManage() || isOrgEditor) && (
              <SongStatsPanel organizationId={id} />
            )}
            

          </div>

          <Accordion type="single" collapsible className="mb-6 border border-zinc-800 rounded-xl bg-zinc-900/20 overflow-hidden">
            <AccordionItem value="song-sets" className="border-none">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-zinc-800/30">
                <h2 className="text-xl font-semibold flex items-center justify-center flex-1 gap-2">
                  <Music className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span className="text-center">Song Sets</span>
                </h2>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-2">
                <div className="flex justify-start mb-4">
                  {canManage() && (
                    <Button onClick={() => setShowGroupForm(true)} size="sm" className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
                      <Music className="w-4 h-4 mr-2" />
                      Create Song Set
                    </Button>
                  )}
                </div>

                {showGroupForm && (
                  <div className="mb-6 bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/60">
                    <h3 className="text-lg font-medium mb-4">Create New Song Set</h3>
                    <GroupForm
                      organizationId={id}
                      members={currentUser ? [currentUser.id] : []}
                      onClose={() => setShowGroupForm(false)}
                    />
                  </div>
                )}

                {groups.length > 0 ? (
                  <div className="grid gap-4">
                    {groups.map(group => (
                      <Card 
                        key={group.id} 
                        className="p-4 bg-zinc-950 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
                        onClick={() => router.push(`/groups/view?id=${group.id}`)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-medium">{group.name}</h3>
                          </div>
                          {canManage() && (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setDeleteGroupConfirmText(''); 
                                  setDeleteGroupTarget({ id: group.id, name: group.name }); 
                                }}
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
                  <div className="p-8 text-center border border-zinc-800/60 rounded-lg bg-zinc-950/30">
                    <Music className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-400 font-medium">No song sets yet</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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

