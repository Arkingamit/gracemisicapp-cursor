'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useSongs } from '@/contexts/SongContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { Library, Check, Loader2 } from 'lucide-react';

interface CopyToOrgButtonProps {
  songId: string;
  songTitle: string;
  /** If the song already belongs to an org, we won't show the button */
  songOrgId?: string;
  /** Show text label next to icon */
  showText?: boolean;
  /** Render as icon button (table rows) */
  variant?: 'icon' | 'default';
}

const CopyToOrgButton: React.FC<CopyToOrgButtonProps> = ({
  songId,
  songTitle,
  songOrgId,
  showText = false,
  variant = 'icon',
}) => {
  const { copySongToOrg } = useSongs();
  const { currentUser } = useAuth();
  const { getUserOrganizations } = useOrganizations();
  const [open, setOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copiedOrgId, setCopiedOrgId] = useState<string | null>(null);

  if (!currentUser) return null;

  const userOrgs = getUserOrganizations();

  // Find orgs where user is a manager
  const managedOrgs = userOrgs.filter(
    org =>
      org.managerIds.includes(currentUser.id) ||
      org.createdBy === currentUser.id
  );

  // Also allow super_admin to copy to any org
  const isSuperAdmin = currentUser.role === 'super_admin';
  const eligibleOrgs = isSuperAdmin ? userOrgs : managedOrgs;

  // Don't show the button if user has no orgs to copy to, or the song is already in an org
  if (eligibleOrgs.length === 0) return null;
  if (songOrgId) return null;

  const handleCopy = async (orgId: string) => {
    setCopying(true);
    try {
      await copySongToOrg(songId, orgId);
      setCopiedOrgId(orgId);
      setTimeout(() => {
        setOpen(false);
        setCopiedOrgId(null);
      }, 1200);
    } catch {
      // Error toast is handled by context
    } finally {
      setCopying(false);
    }
  };

  if (variant === 'icon') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Add to My Library"
          >
            <Library className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add to Organization Library</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Copy <strong>"{songTitle}"</strong> to your organization's private library.
          </p>
          <div className="space-y-2">
            {eligibleOrgs.map(org => (
              <button
                key={org.id}
                onClick={() => handleCopy(org.id)}
                disabled={copying}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-white/10 bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors text-left disabled:opacity-50"
              >
                <div>
                  <p className="font-medium text-sm">{org.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {org.members.length} members
                  </p>
                </div>
                {copiedOrgId === org.id ? (
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                ) : copying ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                ) : null}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Default variant — full button with text
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white transition-all font-medium"
        >
          <Library className="w-3.5 h-3.5" />
          {showText && <span>Add to My Library</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add to Organization Library</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Copy <strong>"{songTitle}"</strong> to your organization's private library.
        </p>
        <div className="space-y-2">
          {eligibleOrgs.map(org => (
            <button
              key={org.id}
              onClick={() => handleCopy(org.id)}
              disabled={copying}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-white/10 bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors text-left disabled:opacity-50"
            >
              <div>
                <p className="font-medium text-sm">{org.name}</p>
                <p className="text-xs text-muted-foreground">
                  {org.members.length} members
                </p>
              </div>
              {copiedOrgId === org.id ? (
                <Check className="w-4 h-4 text-green-400 shrink-0" />
              ) : copying ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
              ) : null}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CopyToOrgButton;
