
import { useState } from 'react';
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useGroups } from '@/contexts/groups';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Group } from '@/lib/types';
import { Building, Pencil, Trash2, Music } from 'lucide-react';

const GroupList = () => {
  const { groups, loading, deleteGroup, updateGroup } = useGroups();
  const { organizations, getUserOrganizations } = useOrganizations();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [showAllGroups, setShowAllGroups] = useState(false);
  const router = useRouter();

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

  // Filter groups based on search query
  const filteredGroups = availableGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );



  const handleDeleteGroup = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this song set?')) {
      try {
        await deleteGroup(id);
      } catch (error) {
        console.error('Failed to delete song set:', error);
      }
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
    <div className="container mx-auto px-0 sm:px-4 py-8">
      <Card className="rounded-none sm:rounded-xl border-x-0 sm:border-x">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 sm:p-6">
          <CardTitle className="text-2xl sm:text-3xl">Song Sets</CardTitle>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <Input
              placeholder="Search song sets..."
              className="w-full sm:max-w-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {currentUser && (
              <Button onClick={() => router.push('/groups/new')} className="w-full sm:w-auto">
                Create Song Set
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {loading ? (
            <div className="text-center py-4">Loading song sets...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {searchQuery
                ? 'No song sets match your search criteria'
                : (userOrganizations.length === 0 && currentUser.role !== 'super_admin')
                  ? 'You need to join an organization to view song sets. Contact an admin to be added to an organization.'
                  : 'No song sets available. Create a song set to get started!'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[42%] px-2 sm:px-4 text-base">Name</TableHead>
                    <TableHead className="w-[28%] px-2 sm:px-4 text-base">
                      <div className="flex items-center">
                        <Building className="h-4 w-4" />
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
                  {filteredGroups.map((group) => (
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
                                  onClick={() => handleDeleteGroup(group.id)}
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupList;
