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
import { authFetch } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  SONG_REPORT_CATEGORIES,
  SongReportCategory,
} from '@/lib/spamReportCategories';
import { Flag, Loader2 } from 'lucide-react';

interface ReportSongModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songId: string;
  songTitle: string;
  /** When true, show "Report submitter as spammer" (verifier/admin) */
  allowSpammerFlag?: boolean;
  onSubmitted?: () => void;
}

export default function ReportSongModal({
  open,
  onOpenChange,
  songId,
  songTitle,
  allowSpammerFlag = false,
  onSubmitted,
}: ReportSongModalProps) {
  const { toast } = useToast();
  const [category, setCategory] = useState<SongReportCategory | null>(null);
  const [message, setMessage] = useState('');
  const [reportUserAsSpammer, setReportUserAsSpammer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCategory(null);
    setMessage('');
    setReportUserAsSpammer(false);
  };

  const detailsRequired = category === 'other';
  const detailsMissing = detailsRequired && !message.trim();
  const canSubmit = !!category && !detailsMissing && !submitting;

  const handleSubmit = async () => {
    if (!category) {
      toast({ title: 'Select a reason', description: 'Choose what’s wrong with this song.', variant: 'destructive' });
      return;
    }
    if (detailsMissing) {
      toast({ title: 'Details required', description: 'Please describe the issue when selecting Other.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch(`/api/songs/${songId}/report`, {
        method: 'POST',
        body: JSON.stringify({
          category,
          message: message.trim(),
          reportUserAsSpammer: allowSpammerFlag && reportUserAsSpammer,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Report submitted', description: 'Thanks — we’ll review this contribution.' });
        reset();
        onOpenChange(false);
        onSubmitted?.();
      } else {
        toast({
          title: 'Could not submit',
          description: data.error || 'Failed to report song',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
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
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-orange-400" />
            Report song
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Report an issue with <span className="text-zinc-200 font-medium">{songTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">What’s wrong?</p>
          <div className="space-y-2">
            {SONG_REPORT_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  category === c.key
                    ? 'border-orange-500/40 bg-orange-500/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="text-sm font-medium text-zinc-100">{c.label}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{c.description}</div>
              </button>
            ))}
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className={`text-xs ${detailsRequired ? 'text-orange-300' : 'text-zinc-400'}`}>
              Details {detailsRequired ? '(required)' : '(optional)'}
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={detailsRequired ? 'Please describe what’s wrong…' : 'Add any helpful details…'}
              required={detailsRequired}
              aria-required={detailsRequired}
              className={`bg-zinc-900 min-h-[80px] text-sm ${
                detailsMissing
                  ? 'border-orange-500/50 focus-visible:ring-orange-500/30'
                  : 'border-white/10'
              }`}
            />
            {detailsMissing && (
              <p className="text-[11px] text-orange-400">Please fill in details when selecting Other.</p>
            )}
          </div>

          {allowSpammerFlag && (
            <label className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 p-3 cursor-pointer">
              <Checkbox
                checked={reportUserAsSpammer}
                onCheckedChange={(v) => setReportUserAsSpammer(!!v)}
                className="mt-0.5"
              />
              <span>
                <span className="text-sm font-medium text-red-300">Report this user as spamming</span>
                <span className="block text-[11px] text-zinc-500 mt-0.5">
                  Flags the contributor for admin review. Repeated flags can auto-restrict submissions.
                </span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-orange-600 hover:bg-orange-500 text-white"
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Flag className="w-4 h-4 mr-2" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
