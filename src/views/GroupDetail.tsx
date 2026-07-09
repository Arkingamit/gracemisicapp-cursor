import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGroups } from '@/contexts/groups';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { useAuth, authFetch } from '@/contexts/AuthContext';
import { Group, Song } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import GroupSongList from '@/components/groups/GroupSongList';
import AddSongsToGroup from '@/components/groups/AddSongsToGroup';
import PdfPreviewModal from '@/components/songs/PdfPreviewModal';
import { Plus, Building, FileText, ChevronLeft, History, ListMusic, Edit2, Share2, MessageCircle } from 'lucide-react';
import { useSongs } from '@/contexts/SongContext';
import MusicianAssignmentPanel from '@/components/groups/MusicianAssignmentPanel';
import { useToast } from '@/hooks/use-toast';

const GroupDetail = () => {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { getGroup, updateGroup, loading } = useGroups();
  const { getAllSongs } = useSongs();
  const { getOrganization } = useOrganizations();
  const { currentUser } = useAuth();
  const [group, setGroup] = useState<Group | undefined>();
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfSongs, setPdfSongs] = useState<Song[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    if (id && !loading) {
      if (!currentUser) {
        const currentPath = window.location.pathname + window.location.search;
        router.replace(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
        return;
      }
      const groupData = getGroup(id);
      if (groupData) {
        setGroup(groupData);
      } else {
        // Fallback: Group might not be in context if accessed via share link. Fetch directly.
        authFetch(`/api/groups/${id}`)
          .then(res => {
            if (!res.ok) throw new Error('Not found');
            return res.json();
          })
          .then(data => {
            if (isMounted) setGroup(data.group);
          })
          .catch(() => {
            if (isMounted) router.replace('/groups');
          });
      }
    }
    return () => { isMounted = false; };
  }, [id, getGroup, router, loading, currentUser]);

  if (loading) return <div className="min-h-screen bg-transparent flex items-center justify-center text-zinc-400">Loading song set...</div>;
  if (!group) return null;

  const organization = getOrganization(group.organizationId);
  const isOrgMember = currentUser && organization && (organization.members.includes(currentUser.id) || organization.managerIds.includes(currentUser.id));
  const isOrgEditor = currentUser && organization && (organization.editorIds || []).includes(currentUser.id);
  const isOrgManager = currentUser && organization && organization.managerIds.includes(currentUser.id);
  const isGroupMember = currentUser && group.members.includes(currentUser.id);
  const isSuperAdmin = currentUser && currentUser.role === 'super_admin';

  // A user is a member if they are explicitly in the group, part of the organization, or a super admin
  const isMember = isSuperAdmin || isOrgMember || isGroupMember;

  // Can edit songs: only org editors, managers, or super_admin
  const canEditSongs = isSuperAdmin || isOrgManager || isOrgEditor;

  const isOwner = currentUser && group.createdBy === currentUser.id;
  const canManage = isOwner || isSuperAdmin || isOrgManager;

  const handleExportPdf = () => {
    const allSongs = getAllSongs();

    // Preserve the order of songs as defined in the group (same as GroupSongList)
    const groupSongs = group.songs
      .map(id => allSongs.find(song => song.id === id))
      .filter((song): song is Song => !!song);

    setPdfSongs(groupSongs);
    setShowPdfPreview(true);
  };

  const initialTranspositions = group.songTranspositions?.reduce((acc, t) => {
    acc[t.songId] = t.transposition;
    return acc;
  }, {} as Record<string, number>) || {};

  const initialUseFlats = group.songTranspositions?.reduce((acc, t) => {
    acc[t.songId] = t.useFlats;
    return acc;
  }, {} as Record<string, boolean>) || {};

  const handleShare = () => {
    const url = `${window.location.origin}/groups/view?id=${group.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: 'Link Copied',
        description: 'The song set link has been copied to your clipboard.',
      });
    }).catch(err => {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy link to clipboard.',
        variant: 'destructive',
      });
    });
  };

  const handleWhatsAppShare = () => {
    const url = `${window.location.origin}/groups/view?id=${group.id}`;
    const text = `🎵 Check out our Song Set: ${group.name}\n\nView songs here: ${url}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-transparent pb-20">
      {/* Header / Banner Area */}
      <div className="bg-gradient-to-b from-primary/10 via-primary/5 to-zinc-950 pt-20 md:pt-28 pb-6">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-auto text-zinc-400 hover:text-white hover:bg-transparent flex items-center gap-1 text-sm font-medium mb-6"
            onClick={() => router.push('/groups')}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>

          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/20 text-primary border-none uppercase tracking-widest text-[10px] font-black px-3 py-1 rounded-full">
                  SONG SET
                </Badge>
                {organization?.name && (
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border-none uppercase tracking-widest text-[10px] font-black px-3 py-1 rounded-full cursor-pointer hover:bg-zinc-700 flex items-center gap-1" onClick={() => router.push(`/organizations/view?id=${group.organizationId}`)}>
                    <Building className="w-3 h-3" /> {organization.name}
                  </Badge>
                )}
              </div>
              {isEditingName ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (editNameValue.trim() && editNameValue !== group.name) {
                      await updateGroup(group.id, { name: editNameValue.trim(), organizationId: group.organizationId });
                    }
                    setIsEditingName(false);
                  }}
                >
                  <input
                    autoFocus
                    className="text-4xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-md bg-transparent border-b-2 border-primary/50 focus:border-primary outline-none focus:ring-0 px-0 py-0 w-full"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onBlur={async () => {
                      if (editNameValue.trim() && editNameValue !== group.name) {
                        await updateGroup(group.id, { name: editNameValue.trim(), organizationId: group.organizationId });
                      }
                      setIsEditingName(false);
                    }}
                  />
                </form>
              ) : (
                <div
                  className={`flex items-center gap-3 group/title w-fit ${canManage ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (canManage) {
                      setEditNameValue(group.name);
                      setIsEditingName(true);
                    }
                  }}
                >
                  <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-md">
                    {group.name}
                  </h1>
                  {canManage && (
                    <Edit2 className="w-4 h-4 text-zinc-500 hover:text-white transition-colors flex-shrink-0" />
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-zinc-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Updated {new Date(group.updatedAt || Date.now()).toLocaleDateString()}
                </span>
                <span className="w-1 h-1 rounded-full bg-zinc-600" />
                <span>{group.songs.length} songs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="sticky top-0 z-20 bg-transparent/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="container mx-auto px-4 flex items-center justify-end gap-4">
          <div className="flex items-center gap-2">
            {isMember && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white transition-all font-medium"
                  onClick={handleShare}
                  title="Copy link to clipboard"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share Link</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full border-zinc-800 bg-green-900/20 text-green-400 hover:bg-green-900/40 hover:text-green-300 transition-all font-medium"
                  onClick={handleWhatsAppShare}
                  title="Share to WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </Button>
              </>
            )}

            {isMember && canEditSongs && (
              <Button 
                onClick={() => setShowAddSongs(true)} 
                variant="outline" 
                size="sm" 
                className="gap-2 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white transition-all font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Songs</span>
              </Button>
            )}

            {isMember && group.songs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white transition-all font-medium"
                onClick={handleExportPdf}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-0 sm:px-4 py-8">
        {showAddSongs ? (
          <AddSongsToGroup
            groupId={group.id}
            existingSongIds={group.songs}
            onCancel={() => setShowAddSongs(false)}
          />
        ) : (
          isMember ? (
            <div className="space-y-4 mx-4 sm:mx-0">
              {/* Only show musician assignments to org managers/editors and super admins */}
              {canEditSongs && (
                <MusicianAssignmentPanel
                  groupId={group.id}
                  organizationId={group.organizationId}
                  assignments={group.musicianAssignments || []}
                  canEdit={canEditSongs}
                />
              )}
              
              <GroupSongList
                groupId={group.id}
                groupSongIds={group.songs}
                groupName={group.name}
              />
            </div>
          ) : (
            <Card className="mx-4 sm:mx-0">
              <CardHeader>
                <CardTitle>Members Only</CardTitle>
                <CardDescription>
                  You need to be a member of this song set to view the songs.
                </CardDescription>
              </CardHeader>
            </Card>
          )
        )}
      </div>

      {/* PDF Preview Modal for the entire group */}
      {showPdfPreview && pdfSongs.length > 0 && (
        <PdfPreviewModal
          open={showPdfPreview}
          onOpenChange={setShowPdfPreview}
          songs={pdfSongs}
          title={group.name}
          initialTranspositions={initialTranspositions}
          initialUseFlats={initialUseFlats}
          initialFontSize={14}
          initialEditStates={group.songEditStates}
        />
      )}
    </div>
  );
};

export default GroupDetail;

