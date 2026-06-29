
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSongs } from '@/contexts/SongContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AdminStats } from '@/lib/types';
import AdminSongForm from '@/components/AdminSongForm';
import AdminSongList from '@/components/AdminSongList';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { AdminResetPasswordModal } from '@/components/AdminResetPasswordModal';
import { SYSTEM_ADMIN_EMAIL } from '@/lib/constants';
import { Trash2, ArrowUpDown, ArrowUp, ArrowDown, MessageSquare, ChevronDown, ChevronUp, ExternalLink, Smartphone, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authFetch } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Settings as SettingsIcon, ShieldCheck, Globe, Lock, Search, X, Filter, Plus } from 'lucide-react';


const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];

const LogObjectViewer = ({ obj }: { obj: any }) => {
  if (!obj || typeof obj !== 'object') return null;
  return (
    <div className="space-y-3">
      {Object.entries(obj).map(([key, value]) => {
        if (key === '_id' || key === 'updatedAt' || key === 'createdAt') return null;
        
        let displayValue = String(value);
        if (Array.isArray(value)) {
          displayValue = value.join(', ');
        } else if (typeof value === 'object' && value !== null) {
          displayValue = JSON.stringify(value);
        } else if (value === null) {
          displayValue = 'None';
        } else if (value === '') {
          displayValue = '(empty)';
        }

        const isLongText = typeof value === 'string' && value.length > 80;

        return (
          <div key={key} className="text-sm border-b border-white/5 pb-2 last:border-0">
            <span className="text-zinc-400 font-medium capitalize block sm:inline-block sm:w-32 mb-1 sm:mb-0">
              {key.replace(/([A-Z])/g, ' $1').trim()}:
            </span>
            {isLongText ? (
              <div className="mt-2 bg-zinc-900/50 p-3 rounded-lg border border-white/5">
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                  {displayValue}
                </pre>
              </div>
            ) : (
              <span className="text-zinc-100 font-medium">{displayValue}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const { songs } = useSongs();
  const router = useRouter();
  const { toast } = useToast();
  const [stats, setStats] = useState<AdminStats>({
    totalSongs: 0,
    totalUsers: 0,
    songsPerGenre: {},
    usersCount: 0,
    songsCount: 0,
    groupsCount: 0,
    organizationsCount: 0,
    recentlyAddedSongs: []
  });

  useEffect(() => {
    // Check if user is admin
    if (!currentUser || currentUser.role !== 'super_admin') {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page",
        variant: "destructive",
      });
      router.push('/');
      return;
    }
  }, [currentUser, router, toast]);

  const [users, setUsers] = useState<any[]>([]);

  const [organizations, setOrganizations] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<{ 
    allow_user_org_creation: boolean;
    enable_ai_chat: boolean;
    max_groups_per_user: number;
    max_custom_songs_per_org: number;
    global_ai_chat_limit_mb: number;
    max_songs_per_group?: number | null;
    max_members_per_org?: number | null;
    groq_api_key?: string;
    app_minimum_version?: string;
    app_latest_version?: string;
    app_update_url_android?: string;
    app_update_url_ios?: string;
    app_force_update_message?: string;
  }>({
    allow_user_org_creation: true,
    enable_ai_chat: true,
    max_groups_per_user: 20,
    max_custom_songs_per_org: 100,
    global_ai_chat_limit_mb: 2,
    max_songs_per_group: null,
    max_members_per_org: null,
    groq_api_key: '',
    app_minimum_version: '0.1.0',
    app_latest_version: '0.1.0',
    app_update_url_android: '',
    app_update_url_ios: '',
    app_force_update_message: ''
  });
  const [loadingData, setLoadingData] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [chatHistories, setChatHistories] = useState<any[]>([]);
  const [expandedChatUserId, setExpandedChatUserId] = useState<string | null>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  // Audit log filter state
  const [auditFilterUser, setAuditFilterUser] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('all');
  const [auditFilterModule, setAuditFilterModule] = useState('all');
  const [auditFilterItem, setAuditFilterItem] = useState('');
  const [auditFilterDateFrom, setAuditFilterDateFrom] = useState('');
  const [auditFilterDateTo, setAuditFilterDateTo] = useState('');
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>([]);
  const [auditFilterExcludeUser, setAuditFilterExcludeUser] = useState('');
  const [isExcludeUserFocused, setIsExcludeUserFocused] = useState(false);

  // User filter state
  const [userFilterName, setUserFilterName] = useState('');
  const [userFilterEmail, setUserFilterEmail] = useState('');
  const [userFilterRole, setUserFilterRole] = useState('all');
  const [userFilterGlobal, setUserFilterGlobal] = useState('all');

  // Organization filter state
  const [orgFilterName, setOrgFilterName] = useState('');
  const [orgFilterManager, setOrgFilterManager] = useState('');

  // Group filter state
  const [groupFilterName, setGroupFilterName] = useState('');
  const [groupFilterOrg, setGroupFilterOrg] = useState('');
  const [excludedOrgIds, setExcludedOrgIds] = useState<string[]>([]);
  const [groupFilterExcludeOrg, setGroupFilterExcludeOrg] = useState('');
  const [isExcludeOrgFocused, setIsExcludeOrgFocused] = useState(false);

  // Admin Reset Password State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<{ id: string, name: string } | null>(null);

  // Audit log details state
  const [selectedLogChanges, setSelectedLogChanges] = useState<any>(null);

  // Storage org breakdown filter state
  const [storageOrgSearch, setStorageOrgSearch] = useState('');
  const [storageOrgSort, setStorageOrgSort] = useState<'name' | 'size' | 'date'>('size');
  const [storageOrgSortDir, setStorageOrgSortDir] = useState<'asc' | 'desc'>('desc');

  // Genre management state
  const [genres, setGenres] = useState<any[]>([]);
  const [genreSearch, setGenreSearch] = useState('');
  const [newGenreName, setNewGenreName] = useState('');
  const [isSubmittingGenre, setIsSubmittingGenre] = useState(false);

  const filteredGenres = genres.filter(genre =>
    genre.name.toLowerCase().includes(genreSearch.toLowerCase())
  );


  const fetchAdminData = async () => {
    setLoadingData(true);
    try {
      const { authFetch } = await import('@/contexts/AuthContext');

      const [usersRes, orgsRes, groupsRes, settingsRes, auditRes, storageRes, genresRes, chatRes] = await Promise.all([
        authFetch('/api/users'),
        authFetch('/api/organizations'),
        authFetch('/api/groups'),
        fetch('/api/settings'),
        authFetch('/api/admin/audit-logs'),
        authFetch('/api/admin/storage'),
        authFetch('/api/genres'),
        authFetch('/api/admin/chat-histories')
      ]);

      if (usersRes.ok && orgsRes.ok && groupsRes.ok && settingsRes.ok) {
        const [usersData, orgsData, groupsData, settingsData] = await Promise.all([
          usersRes.json(),
          orgsRes.json(),
          groupsRes.json(),
          settingsRes.json()
        ]);

        if (auditRes.ok) {
          const data = await auditRes.json();
          setAuditLogs(data.logs || []);
        }
        if (storageRes.ok) {
          const data = await storageRes.json();
          setStorageStats(data);
        }
        if (genresRes.ok) {
          const data = await genresRes.json();
          setGenres(data);
        }
        if (chatRes.ok) {
          const data = await chatRes.json();
          setChatHistories(data.histories || []);
        }

        setUsers(usersData.users);
        setOrganizations(orgsData.organizations);
        setGroups(groupsData.groups);
        setSystemSettings(settingsData);

        // Update stats with live data
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
      console.error('Failed to fetch admin data:', error);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  const calculateGenreStats = (songList: any[]) => {
    const counts: Record<string, number> = {};
    songList.forEach(s => {
      const genres = Array.isArray(s.genre) ? s.genre : (s.genre ? [s.genre] : []);
      genres.forEach((g: string) => counts[g] = (counts[g] || 0) + 1);
    });
    return counts;
  };

  const calculateRoleStats = (userList: any[]) => {
    const counts: Record<string, number> = {};
    userList.forEach(u => counts[u.role] = (counts[u.role] || 0) + 1);
    return counts;
  };

  useEffect(() => {
    if (currentUser?.role === 'super_admin') {
      fetchAdminData();
    }
  }, [currentUser, songs]);

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      const res = await authFetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      });

      if (res.ok) {
        toast({ title: "Success", description: "User role updated successfully" });
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to update role", variant: "destructive" });
      }
    } catch (error) {
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

  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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

  const handleUpdateSettings = async (updates: any) => {
    try {
      const res = await authFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        const data = await res.json();
        setSystemSettings(data);
        toast({ title: "Success", description: "Settings updated successfully" });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Error", description: `Failed to update settings: ${err.error || res.statusText}`, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    }
  };

  const handleResetPassword = (userId: string, userName: string) => {
    setResetTargetUser({ id: userId, name: userName });
    setResetModalOpen(true);
  };

  const [orgLimitModalOpen, setOrgLimitModalOpen] = useState(false);
  const [orgLimitTarget, setOrgLimitTarget] = useState<any>(null);
  const [orgLimitForm, setOrgLimitForm] = useState({
    maxMembersLimit: '',
    maxSongsPerGroupLimit: '',
    maxCustomSongsLimit: ''
  });

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

  const confirmResetPassword = async (adminPassword: string) => {
    if (!resetTargetUser) return;

    setLoadingData(true);
    try {
      const res = await authFetch(`/api/users/${resetTargetUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ adminPassword })
      });

      if (res.ok) {
        toast({ title: "Success", description: "Password reset to 'password123'" });
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
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeleteChatHistory = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete all AI chat history for ${userName}? This cannot be undone.`)) {
      return;
    }
    
    setLoadingData(true);
    try {
      const res = await authFetch(`/api/admin/chat-histories/${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setChatHistories(prev => prev.filter((h: any) => h.userId !== userId));
        toast({ title: "Success", description: "Chat history deleted successfully" });
        if (expandedChatUserId === userId) setExpandedChatUserId(null);
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to delete chat history", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenreName.trim()) return;

    setIsSubmittingGenre(true);
    try {
      const res = await authFetch('/api/genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGenreName })
      });

      if (res.ok) {
        const newGenre = await res.json();
        setGenres(prev => [...prev, newGenre].sort((a, b) => a.name.localeCompare(b.name)));
        setNewGenreName('');
        toast({ title: "Success", description: "Genre added successfully" });
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to add genre", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add genre", variant: "destructive" });
    } finally {
      setIsSubmittingGenre(false);
    }
  };

  const handleDeleteGenre = async (genreId: string) => {
    try {
      const res = await authFetch(`/api/genres/${genreId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setGenres(prev => prev.filter(g => g.id !== genreId));
        toast({ title: "Success", description: "Genre removed successfully" });
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to remove genre", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove genre", variant: "destructive" });
    }
  };

  const getUserOrganizations = (userId: string) => {
    return organizations
      .filter(org => org.members.includes(userId) || org.managerId === userId || org.createdBy === userId)
      .map(org => ({
        name: org.name,
        role: (org.managerId === userId || org.createdBy === userId) ? 'Manager' : 'Member',
        id: org.id
      }));
  };

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

  const getOrgName = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    return org ? org.name : 'Unknown';
  };

  const genreChartData = Object.entries(stats.songsPerGenre).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>



      <Tabs defaultValue="stats" className="w-full">
        <div className="w-full overflow-x-auto pb-2 mb-6 scrollbar-hide border-b border-white/5">
          <TabsList className="inline-flex w-max min-w-full justify-start rounded-none bg-transparent h-auto p-0 gap-6 flex-nowrap">
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="orgs">Organizations</TabsTrigger>
            <TabsTrigger value="groups">Song Sets</TabsTrigger>
            <TabsTrigger value="songs">Songs</TabsTrigger>
            <TabsTrigger value="add-song">Add Song</TabsTrigger>
            <TabsTrigger value="audit">Activity Logs</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="genres">Genres</TabsTrigger>
            <TabsTrigger value="ai-chats">AI Chats</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stats" className="space-y-4">
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

            {stats.usersByRole && (
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
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View all users and their organization memberships</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAdminData} disabled={loadingData} className="w-full sm:w-auto">Refresh</Button>
            </CardHeader>
            <CardContent>
              {/* User Filters */}
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

              {(() => {
                const filteredUsers = users.filter((user) => {
                  if (userFilterName) {
                    const name = (user.name || user.username || '').toLowerCase();
                    if (!name.includes(userFilterName.toLowerCase())) return false;
                  }
                  if (userFilterEmail) {
                    if (!user.email.toLowerCase().includes(userFilterEmail.toLowerCase())) return false;
                  }
                  if (userFilterRole !== 'all' && user.role !== userFilterRole) return false;
                  if (userFilterGlobal !== 'all') {
                    const hasAccess = ['super_admin', 'editor'].includes(user.role);
                    if (userFilterGlobal === 'granted' && !hasAccess) return false;
                    if (userFilterGlobal === 'no_access' && hasAccess) return false;
                  }
                  return true;
                });

                return (
                  <>
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
                            const hasGlobalAccess = ['super_admin', 'editor'].includes(user.role);
                            return (
                              <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{user.name || user.username}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {user.email}
                            {user.email === SYSTEM_ADMIN_EMAIL && (
                              <span className="block text-[8px] text-purple-500 font-bold uppercase tracking-tighter">System Account</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${user.role === 'super_admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-secondary text-muted-foreground'
                              }`}>
                              {user.role === 'super_admin' ? 'Super Admin' : user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-sans">
                            {user.role === 'super_admin' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium font-sans">
                                ✓ Full Access
                              </span>
                            ) : (
                              <button
                                onClick={() => handleUpdateUserRole(
                                  user.id,
                                  user.role === 'editor' ? 'user' : 'editor'
                                )}
                                disabled={user.email === SYSTEM_ADMIN_EMAIL}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium font-sans transition-colors ${user.email === SYSTEM_ADMIN_EMAIL
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
                                    {userOrgs.map(orgInfo => (
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
                              <select
                                className={`bg-background border rounded px-1.5 py-1 text-xs ${user.email === SYSTEM_ADMIN_EMAIL ? 'opacity-50 cursor-not-allowed' : ''}`}
                                value={user.role}
                                onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                                disabled={user.email === SYSTEM_ADMIN_EMAIL}
                              >
                                <option value="user">User</option>
                                <option value="editor">Editor (Global Library)</option>
                                <option value="super_admin">Super Admin</option>
                              </select>
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
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
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
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orgs">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Organizations</CardTitle>
                <CardDescription>Overview of all defined organizations</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAdminData} disabled={loadingData} className="w-full sm:w-auto">Refresh</Button>
            </CardHeader>
            <CardContent>
              {/* Organization Filters */}
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

              {(() => {
                const filteredOrgs = organizations.filter((org) => {
                  if (orgFilterName && !org.name.toLowerCase().includes(orgFilterName.toLowerCase())) return false;
                  if (orgFilterManager) {
                    const managerNames = getOrgManagers(org).toLowerCase();
                    if (!managerNames.includes(orgFilterManager.toLowerCase())) return false;
                  }
                  return true;
                });

                return (
                  <>
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
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Song Sets (Groups)</CardTitle>
                <CardDescription>Overview of all song sets across organizations</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAdminData} disabled={loadingData} className="w-full sm:w-auto">Refresh</Button>
            </CardHeader>
            <CardContent>
              {/* Song Sets Filters */}
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
                      className="h-8 text-xs w-[160px] bg-transparent border-white/10 border-red-500/20 focus-visible:ring-red-500/30"
                    />
                    {isExcludeOrgFocused && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border border-white/10 bg-transparent p-1 text-white shadow-md">
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

              {/* Excluded Organizations Badges */}
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

              {(() => {
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

                return (
                  <>
                    <div className="text-xs text-muted-foreground mb-2">
                      Showing {filteredGroups.length} of {groups.length} song sets
                    </div>
                    <div className="overflow-x-auto pb-4 scrollbar-hide">
                      <table className="w-full text-sm min-w-[700px]">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Organization</th>
                            <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Members</th>
                            <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Songs</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredGroups.map((group) => (
                            <tr key={group.id} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-4 py-3 font-medium">{group.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{getOrgName(group.organizationId)}</td>
                              <td className="px-4 py-3 text-center">{group.members?.length || 0}</td>
                              <td className="px-4 py-3 text-center">{group.songs?.length || 0}</td>
                              <td className="px-4 py-3 text-right">
                                <Button variant="ghost" size="sm" onClick={() => router.push(`/groups/view?id=${group.id}`)}>
                                  View
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {filteredGroups.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                                {groups.length === 0 ? 'No song sets found.' : 'No song sets match your filters.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="songs">
          <AdminSongList songs={songs} organizations={organizations} />
        </TabsContent>

        <TabsContent value="add-song">
          <Card>
            <CardHeader>
              <CardTitle>Add New Song</CardTitle>
              <CardDescription>Create a new song entry in the database</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminSongForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Activity Logs</CardTitle>
                <CardDescription>View recent updates across the platform</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAdminData} disabled={loadingData} className="w-full sm:w-auto">Refresh</Button>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-4 p-4 rounded-xl bg-zinc-900/50 border border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <Filter className="w-3.5 h-3.5" />
                  Filters
                </div>
                <div className="flex flex-wrap gap-2 flex-1">
                  <Input
                    placeholder="Search user..."
                    value={auditFilterUser}
                    onChange={(e) => setAuditFilterUser(e.target.value)}
                    className="h-8 text-xs w-[140px] bg-transparent border-white/10"
                  />
                  <div className="relative">
                    <Input
                      placeholder="Exclude user..."
                      value={auditFilterExcludeUser}
                      onChange={(e) => setAuditFilterExcludeUser(e.target.value)}
                      onFocus={() => setIsExcludeUserFocused(true)}
                      onBlur={() => setIsExcludeUserFocused(false)}
                      className="h-8 text-xs w-[140px] bg-transparent border-white/10 border-red-500/20 focus-visible:ring-red-500/30"
                    />
                    {isExcludeUserFocused && (
                      <div className="absolute z-50 left-0 mt-1 max-h-60 overflow-y-auto rounded-md border border-white/10 bg-transparent p-1 text-white shadow-md w-[220px]">
                        {!excludedUserIds.includes('_system') && (
                          <div
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setExcludedUserIds([...excludedUserIds, '_system']);
                              setAuditFilterExcludeUser('');
                            }}
                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-zinc-900 focus:bg-zinc-900 text-white"
                          >
                            System / Unknown User
                          </div>
                        )}
                        {users
                          .filter(u =>
                            (u.name.toLowerCase().includes(auditFilterExcludeUser.toLowerCase()) ||
                             u.email.toLowerCase().includes(auditFilterExcludeUser.toLowerCase())) &&
                            !excludedUserIds.includes(u.id)
                          )
                          .map((u) => (
                            <div
                              key={u.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setExcludedUserIds([...excludedUserIds, u.id]);
                                setAuditFilterExcludeUser('');
                              }}
                              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-zinc-900 focus:bg-zinc-900 text-white"
                            >
                              {u.name} ({u.email})
                            </div>
                          ))}
                        {users.filter(u =>
                          (u.name.toLowerCase().includes(auditFilterExcludeUser.toLowerCase()) ||
                           u.email.toLowerCase().includes(auditFilterExcludeUser.toLowerCase())) &&
                          !excludedUserIds.includes(u.id)
                        ).length === 0 && (!auditFilterExcludeUser || excludedUserIds.includes('_system')) && (
                          <div className="p-2 text-[10px] text-muted-foreground italic">No options left</div>
                        )}
                      </div>
                    )}
                  </div>
                  <select
                    value={auditFilterAction}
                    onChange={(e) => setAuditFilterAction(e.target.value)}
                    className="h-8 text-xs rounded-md bg-transparent border border-white/10 px-2 text-zinc-300"
                  >
                    <option value="all">All Actions</option>
                    <option value="create">Create</option>
                    <option value="update">Update</option>
                    <option value="delete">Delete</option>
                  </select>
                  <select
                    value={auditFilterModule}
                    onChange={(e) => setAuditFilterModule(e.target.value)}
                    className="h-8 text-xs rounded-md bg-transparent border border-white/10 px-2 text-zinc-300"
                  >
                    <option value="all">All Modules</option>
                    <option value="songs">Songs</option>
                    <option value="groups">Song Sets</option>
                    <option value="organizations">Organizations</option>
                    <option value="playlists">Playlists</option>
                    <option value="users">Users</option>
                  </select>
                  <Input
                    placeholder="Search item..."
                    value={auditFilterItem}
                    onChange={(e) => setAuditFilterItem(e.target.value)}
                    className="h-8 text-xs w-[140px] bg-transparent border-white/10"
                  />
                  <input
                    type="date"
                    value={auditFilterDateFrom}
                    onChange={(e) => setAuditFilterDateFrom(e.target.value)}
                    className="h-8 text-xs rounded-md bg-transparent border border-white/10 px-2 text-zinc-300"
                    title="From date"
                  />
                  <input
                    type="date"
                    value={auditFilterDateTo}
                    onChange={(e) => setAuditFilterDateTo(e.target.value)}
                    className="h-8 text-xs rounded-md bg-transparent border border-white/10 px-2 text-zinc-300"
                    title="To date"
                  />
                  {(auditFilterUser || auditFilterAction !== 'all' || auditFilterModule !== 'all' || auditFilterItem || auditFilterDateFrom || auditFilterDateTo || auditFilterExcludeUser || excludedUserIds.length > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground hover:text-white px-2"
                      onClick={() => {
                        setAuditFilterUser('');
                        setAuditFilterAction('all');
                        setAuditFilterModule('all');
                        setAuditFilterItem('');
                        setAuditFilterDateFrom('');
                        setAuditFilterDateTo('');
                        setAuditFilterExcludeUser('');
                        setExcludedUserIds([]);
                      }}
                    >
                      <X className="w-3 h-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Excluded Users Badges */}
              {excludedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4 p-3 rounded-xl bg-red-500/5 border border-red-500/10 items-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-red-400/80 mr-1 flex items-center gap-1">
                    <X className="w-3.5 h-3.5" /> Excluded Users:
                  </span>
                  {excludedUserIds.map((id) => {
                    const userObj = users.find(u => u.id === id);
                    const name = id === '_system' ? 'System / Unknown User' : (userObj ? `${userObj.name} (${userObj.email})` : 'Unknown');
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-transparent border border-red-500/20 text-red-300 shadow-sm"
                      >
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() => setExcludedUserIds(excludedUserIds.filter(x => x !== id))}
                          className="hover:text-red-100 text-red-500/80 hover:bg-white/5 rounded-full p-0.5 transition-colors focus:outline-none"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {(() => {
                const filtered = auditLogs.filter((log) => {
                  if (auditFilterUser) {
                    const userStr = log.user ? `${log.user.name} ${log.user.email}`.toLowerCase() : '';
                    if (!userStr.includes(auditFilterUser.toLowerCase())) return false;
                  }
                  if (excludedUserIds.length > 0) {
                    const logUserId = log.userId || (log.user ? log.user.id : '');
                    if (!logUserId && excludedUserIds.includes('_system')) {
                      return false;
                    }
                    if (logUserId && excludedUserIds.includes(logUserId)) {
                      return false;
                    }
                  }
                  if (auditFilterAction !== 'all' && log.action !== auditFilterAction) return false;
                  if (auditFilterModule !== 'all' && log.collectionName !== auditFilterModule) return false;
                  if (auditFilterItem) {
                    const itemStr = (log.itemName || '').toLowerCase();
                    if (!itemStr.includes(auditFilterItem.toLowerCase())) return false;
                  }
                  if (auditFilterDateFrom) {
                    const logDate = new Date(log.timestamp);
                    const fromDate = new Date(auditFilterDateFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    if (logDate < fromDate) return false;
                  }
                  if (auditFilterDateTo) {
                    const logDate = new Date(log.timestamp);
                    const toDate = new Date(auditFilterDateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (logDate > toDate) return false;
                  }
                  return true;
                });

                return (
                  <>
                    <div className="text-xs text-muted-foreground mb-2">
                      Showing {filtered.length} of {auditLogs.length} log entries
                    </div>
                    <div className="overflow-x-auto pb-4 scrollbar-hide">
                      <table className="w-full text-sm min-w-[700px]">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Time</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Action</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Module</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Item</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((log) => (
                            <tr key={log._id} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-4 py-3 text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</td>
                              <td className="px-4 py-3 font-medium">{log.user ? `${log.user.name} (${log.user.email})` : 'System/Unknown'}</td>
                              <td className="px-4 py-3 capitalize">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${log.action === 'update' ? 'bg-blue-500/10 text-blue-500' : log.action === 'create' ? 'bg-green-500/10 text-green-500' : log.action === 'delete' ? 'bg-red-500/10 text-red-500' : 'bg-secondary text-muted-foreground'}`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-4 py-3 capitalize">{log.collectionName}</td>
                              <td className="px-4 py-3">
                                {log.itemName ? (
                                  <span className="font-medium" title={log.documentId}>{log.itemName}</span>
                                ) : (
                                  <span className="text-muted-foreground italic text-xs">Unknown item</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {(log.changes || log.previousState) ? (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 px-2 text-xs"
                                    onClick={() => setSelectedLogChanges(log)}
                                  >
                                    View
                                  </Button>
                                ) : (
                                  <span className="text-xs text-zinc-500 italic px-2">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {filtered.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground italic">
                                {auditLogs.length === 0 ? 'No activity logs yet.' : 'No logs match your filters.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Dialog for Log Changes */}
                    <Dialog open={!!selectedLogChanges} onOpenChange={(open) => { if (!open) setSelectedLogChanges(null); }}>
                      <DialogContent className="max-w-2xl bg-transparent border border-zinc-800">
                        <DialogHeader>
                          <DialogTitle>Activity Log Details</DialogTitle>
                          <DialogDescription>
                            {selectedLogChanges?.action.toUpperCase()} action on {selectedLogChanges?.collectionName} item "{selectedLogChanges?.itemName || selectedLogChanges?.documentId}"
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                          {selectedLogChanges?.changes && (
                            <div className="bg-transparent/50 border border-white/10 rounded-xl p-4">
                              <h4 className="text-sm font-bold text-zinc-200 mb-4 pb-2 border-b border-white/5">Changes Made</h4>
                              <LogObjectViewer obj={selectedLogChanges.changes} />
                            </div>
                          )}
                          {selectedLogChanges?.previousState && (
                            <div className="bg-transparent/50 border border-white/10 rounded-xl p-4">
                              <h4 className="text-sm font-bold text-zinc-200 mb-4 pb-2 border-b border-white/5">Previous State</h4>
                              <LogObjectViewer obj={selectedLogChanges.previousState} />
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="secondary" onClick={() => setSelectedLogChanges(null)}>Close</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Database Storage</CardTitle>
                <CardDescription>Module-wise database storage consumption (in KB)</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAdminData} disabled={loadingData} className="w-full sm:w-auto">Refresh</Button>
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
                         <span className="font-bold text-primary">{(storageStats.dbStats.storageSizeKB).toFixed(2)} KB</span>
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
                            let privateSongs = { count: 0, sizeKB: 0 };
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
                                  <td className="py-2 text-right text-primary font-bold">{(coll.sizeKB).toFixed(1)}</td>
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
                                  ? 'bg-primary/15 text-primary border border-primary/20'
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
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full whitespace-nowrap ml-2">
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
        </TabsContent>

        <TabsContent value="genres" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-white/5 bg-zinc-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Add New Genre</CardTitle>
                <CardDescription>Create a new song genre for the library</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddGenre} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="genre-name" className="text-zinc-300 font-medium">Genre Name</Label>
                    <Input
                      id="genre-name"
                      placeholder="e.g. Acoustic, Rock Gospel"
                      value={newGenreName}
                      onChange={(e) => setNewGenreName(e.target.value)}
                      className="bg-transparent/50 border-white/10 text-white placeholder-zinc-500"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold" 
                    disabled={isSubmittingGenre || !newGenreName.trim()}
                  >
                    {isSubmittingGenre ? 'Adding...' : 'Add Genre'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-white/5 bg-zinc-900/40 backdrop-blur-xl">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Library Genres</CardTitle>
                    <CardDescription>View and manage genres available in the application</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input
                      placeholder="Search genres..."
                      value={genreSearch}
                      onChange={(e) => setGenreSearch(e.target.value)}
                      className="pl-9 bg-transparent/50 border-white/10 text-white placeholder-zinc-500 text-sm"
                    />
                    {genreSearch && (
                      <button
                        onClick={() => setGenreSearch('')}
                        className="absolute right-3 top-3 text-zinc-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="text-center py-8 text-zinc-400">Loading genres...</div>
                ) : (
                  <>
                    {filteredGenres.length === 0 ? (
                      <div className="text-center py-8 text-zinc-400">
                        {genreSearch ? 'No genres found matching your search.' : 'No genres available.'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/5">
                              <th className="text-left pb-3 font-semibold text-zinc-400">Genre Name</th>
                              <th className="text-left pb-3 font-semibold text-zinc-400">Date Created</th>
                              <th className="text-right pb-3 font-semibold text-zinc-400">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredGenres.map((genre) => (
                              <tr key={genre.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-all">
                                <td className="py-3 font-bold text-white text-base">
                                  {genre.name}
                                </td>
                                <td className="py-3 text-zinc-400">
                                  {genre.createdAt ? new Date(genre.createdAt).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="py-3 text-right">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="bg-transparent border border-white/10 text-white">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-zinc-400">
                                          This will permanently delete the genre "{genre.name}". Existing songs with this genre will still keep it, but new songs won't be able to select it.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel className="bg-zinc-900 border-white/10 hover:bg-zinc-800 text-white">Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteGenre(genre.id)}
                                          className="bg-red-600 hover:bg-red-700 text-white"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="w-full">
            <Card className="border-white/5 bg-zinc-900/40 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <SettingsIcon className="w-6 h-6 text-primary" />
                  <CardTitle>System Configuration</CardTitle>
                </div>
                <CardDescription>Manage global permissions and application state</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-white/[0.07]">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-purple-400" />
                      <Label className="text-base font-bold text-white cursor-pointer" htmlFor="org-creation">
                        Enable Organization Creation
                      </Label>
                    </div>
                    <p className="text-sm text-zinc-400 max-w-md">
                      When enabled, regular users can create their own organizations. When disabled, they are prompted to contact you.
                    </p>
                  </div>
                  <Switch
                    id="org-creation"
                    checked={systemSettings.allow_user_org_creation}
                    onCheckedChange={(checked) => handleUpdateSettings({ allow_user_org_creation: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-white/[0.07]">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      <Label className="text-base font-bold text-white cursor-pointer" htmlFor="ai-chat">
                        Enable AI Copilot Chat
                      </Label>
                    </div>
                    <p className="text-sm text-zinc-400 max-w-md">
                      When enabled, users can interact with the Grace Copilot AI assistant across the app.
                    </p>
                  </div>
                  <Switch
                    id="ai-chat"
                    checked={systemSettings.enable_ai_chat}
                    onCheckedChange={(checked) => handleUpdateSettings({ enable_ai_chat: checked })}
                  />
                </div>

                <div className="flex flex-col gap-3 p-6 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-white/[0.07]">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <Label className="text-base font-bold text-white cursor-pointer" htmlFor="groq-api-key">
                        GROQ API Key
                      </Label>
                    </div>
                    <p className="text-sm text-zinc-400 max-w-md">
                      Update the API key used for the Grace Copilot. This key overrides any locally configured environment variables.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 max-w-md mt-2">
                    <Input
                      id="groq-api-key"
                      type="password"
                      placeholder="gsk_..."
                      value={systemSettings.groq_api_key || ''}
                      onChange={(e) => setSystemSettings(s => ({ ...s, groq_api_key: e.target.value }))}
                      className="bg-transparent border-white/10"
                    />
                    <Button 
                      variant="secondary" 
                      onClick={() => handleUpdateSettings({ groq_api_key: systemSettings.groq_api_key })}
                    >
                      Save Key
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-300">Max Groups Per User</h4>
                      <p className="text-xs text-zinc-500">Maximum number of song sets a standard user can create.<br/>Leave empty or 0 for unlimited.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <Input 
                        type="number" 
                        min="0"
                        className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                        value={systemSettings.max_groups_per_user || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSystemSettings((s: any) => ({ ...s, max_groups_per_user: (isNaN(val) || val === 0) ? null : val }));
                        }}
                        placeholder="∞"
                      />
                      <Button 
                        variant="secondary" 
                        onClick={() => handleUpdateSettings({ max_groups_per_user: systemSettings.max_groups_per_user })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-300">Max Custom Songs</h4>
                      <p className="text-xs text-zinc-500">Maximum number of custom songs an organization can add (excluding global library).<br/>Leave empty or 0 for unlimited.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <Input 
                        type="number" 
                        min="0"
                        className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                        value={systemSettings.max_custom_songs_per_org || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSystemSettings((s: any) => ({ ...s, max_custom_songs_per_org: (isNaN(val) || val === 0) ? null : val }));
                        }}
                        placeholder="∞"
                      />
                      <Button 
                        variant="secondary" 
                        onClick={() => handleUpdateSettings({ max_custom_songs_per_org: systemSettings.max_custom_songs_per_org })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-300">Global AI Chat Limit</h4>
                      <p className="text-xs text-zinc-500">Maximum chat history stored per user (in MB).</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <Input 
                        type="number" 
                        min="1"
                        className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                        value={systemSettings.global_ai_chat_limit_mb || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSystemSettings((s: any) => ({ ...s, global_ai_chat_limit_mb: isNaN(val) ? 2 : val }));
                        }}
                      />
                      <Button 
                        variant="secondary" 
                        onClick={() => handleUpdateSettings({ global_ai_chat_limit_mb: systemSettings.global_ai_chat_limit_mb })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-300">Max Songs Per Song Set</h4>
                      <p className="text-xs text-zinc-500">Leave empty or 0 for unlimited.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <Input 
                        type="number" 
                        min="0"
                        className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                        value={systemSettings.max_songs_per_group || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSystemSettings((s: any) => ({ ...s, max_songs_per_group: (isNaN(val) || val === 0) ? null : val }));
                        }}
                        placeholder="∞"
                      />
                      <Button 
                        variant="secondary" 
                        onClick={() => handleUpdateSettings({ max_songs_per_group: systemSettings.max_songs_per_group })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-300">Max Collections Per User</h4>
                      <p className="text-xs text-zinc-500">Organize favorite songs limit. Leave empty for unlimited.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <Input 
                        type="number" 
                        min="0"
                        className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                        value={systemSettings.max_collections_per_user || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSystemSettings((s: any) => ({ ...s, max_collections_per_user: (isNaN(val) || val === 0) ? null : val }));
                        }}
                        placeholder="∞"
                      />
                      <Button 
                        variant="secondary" 
                        onClick={() => handleUpdateSettings({ max_collections_per_user: systemSettings.max_collections_per_user })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-300">Max Songs Per Collection</h4>
                      <p className="text-xs text-zinc-500">Maximum limit of songs in a personal collection. Leave empty for unlimited.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <Input 
                        type="number" 
                        min="0"
                        className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                        value={systemSettings.max_songs_per_collection || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSystemSettings((s: any) => ({ ...s, max_songs_per_collection: (isNaN(val) || val === 0) ? null : val }));
                        }}
                        placeholder="∞"
                      />
                      <Button 
                        variant="secondary" 
                        onClick={() => handleUpdateSettings({ max_songs_per_collection: systemSettings.max_songs_per_collection })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-300">Max Members Per Org</h4>
                      <p className="text-xs text-zinc-500">Leave empty or 0 for unlimited.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <Input 
                        type="number" 
                        min="0"
                        className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                        value={systemSettings.max_members_per_org || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSystemSettings((s: any) => ({ ...s, max_members_per_org: (isNaN(val) || val === 0) ? null : val }));
                        }}
                        placeholder="∞"
                      />
                      <Button 
                        variant="secondary" 
                        onClick={() => handleUpdateSettings({ max_members_per_org: systemSettings.max_members_per_org })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-300">Max Activity Logs Limit</h4>
                      <p className="text-xs text-zinc-500">Auto-deletes older logs when exceeded. Leave empty for unlimited.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <Input 
                        type="number" 
                        min="0"
                        className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                        value={systemSettings.max_activity_logs || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSystemSettings((s: any) => ({ ...s, max_activity_logs: (isNaN(val) || val === 0) ? null : val }));
                        }}
                        placeholder="∞"
                      />
                      <Button 
                        variant="secondary" 
                        onClick={() => handleUpdateSettings({ max_activity_logs: systemSettings.max_activity_logs })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ── App Version Control Section ── */}
                <div className="mt-8 pt-8 border-t border-white/5">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                      <Smartphone className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">App Version Control</h3>
                      <p className="text-xs text-zinc-500">Force mobile users to update when a new version is released</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          <h4 className="text-sm font-bold text-zinc-300">Minimum Version</h4>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">Users below this version will be <span className="text-red-400 font-semibold">forced to update</span> (cannot use the app).</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                        <Input 
                          type="text" 
                          className="bg-zinc-900 border-white/10 text-white w-full sm:w-32 font-mono"
                          value={systemSettings.app_minimum_version || ''}
                          onChange={(e) => setSystemSettings((s: any) => ({ ...s, app_minimum_version: e.target.value }))}
                          placeholder="0.1.0"
                        />
                        <Button 
                          variant="secondary" 
                          onClick={() => handleUpdateSettings({ app_minimum_version: systemSettings.app_minimum_version })}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                      <div>
                        <h4 className="text-sm font-bold text-zinc-300">Latest Version</h4>
                        <p className="text-xs text-zinc-500 mt-1">Users below this (but above minimum) get an <span className="text-emerald-400 font-semibold">optional update</span> prompt.</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                        <Input 
                          type="text" 
                          className="bg-zinc-900 border-white/10 text-white w-full sm:w-32 font-mono"
                          value={systemSettings.app_latest_version || ''}
                          onChange={(e) => setSystemSettings((s: any) => ({ ...s, app_latest_version: e.target.value }))}
                          placeholder="0.1.0"
                        />
                        <Button 
                          variant="secondary" 
                          onClick={() => handleUpdateSettings({ app_latest_version: systemSettings.app_latest_version })}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                      <div>
                        <h4 className="text-sm font-bold text-zinc-300">Android Store URL</h4>
                        <p className="text-xs text-zinc-500 mt-1">Google Play Store link for the app.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Input 
                          type="url" 
                          className="bg-zinc-900 border-white/10 text-white w-full text-xs"
                          value={systemSettings.app_update_url_android || ''}
                          onChange={(e) => setSystemSettings((s: any) => ({ ...s, app_update_url_android: e.target.value }))}
                          placeholder="https://play.google.com/store/apps/details?id=com.gracemusic.arkin.app"
                        />
                        <Button 
                          variant="secondary" 
                          className="self-start"
                          onClick={() => handleUpdateSettings({ app_update_url_android: systemSettings.app_update_url_android })}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                      <div>
                        <h4 className="text-sm font-bold text-zinc-300">iOS Store URL</h4>
                        <p className="text-xs text-zinc-500 mt-1">Apple App Store link for the app.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Input 
                          type="url" 
                          className="bg-zinc-900 border-white/10 text-white w-full text-xs"
                          value={systemSettings.app_update_url_ios || ''}
                          onChange={(e) => setSystemSettings((s: any) => ({ ...s, app_update_url_ios: e.target.value }))}
                          placeholder="https://apps.apple.com/app/id..."
                        />
                        <Button 
                          variant="secondary" 
                          className="self-start"
                          onClick={() => handleUpdateSettings({ app_update_url_ios: systemSettings.app_update_url_ios })}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-300">Force Update Message</h4>
                      <p className="text-xs text-zinc-500 mt-1">Custom message shown when a force update is required.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <textarea
                        className="w-full bg-zinc-900 border border-white/10 text-white rounded-lg px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        value={systemSettings.app_force_update_message || ''}
                        onChange={(e) => setSystemSettings((s: any) => ({ ...s, app_force_update_message: e.target.value }))}
                        placeholder="A critical update is required to continue using Grace Music. Please update to the latest version."
                      />
                      <Button 
                        variant="secondary" 
                        className="self-start"
                        onClick={() => handleUpdateSettings({ app_force_update_message: systemSettings.app_force_update_message })}
                      >
                        Save Message
                      </Button>
                    </div>
                  </div>
                </div>

              </CardContent>
              <CardFooter className="bg-white/5 border-t border-white/5 py-4">
                <p className="text-[10px] text-zinc-500 tracking-tight">
                  Last system-wide settings sync: <span className="font-mono">{new Date().toLocaleTimeString()}</span>
                </p>
              </CardFooter>
            </Card>


          </div>
        </TabsContent>

        {/* AI Chats Tab */}
        <TabsContent value="ai-chats">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  AI Chat Histories
                </CardTitle>
                <CardDescription>View all users' conversations with Grace Copilot</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Search user or message..."
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  className="h-8 text-xs w-full sm:w-[200px] bg-transparent border-white/10"
                />
                <Button variant="outline" size="sm" onClick={fetchAdminData} disabled={loadingData} className="whitespace-nowrap">Refresh</Button>
              </div>
            </CardHeader>
            <CardContent>
              {chatHistories.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No chat histories found</p>
                  <p className="text-sm mt-1">Users haven't started any AI conversations yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground mb-2">
                    {(() => {
                      const filtered = chatHistories.filter(h => {
                        if (!chatSearchQuery) return true;
                        const q = chatSearchQuery.toLowerCase();
                        return (
                          h.userName.toLowerCase().includes(q) ||
                          h.userEmail.toLowerCase().includes(q) ||
                          h.messages.some((m: any) => m.content.toLowerCase().includes(q))
                        );
                      });
                      return `Showing ${filtered.length} of ${chatHistories.length} users with chat history`;
                    })()}
                  </div>
                  {chatHistories
                    .filter(h => {
                      if (!chatSearchQuery) return true;
                      const q = chatSearchQuery.toLowerCase();
                      return (
                        h.userName.toLowerCase().includes(q) ||
                        h.userEmail.toLowerCase().includes(q) ||
                        h.messages.some((m: any) => m.content.toLowerCase().includes(q))
                      );
                    })
                    .map((history: any) => (
                    <div key={history.userId} className="rounded-xl border border-white/5 bg-zinc-900/50 overflow-hidden">
                      {/* User Header — clickable to expand */}
                      <div
                        onClick={() => setExpandedChatUserId(
                          expandedChatUserId === history.userId ? null : history.userId
                        )}
                        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-sm font-bold">
                            {(history.userName || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{history.userName}</p>
                            <p className="text-xs text-muted-foreground">{history.userEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-muted-foreground">
                              {history.messageCount} messages · {(history.sizeBytes / 1024).toFixed(1)} KB
                            </p>
                            {history.updatedAt && (
                              <p className="text-[10px] text-muted-foreground/60">
                                Last active: {new Date(history.updatedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteChatHistory(history.userId, history.userName);
                              }}
                              title="Delete chat history"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            {expandedChatUserId === history.userId
                              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            }
                          </div>
                        </div>
                      </div>

                      {/* Expanded Chat Messages */}
                      {expandedChatUserId === history.userId && (
                        <div className="border-t border-white/5 bg-transparent/50 max-h-[500px] overflow-y-auto">
                          <div className="p-4 space-y-3">
                            {history.messages.length === 0 ? (
                              <p className="text-center text-sm text-muted-foreground py-4">No messages</p>
                            ) : (
                              history.messages.map((msg: any, idx: number) => (
                                <div key={msg.id || idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                                    msg.role === 'user'
                                      ? 'bg-blue-600 text-white rounded-tr-sm'
                                      : 'bg-zinc-800 border border-white/5 text-zinc-200 rounded-tl-sm'
                                  }`}>
                                    {msg.role === 'user' ? (
                                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                    ) : (
                                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-snug prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
                                        <ReactMarkdown 
                                          remarkPlugins={[remarkGfm]}
                                          components={{
                                            a: ({ node, ...props }) => (
                                              <a {...props} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-400 hover:text-blue-300">
                                                {props.children}
                                                <ExternalLink className="w-3 h-3 opacity-70" />
                                              </a>
                                            )
                                          }}
                                        >
                                          {msg.content}
                                        </ReactMarkdown>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    {/* Admin Reset Password Modal */}
      {resetTargetUser && (
        <AdminResetPasswordModal
          open={resetModalOpen}
          onOpenChange={setResetModalOpen}
          onConfirm={confirmResetPassword}
          targetUserName={resetTargetUser.name}
        />
      )}

      {/* Organization Limits Modal */}
      <Dialog open={orgLimitModalOpen} onOpenChange={setOrgLimitModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-transparent border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Set Organization Limits</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Leave empty or set to 0 to fallback to global system defaults.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs">Max Members</Label>
              <Input
                type="number"
                min="0"
                className="bg-zinc-900 border-white/10 text-white"
                value={orgLimitForm.maxMembersLimit}
                onChange={(e) => setOrgLimitForm(f => ({ ...f, maxMembersLimit: e.target.value }))}
                placeholder="Global Default"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Max Songs Per Song Set</Label>
              <Input
                type="number"
                min="0"
                className="bg-zinc-900 border-white/10 text-white"
                value={orgLimitForm.maxSongsPerGroupLimit}
                onChange={(e) => setOrgLimitForm(f => ({ ...f, maxSongsPerGroupLimit: e.target.value }))}
                placeholder="Global Default"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Max Custom Songs <span className="text-zinc-500 font-normal">(excluding global library)</span></Label>
              <Input
                type="number"
                min="0"
                className="bg-zinc-900 border-white/10 text-white"
                value={orgLimitForm.maxCustomSongsLimit}
                onChange={(e) => setOrgLimitForm(f => ({ ...f, maxCustomSongsLimit: e.target.value }))}
                placeholder="Global Default"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrgLimitModalOpen(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSaveOrgLimits}>
              Save Limits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;

