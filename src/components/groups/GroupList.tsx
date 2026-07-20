
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useGroups } from '@/contexts/groups';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Group } from '@/lib/types';
import { Users, Pencil, Trash2, Music, Files, Plus, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getPageNumbers } from '@/lib/pagination';

const SETS_PER_PAGE = 10;

const GroupList = () => {
  const { groups, loading, deleteGroup, updateGroup } = useGroups();
  const { organizations, getUserOrganizations } = useOrganizations();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [createChoiceOpen, setCreateChoiceOpen] = useState(false);
  const router = useRouter();

  const handleCreateWithAI = () => {
    setCreateChoiceOpen(false);
    router.push('/groups/new/ai');
  };

  const handleCreateManually = () => {
    setCreateChoiceOpen(false);
    router.push('/groups/new');
  };

  // Get user's organizations
  const userOrganizations = getUserOrganizations();
  const userOrgIds = userOrganizations.map(org => org.id);

  // Filter groups based on user's organizations if user is logged in
  // Only show song sets from organizations the user belongs to
  const availableGroups = currentUser
    ? (currentUser.role === 'super_admin' ? groups : groups.filter(group => 
        userOrgIds.includes(group.organizationId) || 
        group.members.includes(currentUser.id) ||
        group.createdBy === currentUser.id
      ))
    : [];

  // Filter groups based on search query (tokenized)
  const filteredGroups = availableGroups.filter(group => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const searchTokens = q.split(/\s+/).filter(Boolean);
    return searchTokens.every(token => 
      group.name.toLowerCase().includes(token)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / SETS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedGroups = useMemo(
    () => filteredGroups.slice((safePage - 1) * SETS_PER_PAGE, safePage * SETS_PER_PAGE),
    [filteredGroups, safePage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  };

  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);

  const handleConfirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    const id = groupToDelete.id;
    setGroupToDelete(null);
    try {
      await deleteGroup(id);
    } catch (error) {
      console.error('Failed to delete song set:', error);
    }
  };

  const handleUpdateName = async (id: string) => {
    if (editingGroupName.trim() === '') {
      setEditingGroupId(null);
      return;
    }
    try {
      await updateGroup(id, { name: editingGroupName.trim() });
      setEditingGroupId(null);
    } catch (error) {
      console.error('Failed to update group:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleUpdateName(id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setEditingGroupId(null);
    }
  };

  const isMember = (group: Group) => {
    if (!currentUser) return false;
    return group.members.includes(currentUser.id);
  };

  const canManage = (group: Group) => {
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin' || group.createdBy === currentUser.id) return true;
    
    // Check if user is a manager of the organization
    const org = organizations.find(o => o.id === group.organizationId);
    return org ? org.managerIds.includes(currentUser.id) : false;
  };

  const hasAnyActions = filteredGroups.some(g => canManage(g));

  const getOrganizationName = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    return org ? org.name : "Unknown Organization";
  };

  if (!currentUser) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4 text-muted-foreground">
            Please log in to view song sets.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-20">
      {/* Header / Banner Area */}
      <div className="pt-24 md:pt-32 pb-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3 flex-1">
              <Badge variant="outline" className="border-zinc-800 text-zinc-400 uppercase tracking-widest text-[10px] font-semibold px-3 py-1 rounded-full w-fit">
                LIBRARY
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                Song Sets
              </h1>
              <div className="flex items-center gap-3 text-sm text-zinc-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Files className="w-3.5 h-3.5" />
                  {filteredGroups.length} {filteredGroups.length === 1 ? 'set' : 'sets'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md border-b border-white/5 py-4 transition-all duration-300 ease-in-out">
        <div className="container mx-auto px-4 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 sm:max-w-[280px] flex items-center">
            <Input
              placeholder="Search song sets..."
              className="w-full border-zinc-800 bg-zinc-900/60 text-zinc-100 rounded-full h-9 pl-4 pr-10 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Files className="w-4 h-4 text-zinc-500" />
            </div>
          </div>
          <Button
            data-tour="create-set"
            onClick={() => setCreateChoiceOpen(true)}
            variant="outline"
            size="sm"
            className="w-9 px-0 sm:w-auto sm:px-4 shrink-0 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white transition-all font-medium h-9 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Create Song Set</span>
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-2 sm:px-4 py-8">
          {loading ? (
            <div className="border border-zinc-800/60 rounded-xl bg-zinc-950/30 overflow-hidden">
              {/* Header skeleton */}
              <div className="bg-zinc-800 px-2 sm:px-4 py-3 flex items-center gap-3 sm:gap-4 border-b border-zinc-800/80">
                <Skeleton className="h-4 w-[38%] max-w-[160px]" />
                <Skeleton className="h-4 w-[24%] max-w-[110px]" />
                <Skeleton className="h-4 w-[12%] max-w-[60px]" />
                <Skeleton className="h-7 w-7 rounded-md ml-auto shrink-0" />
              </div>
              {/* Row skeletons */}
              <div className="divide-y divide-zinc-800/60">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 sm:gap-4 px-2 sm:px-4 py-4">
                    <div className="w-[38%] space-y-1.5">
                      <Skeleton className="h-4 w-full max-w-[220px]" />
                      <Skeleton className="h-3 w-2/3 max-w-[140px] sm:hidden" />
                    </div>
                    <Skeleton className="h-4 w-[24%] max-w-[150px]" />
                    <Skeleton className="h-4 w-[10%] max-w-[40px]" />
                    <Skeleton className="h-8 w-8 rounded-full ml-auto shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-4 border border-zinc-800/60 rounded-xl bg-zinc-950/30">
              <div className="text-lg px-4">
                {searchQuery
                  ? 'No song sets match your search criteria'
                  : (userOrganizations.length === 0 && currentUser.role !== 'super_admin')
                    ? 'You need to join an organization to view song sets. Contact an admin to be added to an organization.'
                    : 'No song sets available. Create a song set to get started!'}
              </div>
              {!searchQuery && (userOrganizations.length > 0 || currentUser.role === 'super_admin') && (
                <Button
                  onClick={() => setCreateChoiceOpen(true)}
                  className="gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create Song Set
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto border border-zinc-800/60 rounded-xl bg-zinc-950/30">
              <Table className="table-fixed w-full border-collapse">
                <TableHeader>
                  <TableRow className="bg-zinc-800 hover:bg-zinc-800 data-[state=selected]:bg-zinc-800 border-b border-zinc-800/80">
                    <TableHead className="w-[42%] px-2 sm:px-4 text-base">Name</TableHead>
                    <TableHead className="w-[28%] px-2 sm:px-4 text-base">
                      <div className="flex items-center">
                        <Users className="h-4 w-4" />
                        <span className="sr-only">Organization</span>
                      </div>
                    </TableHead>
                    <TableHead className="w-[15%] px-2 sm:px-4 text-base">
                      <div className="flex items-center">
                        <Music className="h-4 w-4" />
                        <span className="sr-only">Songs</span>
                      </div>
                    </TableHead>
                    {hasAnyActions && (
                      <TableHead className="w-[15%] px-2 sm:px-4 text-right text-base">
                        <span className="sr-only sm:not-sr-only">Actions</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedGroups.map((group) => (
                    <TableRow
                      key={group.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/groups/view?id=${group.id}`)}
                    >
                      <TableCell className="font-medium px-2 sm:px-4 text-base">
                        <div className="flex items-center gap-2">
                          {editingGroupId === group.id ? (
                            <Input
                              value={editingGroupName}
                              onChange={(e) => setEditingGroupName(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, group.id)}
                              onBlur={() => handleUpdateName(group.id)}
                              autoFocus
                              className="h-8 min-w-[50px] w-full"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <>
                              <span className="line-clamp-2 break-words" title={group.name}>{group.name}</span>
                              {canManage(group) && (
                                <Pencil 
                                  className="h-4 w-4 text-zinc-500 hover:text-white transition-colors cursor-pointer shrink-0 animate-in fade-in duration-200" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingGroupId(group.id);
                                    setEditingGroupName(group.name);
                                  }}
                                />
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 text-base">
                        <div className="flex items-center gap-1 w-full">
                          <span 
                            className="hover:underline cursor-pointer line-clamp-2 break-words"
                            title={getOrganizationName(group.organizationId)}
                            onClick={(e) => { e.stopPropagation(); router.push(`/organizations/view?id=${group.organizationId}`); }}
                          >
                            {getOrganizationName(group.organizationId)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 text-base">{group.songs.length}</TableCell>
                      {hasAnyActions && (
                        <TableCell className="text-right px-2 sm:px-4">
                          <div
                            className="flex flex-nowrap items-center justify-end gap-1 overflow-x-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canManage(group) && (
                              <>
                                <Button 
                                  variant="destructive" 
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  title="Delete"
                                  onClick={() => setGroupToDelete(group)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="py-3 border-t border-zinc-800/60">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          className={`cursor-pointer select-none ${safePage <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                          onClick={() => goToPage(safePage - 1)}
                        />
                      </PaginationItem>
                      {getPageNumbers(safePage, totalPages).map((p, idx) =>
                        p === 'ellipsis' ? (
                          <PaginationItem key={`e-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink
                              className="cursor-pointer select-none"
                              isActive={p === safePage}
                              onClick={() => goToPage(p)}
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      )}
                      <PaginationItem>
                        <PaginationNext
                          className={`cursor-pointer select-none ${safePage >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                          onClick={() => goToPage(safePage + 1)}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
      </div>

      <ConfirmDialog
        open={!!groupToDelete}
        onOpenChange={(open) => { if (!open) setGroupToDelete(null); }}
        icon={<Trash2 />}
        title="Delete Song Set"
        description={<>This will permanently delete the song set <span className="font-bold text-white">"{groupToDelete?.name}"</span>. This action cannot be undone.</>}
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteGroup}
      />

      {/* Create song set: manual vs AI */}
      <Dialog open={createChoiceOpen} onOpenChange={setCreateChoiceOpen}>
        <DialogContent className="sm:max-w-sm bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Create Song Set</DialogTitle>
            <DialogDescription className="text-zinc-500">
              How would you like to create it?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <button
              onClick={handleCreateManually}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left hover:bg-zinc-800/80 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
                <Pencil className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-zinc-100">Create manually</p>
                <p className="text-xs text-zinc-500">Name the set and add songs yourself</p>
              </div>
            </button>
            <button
              onClick={handleCreateWithAI}
              className="flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-left hover:bg-blue-500/20 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-blue-300">Create with AI</p>
                <p className="text-xs text-blue-400/70">Let Grace Copilot help build your set</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupList;
