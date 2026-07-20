'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  SONG_REPORT_CATEGORIES,
  SongReportCategory,
} from '@/lib/spamReportCategories';
import { Loader2, X } from 'lucide-react';

export interface RejectSongPayload {
  rejectionCategory: SongReportCategory;
  rejectionMessage: string;
  reportUserAsSpammer: boolean;
}

interface RejectSongDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songTitle: string;
  submitting?: boolean;
  onConfirm: (payload: RejectSongPayload) => void;
}

export default function RejectSongDialog({
  open,
  onOpenChange,
  songTitle,
  submitting = false,
  onConfirm,
}: RejectSongDialogProps) {
  const [category, setCategory] = useState<SongReportCategory | null>(null);
  const [message, setMessage] = useState('');
  const [reportUserAsSpammer, setReportUserAsSpammer] = useState(false);

  const reset = () => {
    setCategory(null);
    setMessage('');
    setReportUserAsSpammer(false);
  };

  const handleConfirm = () => {
    if (!category) return;
    if (category === 'other' && !message.trim()) return;
    onConfirm({
      rejectionCategory: category,
      rejectionMessage: message.trim(),
      reportUserAsSpammer,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md bg-zinc-950 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <X className="w-4 h-4" />
            Reject song
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Choose why you&apos;re rejecting <span className="text-zinc-200 font-medium">{songTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            {SONG_REPORT_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  category === c.key
                    ? 'border-red-500/40 bg-red-500/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="text-sm font-medium text-zinc-100">{c.label}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{c.description}</div>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">
              Notes {category === 'other' ? '(required)' : '(optional)'}
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional notes for the record…"
              className="bg-zinc-900 border-white/10 min-h-[72px] text-sm"
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 cursor-pointer">
            <Checkbox
              checked={reportUserAsSpammer}
              onCheckedChange={(v) => setReportUserAsSpammer(!!v)}
              className="mt-0.5"
            />
            <span>
              <span className="text-sm font-medium text-orange-300">This user is spamming</span>
              <span className="block text-[11px] text-zinc-500 mt-0.5">
                Report the contributor. Enough spam reports (set by admin) will auto-restrict them.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={
              submitting || !category || (category === 'other' && !message.trim())
            }
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
            Reject song
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
