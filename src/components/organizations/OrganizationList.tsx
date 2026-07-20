
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Plus, Pencil, Trash2, Mail, Info, Users, Files, Key } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';

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

  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);

  const handleConfirmDeleteOrganization = async () => {
    if (!orgToDelete) return;
    const id = orgToDelete.id;
    setOrgToDelete(null);
    try {
      await deleteOrganization(id);
    } catch (error) {
      console.error('Failed to delete organization:', error);
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

    if (!currentUser) {
      // Redirect to the dedicated invite page which handles sign-in prompting
      router.push(`/invite/${joinCode.trim()}`);
      return;
    }

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
    <div className="min-h-screen bg-transparent pb-20">
      {/* Header / Banner Area */}
      <div className="pt-24 md:pt-32 pb-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3 flex-1">
              <Badge variant="outline" className="border-zinc-800 text-zinc-400 uppercase tracking-widest text-[10px] font-semibold px-3 py-1 rounded-full w-fit">
                COMMUNITY
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                Organizations
              </h1>
              <div className="flex items-center gap-3 text-sm text-zinc-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {filteredOrganizations.length} {filteredOrganizations.length === 1 ? 'organization' : 'organizations'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md border-b border-white/5 py-4 transition-all duration-300 ease-in-out">
        <div className="container mx-auto px-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:flex-1 sm:max-w-[280px] flex items-center">
            <Input
              placeholder="Search organizations..."
              className="w-full border-zinc-800 bg-zinc-900/60 text-zinc-100 rounded-full h-9 pl-4 pr-10 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Users className="w-4 h-4 text-zinc-500" />
            </div>
          </div>
          <ButtonGroup
            data-tour="org-actions"
            aria-label="Organization actions"
            className="w-full sm:w-fit"
          >
            {canCreate ? (
              <Button
                onClick={() => router.push('/organizations/new')}
                variant="secondary"
                size="sm"
                className="flex-1 sm:flex-none gap-2"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Create Organization
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 sm:flex-none gap-2"
                onClick={() => window.open('mailto:gamitarkin2@gmail.com', '_blank')}
              >
                <Mail className="w-4 h-4 shrink-0" />
                Contact Admin
              </Button>
            )}
            <ButtonGroupSeparator />
            <Dialog open={joinModalOpen} onOpenChange={setJoinModalOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 sm:flex-none gap-2"
                >
                  <Key className="w-4 h-4 shrink-0" />
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
                <div className="py-4 flex justify-center">
                  <InputOTP
                    maxLength={6}
                    pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                    value={joinCode}
                    onChange={(value) => setJoinCode(value.toUpperCase())}
                  >
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="h-12 w-12 text-xl uppercase bg-zinc-900 border-zinc-700"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setJoinModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleJoinOrganization} disabled={isJoining || joinCode.length < 6}>
                    {isJoining ? 'Sending...' : 'Request to Join'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </ButtonGroup>
        </div>
      </div>

      <div className="container mx-auto px-2 sm:px-4 py-8 space-y-4">
        {!canCreate && !isSuperAdmin && (
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
        )}

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
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 sm:gap-4 px-2 sm:px-4 py-4">
                    <div className="w-[38%] space-y-1.5">
                      <Skeleton className="h-4 w-full max-w-[220px]" />
                    </div>
                    <Skeleton className="h-4 w-[24%] max-w-[150px]" />
                    <Skeleton className="h-4 w-[10%] max-w-[40px]" />
                    <Skeleton className="h-8 w-8 rounded-full ml-auto shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-4 border border-zinc-800/60 rounded-xl bg-zinc-950/30">
              <div className="text-lg px-4">
                {searchQuery
                  ? 'No organizations match your search criteria'
                  : 'No organizations available. Create an organization to get started!'}
              </div>
              {!searchQuery && canCreate && (
                <Button
                  onClick={() => router.push('/organizations/new')}
                  className="gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create Organization
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto border border-zinc-800/60 rounded-xl bg-zinc-950/30">
              <Table className="table-fixed w-full border-collapse">
                <TableHeader>
                  <TableRow className="bg-zinc-800 hover:bg-zinc-800 data-[state=selected]:bg-zinc-800 border-b border-zinc-800/80">
                    <TableHead className="w-[42%] px-2 sm:px-4 text-base">Name</TableHead>
                    <TableHead className="w-[21%] px-2 sm:px-4 text-base">
                      <div className="flex items-center">
                        <Users className="h-4 w-4" />
                        <span className="sr-only">Members</span>
                      </div>
                    </TableHead>
                    <TableHead className="w-[22%] px-2 sm:px-4 text-base">
                      <div className="flex items-center">
                        <Files className="h-4 w-4" />
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
                      <TableCell className="px-2 sm:px-4 text-base">{organization.groups?.length || 0}</TableCell>
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
                                  onClick={() => setOrgToDelete(organization)}
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
      </div>

      <ConfirmDialog
        open={!!orgToDelete}
        onOpenChange={(open) => { if (!open) setOrgToDelete(null); }}
        icon={<Trash2 />}
        title="Delete Organization"
        description={<>This will permanently delete <span className="font-bold text-white">"{orgToDelete?.name}"</span> and all its data. This action cannot be undone.</>}
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteOrganization}
      />
    </div>
  );
};

export default OrganizationList;
