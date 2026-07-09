
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Organization } from '@/lib/types';
import { Building, Plus, Pencil, Trash2, Mail, Info, Users, ListMusic, Key } from 'lucide-react';

const OrganizationList = () => {
  const { organizations, loading, deleteOrganization, updateOrganization } = useOrganizations();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editingOrgName, setEditingOrgName] = useState('');
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();

  // Filter organizations based on search query
  const filteredOrganizations = organizations.filter(organization =>
    organization.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteOrganization = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this organization?')) {
      try {
        await deleteOrganization(id);
      } catch (error) {
        console.error('Failed to delete organization:', error);
      }
    }
  };

  const handleUpdateName = async (id: string) => {
    if (editingOrgName.trim() === '') {
      setEditingOrgId(null);
      return;
    }
    try {
      await updateOrganization(id, { name: editingOrgName.trim() });
      setEditingOrgId(null);
    } catch (error) {
      console.error('Failed to update organization:', error);
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
      setEditingOrgId(null);
    }
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const { allowUserOrgCreation } = useOrganizations();
  const canCreate = isSuperAdmin || allowUserOrgCreation;

  const isManagerOf = (organization: Organization) => currentUser?.id && organization.managerIds.includes(currentUser.id);

  const canManage = (organization: Organization) => {
    if (!currentUser) return false;
    return isSuperAdmin || isManagerOf(organization);
  };

  const hasAnyActions = isSuperAdmin || filteredOrganizations.some(o => canManage(o));

  const { submitJoinRequest } = useOrganizations();

  const handleJoinOrganization = async () => {
    if (!joinCode.trim()) return;
    try {
      setIsJoining(true);
      await submitJoinRequest(joinCode.trim());
      setJoinModalOpen(false);
      setJoinCode('');
    } catch (error) {
      // Error is handled in context
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="container mx-auto px-0 sm:px-4 pt-20 md:pt-28 pb-8">
      <Card className="rounded-none sm:rounded-xl border-x-0 sm:border-x">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <Building className="h-5 w-5 sm:h-6 sm:w-6" />
            Organizations
          </CardTitle>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <Input
              placeholder="Search organizations..."
              className="w-full sm:max-w-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {canCreate ? (
              <Button onClick={() => router.push('/organizations/new')} className="w-full sm:w-auto gap-2">
                <Plus className="h-4 w-4" />
                Create Organization
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="w-full sm:w-auto gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary"
                onClick={() => window.open('mailto:gamitarkin2@gmail.com', '_blank')}
              >
                <Mail className="h-4 w-4" />
                Contact Admin to Create
              </Button>
            )}
            <Dialog open={joinModalOpen} onOpenChange={setJoinModalOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full sm:w-auto gap-2 bg-zinc-800 text-zinc-100 hover:bg-zinc-700">
                  <Key className="h-4 w-4" />
                  Join via Code
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-zinc-950 border border-zinc-800 text-white">
                <DialogHeader>
                  <DialogTitle>Join an Organization</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Enter the 6-character code provided by your organization's manager to request access.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    placeholder="e.g., 7X9K2P"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="text-center text-2xl tracking-widest uppercase bg-zinc-900 border-zinc-700 focus-visible:ring-primary h-14"
                    maxLength={6}
                  />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setJoinModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleJoinOrganization} disabled={isJoining || joinCode.length < 6}>
                    {isJoining ? 'Sending...' : 'Request to Join'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        {!canCreate && !isSuperAdmin && (
          <div className="px-6 pb-2">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10 border-dashed">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">Public Creation Disabled</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Direct organization creation is restricted. Please email the administrator 
                  to set up your church or group.
                </p>
                <a 
                  href="mailto:gamitarkin2@gmail.com" 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-block pt-1 text-xs font-bold text-primary hover:underline"
                >
                  gamitarkin2@gmail.com →
                </a>
              </div>
            </div>
          </div>
        )}
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {loading ? (
            <div className="text-center py-12">Loading organizations...</div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery
                ? 'No organizations match your search criteria'
                : 'No organizations available. Create an organization to get started!'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[42%] px-2 sm:px-4 text-base">Name</TableHead>
                    <TableHead className="w-[21%] px-2 sm:px-4 text-base">
                      <div className="flex items-center">
                        <Users className="h-4 w-4" />
                        <span className="sr-only">Members</span>
                      </div>
                    </TableHead>
                    <TableHead className="w-[22%] px-2 sm:px-4 text-base">
                      <div className="flex items-center">
                        <ListMusic className="h-4 w-4" />
                        <span className="sr-only">Groups</span>
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
                  {filteredOrganizations.map((organization) => (
                    <TableRow
                      key={organization.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/organizations/view?id=${organization.id}`)}
                    >
                      <TableCell className="font-medium px-2 sm:px-4 text-base">
                        <div className="flex items-center gap-2">
                          {editingOrgId === organization.id ? (
                            <Input
                              value={editingOrgName}
                              onChange={(e) => setEditingOrgName(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, organization.id)}
                              onBlur={() => handleUpdateName(organization.id)}
                              autoFocus
                              className="h-8 min-w-[50px] w-full"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <>
                              <span className="line-clamp-2 break-words" title={organization.name}>{organization.name}</span>
                              {canManage(organization) && (
                                <Pencil 
                                  className="h-4 w-4 text-zinc-500 hover:text-white transition-colors cursor-pointer shrink-0 animate-in fade-in duration-200" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingOrgId(organization.id);
                                    setEditingOrgName(organization.name);
                                  }}
                                />
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 text-base">{organization.members.length}</TableCell>
                      <TableCell className="px-2 sm:px-4 text-base">{organization.groups.length}</TableCell>
                      {hasAnyActions && (
                        <TableCell className="text-right px-2 sm:px-4">
                          <div
                            className="flex flex-nowrap items-center justify-end gap-1 overflow-x-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canManage(organization) && (
                              <>
                                <Button 
                                  variant="destructive" 
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  title="Delete"
                                  onClick={() => handleDeleteOrganization(organization.id)}
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

export default OrganizationList;
