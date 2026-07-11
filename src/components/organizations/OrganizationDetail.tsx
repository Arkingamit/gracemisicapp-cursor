
import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { useGroups } from '@/contexts/groups';
import { useAuth, authFetch } from '@/contexts/AuthContext';
import { Group, JoinRequest } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

import GroupForm from '../groups/GroupForm';
import InviteMemberForm from '@/components/organizations/InviteMemberForm';
import MusicianStatsPanel from '@/components/groups/MusicianStatsPanel';
import SongStatsPanel from '@/components/songs/SongStatsPanel';
import ManageInstrumentsPanel from '@/components/groups/ManageInstrumentsPanel';

import {
  Crown, UserPlus, Users, Shield, Trash2, Pencil, AlertTriangle,
  BarChart3, Settings, User, Mail, MoreVertical, Music, Plus, Check, X,
  LogIn, LogOut, Copy, ChevronDown, ChevronUp, Hash, UsersRound,
  BookOpen, TrendingUp, Layers, ArrowLeft,
} from 'lucide-react';
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

type ActiveTab = 'overview' | 'members' | 'song-sets' | 'stats';

const OrganizationDetail: React.FC<OrganizationDetailProps> = ({ id: propId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = propId || searchParams.get('id');
  const {
    getOrganization, deleteOrganization, addMemberToOrganization,
    removeMemberFromOrganization, assignManagerToOrganization,
    setOrgMemberRole, getOrganizationMembers, updateOrganization,
    getJoinRequests, approveJoinRequest, rejectJoinRequest,
  } = useOrganizations();
  const { getGroups, deleteGroup } = useGroups();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const organization = React.useMemo(() => id ? getOrganization(id) : undefined, [id, getOrganization]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
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
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  const [deleteOrgOpen, setDeleteOrgOpen] = useState(false);
  const [deleteOrgConfirmText, setDeleteOrgConfirmText] = useState('');
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteGroupConfirmText, setDeleteGroupConfirmText] = useState('');

  const isMember = React.useMemo(() => {
    if (!organization || !currentUser) return false;
    return organization.members.includes(currentUser.id);
  }, [organization, currentUser]);

  const isOrgEditor = React.useMemo(() => {
    if (!organization || !currentUser) return false;
    return organization.editorIds?.includes(currentUser.id);
  }, [organization, currentUser]);

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

  useEffect(() => {
    if (id) {
      const groupList = getGroups({ organizationId: id });
      setGroups(groupList);
    }
  }, [id, getGroups]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const memberList = await getOrganizationMembers(id);
      setMembers(memberList);
      router.refresh();
    } catch (error) {
      // Toast handled by context
    } finally {
      setAssigningManager(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'user' | 'editor' | 'manager') => {
    if (!id) return;
    try {
      await setOrgMemberRole(id, memberId, newRole);
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

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    try {
      await deleteGroup(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
      toast({ title: 'Song set deleted', description: `Successfully deleted "${groupName}"` });
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  const copyJoinCode = () => {
    if (organization?.joinCode) {
      navigator.clipboard.writeText(organization.joinCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Loading organization...</p>
        </div>
      </div>
    );
  }

  const visibleMembers = members.filter(m => m.role !== 'super_admin');
  const managers = visibleMembers.filter(m => m.isManager);
  const regularMembers = visibleMembers.filter(m => !m.isManager);

  const filteredGroups = groups.filter(group => {
    const q = groupSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const searchTokens = q.split(/\s+/).filter(Boolean);
    return searchTokens.every(token => 
      group.name.toLowerCase().includes(token)
    );
  });



  return (
    <div className="min-h-screen bg-transparent">
      {/* ─── HERO HEADER ─── */}
      <div className="relative border-b border-white/5 bg-zinc-900/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 pt-24 pb-6 md:pt-32 md:pb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Left: Org name + join code */}
            <div className="flex-1 min-w-0">
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
                    className="text-3xl md:text-4xl font-bold bg-transparent border-b-2 border-white/30 focus:border-white outline-none px-0 py-0 w-full text-white"
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
                <div className="flex items-start gap-3">
                  <h1 className="text-3xl md:text-4xl font-bold text-white truncate">{organization.name}</h1>
                  {canManage() && (
                    <button
                      onClick={() => { setEditNameValue(organization.name); setIsEditingName(true); }}
                      className="mt-1.5 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Join code pill */}
              {organization.joinCode && (
                <button
                  onClick={copyJoinCode}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-400 hover:text-white hover:border-white/20 transition-all group"
                >
                  <Hash className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono tracking-widest uppercase text-xs">{organization.joinCode}</span>
                  {codeCopied
                    ? <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    : <Copy className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  }
                  <span className="text-xs text-zinc-500">{codeCopied ? 'Copied!' : 'Join Code'}</span>
                </button>
              )}
            </div>

            {/* Right: Action buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {currentUser && !isMember && (
                <Button onClick={handleJoinOrganization} className="bg-white text-black hover:bg-zinc-200 gap-2">
                  <LogIn className="w-4 h-4" /> Join Organization
                </Button>
              )}
              {currentUser && isMember && !isManager() && !isSuperAdmin() && (
                <Button variant="outline" onClick={handleLeaveOrganization} className="border-red-800 text-red-400 hover:bg-red-950/40 gap-2">
                  <LogOut className="w-4 h-4" /> Leave
                </Button>
              )}
              {canManage() && (
                <>
                  <Button
                    variant="outline"
                    className="gap-2 border-white/10 hover:bg-white/5"
                    onClick={() => router.push('/songs/new')}
                  >
                    <Plus className="w-4 h-4" /> Add Song
                  </Button>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2 border-white/10 hover:bg-white/5">
                        <Settings className="w-4 h-4" /> Settings
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden">
                      <DialogHeader className="p-6 border-b border-white/5 bg-zinc-900/30">
                        <DialogTitle className="text-xl">Organization Settings</DialogTitle>
                      </DialogHeader>
                      <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
                        <div>
                          <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Musician Stats Visibility</label>
                          <Select
                            value={organization?.musicianStatsVisibility || 'all'}
                            onValueChange={async (value) => {
                              await updateOrganization(organization!.id, {
                                musicianStatsVisibility: value as 'all' | 'editors' | 'managers'
                              });
                            }}
                          >
                            <SelectTrigger className="w-full border-zinc-800 bg-zinc-900 text-zinc-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                              <SelectItem value="all">Everyone (All Members)</SelectItem>
                              <SelectItem value="editors">Editors & Managers Only</SelectItem>
                              <SelectItem value="managers">Managers Only</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-zinc-500 mt-1">Control who can view the detailed musician instrument statistics.</p>
                        </div>

                        <div className="pt-2 border-t border-white/5">
                          <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Stats Data Retention</label>
                          <p className="text-xs text-zinc-500 mb-2">Limit how far back stats panels fetch data.</p>
                          <Select
                            value={organization?.statsDataRetentionMonths === null ? 'infinite' : String(organization?.statsDataRetentionMonths || 'infinite')}
                            onValueChange={async (value) => {
                              const val = value === 'infinite' ? null : parseInt(value, 10);
                              await updateOrganization(organization!.id, { statsDataRetentionMonths: val });
                            }}
                          >
                            <SelectTrigger className="w-full border-zinc-800 bg-zinc-900 text-zinc-100">
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

                        <ManageInstrumentsPanel organization={organization} />

                        <div className="pt-4 border-t border-red-900/30">
                          <h3 className="text-sm font-medium text-red-400 mb-3">Danger Zone</h3>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" className="w-full">Delete Organization</Button>
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
                                <Button variant="destructive" onClick={handleDeleteOrganization}>Delete Organization</Button>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>

          {/* Stat pills */}
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-sm">
              <Users className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-300 font-medium">{visibleMembers.length}</span>
              <span className="text-zinc-500">members</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-sm">
              <Music className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-300 font-medium">{groups.length}</span>
              <span className="text-zinc-500">song sets</span>
            </div>
            {managers.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-sm">
                <Shield className="w-4 h-4 text-zinc-400" />
                <span className="text-zinc-500">{managers.map(m => m.name || m.username).join(', ')}</span>
              </div>
            )}
            {joinRequests.length > 0 && canManage() && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span className="text-amber-300 font-medium">{joinRequests.length}</span>
                <span className="text-amber-500/80">pending</span>
              </div>
            )}
          </div>
        </div>


      </div>

      {/* ─── TAB CONTENT ─── */}
      <div className="container mx-auto px-4 py-6 space-y-6">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick-action cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab('members')}
                className="group flex items-start gap-4 p-5 rounded-xl bg-zinc-900/50 border border-white/8 hover:border-white/15 hover:bg-zinc-900/80 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors shrink-0">
                  <Users className="w-5 h-5 text-zinc-300" />
                </div>
                <div>
                  <p className="font-semibold text-white">{visibleMembers.length} Members</p>
                  <p className="text-sm text-zinc-500 mt-0.5">{managers.length > 0 ? `${managers.length} manager${managers.length > 1 ? 's' : ''}` : 'No managers assigned'}</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('song-sets')}
                className="group flex items-start gap-4 p-5 rounded-xl bg-zinc-900/50 border border-white/8 hover:border-white/15 hover:bg-zinc-900/80 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors shrink-0">
                  <Music className="w-5 h-5 text-zinc-300" />
                </div>
                <div>
                  <p className="font-semibold text-white">{groups.length} Song Sets</p>
                  <p className="text-sm text-zinc-500 mt-0.5">Curated worship setlists</p>
                </div>
              </button>

              {canViewStats && (
                <button
                  onClick={() => setActiveTab('stats')}
                  className="group flex items-start gap-4 p-5 rounded-xl bg-zinc-900/50 border border-white/8 hover:border-white/15 hover:bg-zinc-900/80 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors shrink-0">
                    <TrendingUp className="w-5 h-5 text-zinc-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Statistics</p>
                    <p className="text-sm text-zinc-500 mt-0.5">Song usage & musician data</p>
                  </div>
                </button>
              )}
            </div>

            {/* Pending join requests */}
            {canManage() && joinRequests.length > 0 && (
              <div className="rounded-xl bg-amber-950/20 border border-amber-500/20 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-amber-500/10">
                  <UserPlus className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold text-amber-300">Pending Join Requests ({joinRequests.length})</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {joinRequests.map(request => (
                    <div key={request.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-5 py-4 gap-4">
                      <div>
                        <p className="font-medium text-zinc-200">{request.userName}</p>
                        <p className="text-sm text-zinc-500">{request.userEmail}</p>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button size="sm" variant="ghost" className="flex-1 sm:flex-none text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={() => handleRejectRequest(request.id)}>
                          <X className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button size="sm" className="flex-1 sm:flex-none bg-white/10 hover:bg-white/15 text-white border border-white/10" onClick={() => handleApproveRequest(request.id)}>
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent song sets preview */}
            {groups.length > 0 && (
              <div className="rounded-xl bg-zinc-900/40 border border-white/8 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-zinc-400" />
                    <h3 className="font-semibold text-zinc-200">Recent Song Sets</h3>
                  </div>
                  <button onClick={() => setActiveTab('song-sets')} className="text-sm text-zinc-500 hover:text-white transition-colors">View all →</button>
                </div>
                <div className="divide-y divide-white/5">
                  {groups.slice(0, 3).map(group => (
                    <button
                      key={group.id}
                      onClick={() => router.push(`/groups/view?id=${group.id}`)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <Music className="w-4 h-4 text-zinc-500" />
                        </div>
                        <span className="font-medium text-zinc-200">{group.name}</span>
                      </div>
                      <span className="text-zinc-600 text-sm">→</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Members preview */}
            {visibleMembers.length > 0 && (
              <div className="rounded-xl bg-zinc-900/40 border border-white/8 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-zinc-400" />
                    <h3 className="font-semibold text-zinc-200">Team</h3>
                  </div>
                  <button onClick={() => setActiveTab('members')} className="text-sm text-zinc-500 hover:text-white transition-colors">View all →</button>
                </div>
                <div className="px-5 py-4 flex flex-wrap gap-2">
                  {visibleMembers.slice(0, 8).map(member => (
                    <div key={member.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/70 border border-white/6 text-sm">
                      <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                        {(member.name || member.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-zinc-300 truncate max-w-[100px]">{member.name || member.username}</span>
                      {member.isManager && <Shield className="w-3 h-3 text-zinc-400 shrink-0" />}
                    </div>
                  ))}
                  {visibleMembers.length > 8 && (
                    <span className="flex items-center px-3 py-1.5 text-sm text-zinc-500">+{visibleMembers.length - 8} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MEMBERS TAB ── */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            <Button variant="ghost" className="text-zinc-400 hover:text-white -ml-4 -mb-2" onClick={() => setActiveTab('overview')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Overview
            </Button>
            {/* Add members (manager only) */}
            {canManage() && (
              <div className="rounded-xl bg-zinc-900/40 border border-white/8 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                  <UserPlus className="w-4 h-4 text-zinc-400" />
                  <h3 className="font-semibold text-zinc-200">Add Members</h3>
                </div>
                <div className="p-5">
                  <InviteMemberForm organizationId={id!} />
                </div>
              </div>
            )}

            {/* Pending requests */}
            {canManage() && joinRequests.length > 0 && (
              <div className="rounded-xl bg-amber-950/20 border border-amber-500/20 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-amber-500/10">
                  <UserPlus className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold text-amber-300">Pending Requests ({joinRequests.length})</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {joinRequests.map(request => (
                    <div key={request.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-5 py-4 gap-4">
                      <div>
                        <p className="font-medium text-zinc-200">{request.userName}</p>
                        <p className="text-sm text-zinc-500">{request.userEmail}</p>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button size="sm" variant="ghost" className="flex-1 sm:flex-none text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={() => handleRejectRequest(request.id)}>
                          <X className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button size="sm" className="flex-1 sm:flex-none bg-white/10 hover:bg-white/15 text-white border border-white/10" onClick={() => handleApproveRequest(request.id)}>
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Member list */}
            <div className="rounded-xl bg-zinc-900/40 border border-white/8 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-zinc-400" />
                  <h3 className="font-semibold text-zinc-200">All Members</h3>
                  <span className="text-xs text-zinc-600 ml-1">({visibleMembers.length})</span>
                </div>
              </div>
              {loadingMembers ? (
                <div className="px-5 py-8 text-center text-zinc-500 text-sm">Loading members...</div>
              ) : visibleMembers.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Users className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500">No members yet</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {visibleMembers.map(member => (
                    <div key={member.id} className="overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors text-left"
                        onClick={() => setExpandedMemberId(expandedMemberId === member.id ? null : member.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/8 flex items-center justify-center text-sm font-bold text-zinc-300 shrink-0">
                            {(member.name || member.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-200 truncate">{member.name || member.username}</p>
                            <p className="text-xs text-zinc-500 truncate">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {member.isManager && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/8 text-zinc-300 border border-white/10">
                              <Shield className="w-3 h-3" /> Manager
                            </span>
                          )}
                          {member.isEditor && !member.isManager && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/8">
                              <Pencil className="w-3 h-3" /> Editor
                            </span>
                          )}
                          {expandedMemberId === member.id
                            ? <ChevronUp className="w-4 h-4 text-zinc-600" />
                            : <ChevronDown className="w-4 h-4 text-zinc-600" />}
                        </div>
                      </button>

                      {expandedMemberId === member.id && (
                        <div className="px-5 pb-5 pt-1 bg-black/20 border-t border-white/5">
                          <div className="flex flex-col sm:flex-row gap-4 pt-2">
                            <div className="flex-1">
                              <label className="text-xs text-zinc-500 block mb-1 font-medium">Email</label>
                              <p className="text-sm text-zinc-300 break-all">{member.email}</p>
                            </div>
                            {canManage() && member.id !== currentUser?.id && (
                              <div className="flex flex-col gap-3 sm:items-end">
                                <div>
                                  <label className="text-xs text-zinc-500 block mb-1.5 font-medium">Role</label>
                                  <Select
                                    value={member.isManager ? 'manager' : member.isEditor ? 'editor' : 'user'}
                                    onValueChange={(value) => handleRoleChange(member.id, value as 'user' | 'editor' | 'manager')}
                                  >
                                    <SelectTrigger className="w-[160px] border-zinc-800 bg-zinc-900 text-zinc-100 h-8 text-sm">
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
                                  <Button variant="destructive" size="sm" className="text-xs h-8" onClick={() => handleRemoveMember(member.id)}>
                                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SONG SETS TAB ── */}
        {activeTab === 'song-sets' && (
          <div className="space-y-5">
            <Button variant="ghost" className="text-zinc-400 hover:text-white -ml-4 mb-1" onClick={() => setActiveTab('overview')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Overview
            </Button>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-zinc-200">Song Sets</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <Input
                  placeholder="Search song sets..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  className="w-full sm:w-[250px] bg-zinc-900 border-zinc-800 text-zinc-100"
                />
                {canManage() && (
                  <Button onClick={() => setShowGroupForm(!showGroupForm)} className="shrink-0 gap-2 bg-white/10 hover:bg-white/15 border border-white/10 text-white">
                    <Plus className="w-4 h-4" /> New Song Set
                  </Button>
                )}
              </div>
            </div>

            {showGroupForm && (
              <div className="rounded-xl bg-zinc-900/60 border border-white/8 p-5">
                <h3 className="text-base font-semibold text-zinc-200 mb-4">Create New Song Set</h3>
                <GroupForm
                  organizationId={id}
                  members={currentUser ? [currentUser.id] : []}
                  onClose={() => setShowGroupForm(false)}
                />
              </div>
            )}

            {groups.length === 0 ? (
              <div className="rounded-xl bg-zinc-900/30 border border-white/5 p-12 text-center">
                <Music className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-400 font-medium">No song sets yet</p>
                {canManage() && <p className="text-sm text-zinc-600 mt-1">Create a song set to get started</p>}
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="rounded-xl bg-zinc-900/30 border border-white/5 p-12 text-center">
                <Music className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-400 font-medium">No song sets found</p>
                <p className="text-sm text-zinc-600 mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGroups.map(group => (
                  <div
                    key={group.id}
                    className="group relative flex flex-col rounded-xl bg-zinc-900/50 border border-white/8 hover:border-white/15 overflow-hidden transition-all cursor-pointer"
                    onClick={() => router.push(`/groups/view?id=${group.id}`)}
                  >
                    <div className="p-5 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mb-3 shrink-0">
                          <Music className="w-5 h-5 text-zinc-400" />
                        </div>
                        {canManage() && (
                          <button
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteGroupConfirmText('');
                              setDeleteGroupTarget({ id: group.id, name: group.name });
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <h3 className="font-semibold text-zinc-100">{group.name}</h3>
                      <p className="text-xs text-zinc-500 mt-1">{(group as any).songs?.length || 0} songs</p>
                    </div>
                    <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs text-zinc-500">View set</span>
                      <span className="text-zinc-600 text-sm group-hover:text-zinc-400 transition-colors">→</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STATS TAB ── */}
        {activeTab === 'stats' && canViewStats && (
          <div className="space-y-6">
            <Button variant="ghost" className="text-zinc-400 hover:text-white -ml-4 -mb-2" onClick={() => setActiveTab('overview')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Overview
            </Button>
            <MusicianStatsPanel organizationId={id} />
            {(canManage() || isOrgEditor) && (
              <SongStatsPanel organizationId={id} />
            )}
          </div>
        )}
      </div>

      {/* ─── MODALS ─── */}
      <AlertDialog open={deleteOrgOpen} onOpenChange={setDeleteOrgOpen}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" /> Delete Organization
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 space-y-3">
              <p>This will permanently delete <span className="font-bold text-white">"{organization.name}"</span> and all its data. This action cannot be undone.</p>
              <p className="text-sm">Type <span className="font-mono font-bold text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded">confirm</span> below to proceed:</p>
              <Input
                placeholder='Type "confirm" here...'
                value={deleteOrgConfirmText}
                onChange={(e) => setDeleteOrgConfirmText(e.target.value)}
                className="mt-2 bg-zinc-900 border-zinc-800 text-zinc-100"
                autoFocus
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOrgConfirmText('')} className="border-zinc-800 hover:bg-zinc-800 text-zinc-300">Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteOrgConfirmText.toLowerCase() !== 'confirm'}
              onClick={async () => { setDeleteOrgOpen(false); setDeleteOrgConfirmText(''); await handleDeleteOrganization(); }}
            >
              Delete Organization
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteGroupTarget} onOpenChange={(open) => { if (!open) { setDeleteGroupTarget(null); setDeleteGroupConfirmText(''); } }}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" /> Delete Song Set
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 space-y-3">
              <p>This will permanently delete the song set <span className="font-bold text-white">"{deleteGroupTarget?.name}"</span>. This action cannot be undone.</p>
              <p className="text-sm">Type <span className="font-mono font-bold text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded">confirm</span> below to proceed:</p>
              <Input
                placeholder='Type "confirm" here...'
                value={deleteGroupConfirmText}
                onChange={(e) => setDeleteGroupConfirmText(e.target.value)}
                className="mt-2 bg-zinc-900 border-zinc-800 text-zinc-100"
                autoFocus
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteGroupTarget(null); setDeleteGroupConfirmText(''); }} className="border-zinc-800 hover:bg-zinc-800 text-zinc-300">Cancel</AlertDialogCancel>
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
