'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { authFetch } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getReportCategoryLabel } from '@/lib/spamReportCategories';
import { SongReport } from '@/lib/types';
import { Flag, Loader2, ShieldAlert, Trash2, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function AdminSongReports() {
  const { toast } = useToast();
  const [reports, setReports] = useState<SongReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'reviewed' | 'dismissed'>('new');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/admin/song-reports?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      } else {
        toast({ title: 'Error', description: 'Failed to load song reports', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load song reports', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const updateReport = async (
    id: string,
    body: Record<string, unknown>,
    successMsg: string
  ) => {
    setBusyId(id);
    try {
      const res = await authFetch(`/api/admin/song-reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast({ title: 'Updated', description: successMsg });
        fetchReports();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Update failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Update failed', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const [reportToDelete, setReportToDelete] = useState<string | null>(null);

  const deleteReport = async (id: string) => {
    setBusyId(id);
    try {
      const res = await authFetch(`/api/admin/song-reports/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
        toast({ title: 'Deleted', description: 'Report removed' });
      } else {
        toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="border-white/5 bg-zinc-900/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="w-5 h-5 text-orange-400" />
          Song Reports & Spam Flags
        </CardTitle>
        <CardDescription>
          Reports from users and verifiers about low-quality or spam contributions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['new', 'reviewed', 'dismissed', 'all'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'secondary' : 'outline'}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={fetchReports} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        {loading && reports.length === 0 ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : reports.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-sm">No reports in this filter.</div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-xl border border-white/5 bg-black/20 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white">{report.songTitle}</span>
                      <Badge variant="secondary" className="bg-orange-500/10 text-orange-300 border-orange-500/20 text-[10px]">
                        {getReportCategoryLabel(report.category)}
                      </Badge>
                      {report.reportUserAsSpammer && (
                        <Badge variant="secondary" className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">
                          Spam user flag
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400 capitalize">
                        {report.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Reported by {report.reporterName} ({report.reporterRole}) ·{' '}
                      {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                    </p>
                    {report.message && (
                      <p className="text-sm text-zinc-300 mt-2">{report.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {report.status !== 'reviewed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === report.id}
                      onClick={() =>
                        updateReport(report.id, { status: 'reviewed' }, 'Marked as reviewed')
                      }
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Reviewed
                    </Button>
                  )}
                  {report.status !== 'dismissed' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === report.id}
                      onClick={() =>
                        updateReport(report.id, { status: 'dismissed' }, 'Report dismissed')
                      }
                    >
                      Dismiss
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-400 border-red-500/20"
                    disabled={busyId === report.id}
                    onClick={() =>
                      updateReport(
                        report.id,
                        {
                          status: 'reviewed',
                          restrictUserId: report.songCreatedBy,
                          reason: `Restricted after reviewing report on "${report.songTitle}"`,
                        },
                        'Contributor restricted from submitting songs'
                      )
                    }
                  >
                    <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Restrict contributor
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-zinc-500"
                    disabled={busyId === report.id}
                    onClick={() => setReportToDelete(report.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!reportToDelete}
        onOpenChange={(open) => { if (!open) setReportToDelete(null); }}
        icon={<Trash2 />}
        title="Delete Report"
        description="This will permanently remove this report."
        confirmLabel="Delete"
        onConfirm={() => {
          if (reportToDelete) {
            const id = reportToDelete;
            setReportToDelete(null);
            deleteReport(id);
          }
        }}
      />
    </Card>
  );
}
