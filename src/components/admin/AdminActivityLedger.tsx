import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authFetch } from '@/contexts/AuthContext';
import { Loader2, Search, Medal, Music, CheckCircle2, Link2, Coins, Banknote } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface ActivityRecord {
  userId: string;
  name: string;
  email: string;
  role: string;
  songsSubmitted: number;
  songsVerified: number;
  aliasesAdded: number;
  /** Remaining unpaid points (earned − paid) */
  totalPoints: number;
  earnedPoints?: number;
  paidPoints?: number;
  submittedItems: { id: string; title: string; date: string; verifiedByName?: string; verifiedByEmail?: string }[];
  verifiedItems: { id: string; title: string; date: string; createdByName?: string; createdByEmail?: string }[];
  aliasItems: { id: string; title: string; date: string; reason?: string }[];
}

interface PointSystem {
  submit: number;
  verify: number;
  alias: number;
}

export default function AdminActivityLedger() {
  const [ledger, setLedger] = useState<ActivityRecord[]>([]);
  const [pointSystem, setPointSystem] = useState<PointSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [detailSearch, setDetailSearch] = useState('');
  const [previewSongId, setPreviewSongId] = useState<string | null>(null);
  const [previewSong, setPreviewSong] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [payoutTarget, setPayoutTarget] = useState<ActivityRecord | null>(null);
  const [payoutPoints, setPayoutPoints] = useState('');
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutSaving, setPayoutSaving] = useState(false);
  const { toast } = useToast();

  const openPayout = (record: ActivityRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPayoutTarget(record);
    setPayoutPoints(String(record.totalPoints));
    setPayoutNote('');
  };

  const handleRecordPayout = async () => {
    if (!payoutTarget) return;
    const points = parseInt(payoutPoints, 10);
    if (!Number.isFinite(points) || points <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter a positive whole number of points.', variant: 'destructive' });
      return;
    }
    if (points > payoutTarget.totalPoints) {
      toast({
        title: 'Too many points',
        description: `Remaining balance is ${payoutTarget.totalPoints}.`,
        variant: 'destructive',
      });
      return;
    }

    setPayoutSaving(true);
    try {
      const res = await authFetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: payoutTarget.userId,
          points,
          note: payoutNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Payout failed', description: data.error || 'Could not record payout', variant: 'destructive' });
        return;
      }
      toast({
        title: 'Payout recorded',
        description: `Paid ${points} pts to ${payoutTarget.name}. Remaining: ${data.balance?.remaining ?? 0}.`,
      });
      setPayoutTarget(null);
      await fetchLedger();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to record payout', variant: 'destructive' });
    } finally {
      setPayoutSaving(false);
    }
  };

  const handlePreview = async (id: string) => {
    if (!id) return;
    setPreviewSongId(id);
    setPreviewSong(null);
    setPreviewLoading(true);
    try {
      const res = await authFetch(`/api/songs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewSong(data.song || data);
      }
    } catch (e) {
      console.error("Failed to fetch song preview", e);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/activity-ledger');
      if (res.ok) {
        const data = await res.json();
        setLedger(data.data || []);
        setPointSystem(data.pointSystem || null);
      }
    } catch (e) {
      console.error('Failed to fetch activity ledger', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredLedger = ledger.filter(record => {
    const term = searchTerm.toLowerCase();
    return (
      record.name.toLowerCase().includes(term) ||
      record.email.toLowerCase().includes(term) ||
      record.role.toLowerCase().includes(term)
    );
  });

  /** Match an item in the expanded detail panel by title, date, or an extra field (e.g. verifier name) */
  const matchesDetail = (item: { title?: string; date?: string }, extra?: string) => {
    const term = detailSearch.trim().toLowerCase();
    if (!term) return true;
    const dateStr = item.date ? new Date(item.date).toLocaleDateString() : '';
    return (
      (item.title || '').toLowerCase().includes(term) ||
      dateStr.toLowerCase().includes(term) ||
      (extra || '').toLowerCase().includes(term)
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500 mb-4" />
          <p className="text-sm text-zinc-400">Loading activity data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Medal className="w-5 h-5 text-yellow-400" />
          Activity & Payouts Ledger
        </CardTitle>
        <CardDescription>
          Track quantifiable contributions (composing, verifying, adding aliases) across all users for future payout calculations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Point System Info */}
        {pointSystem && (
          <div className="flex flex-wrap items-center gap-3 mb-6 p-3 rounded-lg bg-zinc-900/50 border border-white/5">
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mr-2">Point System:</span>
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
              <Music className="w-3 h-3 mr-1.5" /> +{pointSystem.submit} per Composition
            </Badge>
            <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/20">
              <CheckCircle2 className="w-3 h-3 mr-1.5" /> +{pointSystem.verify} per Verification
            </Badge>
            <Badge variant="secondary" className="bg-orange-500/10 text-orange-400 border-orange-500/20">
              <Link2 className="w-3 h-3 mr-1.5" /> +{pointSystem.alias} per Alias
            </Badge>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search users or emails..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 bg-zinc-900/50 border-white/10 text-white w-full"
            />
          </div>
        </div>

        {filteredLedger.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-zinc-400">
              {searchTerm ? "No users match your search." : "No activity recorded yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/5 bg-black/20">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-zinc-400 text-xs uppercase tracking-wider border-b border-white/5">
                <tr>
                  <th className="px-4 py-3 font-medium">Contributor</th>
                  <th className="px-4 py-3 font-medium text-center">Composed (Submits)</th>
                  <th className="px-4 py-3 font-medium text-center">Verified</th>
                  <th className="px-4 py-3 font-medium text-center">Aliases</th>
                  <th className="px-4 py-3 font-medium text-right text-yellow-400/80">Remaining Pts</th>
                  <th className="px-4 py-3 font-medium text-right">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLedger.map((record) => (
                  <React.Fragment key={record.userId}>
                  <tr 
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => {
                      setExpandedRow(expandedRow === record.userId ? null : record.userId);
                      setDetailSearch('');
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-200">{record.name}</span>
                          {record.role === 'super_admin' && (
                            <Badge variant="secondary" className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] h-4 px-1">Admin</Badge>
                          )}
                          {record.role === 'editor' && (
                            <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] h-4 px-1">Editor</Badge>
                          )}
                        </div>
                        {record.email && (
                          <span className="text-[11px] text-zinc-400">{record.email}</span>
                        )}
                        <span className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {record.userId}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                        {record.songsSubmitted}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10 text-green-400 font-medium">
                        {record.songsVerified}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/10 text-orange-400 font-medium">
                        {record.aliasesAdded}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Coins className="w-4 h-4 text-yellow-500" />
                          <span className="font-bold text-yellow-400 text-lg">{record.totalPoints}</span>
                        </div>
                        {(record.paidPoints ?? 0) > 0 && (
                          <span className="text-[10px] text-zinc-500">
                            Earned {record.earnedPoints ?? record.totalPoints} · Paid {record.paidPoints}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-[11px] border-yellow-500/30 bg-yellow-500/5 text-yellow-400 hover:bg-yellow-500/10"
                        disabled={record.totalPoints <= 0}
                        onClick={(e) => openPayout(record, e)}
                      >
                        <Banknote className="w-3 h-3" />
                        Mark Paid
                      </Button>
                    </td>
                  </tr>
                  
                  {/* Expanded Details Row */}
                  {expandedRow === record.userId && (() => {
                    const filteredSubmitted = (record.submittedItems || []).filter(item =>
                      matchesDetail(
                        item,
                        [item.verifiedByName, item.verifiedByEmail].filter(Boolean).join(' ')
                      )
                    );
                    const filteredVerified = (record.verifiedItems || []).filter(item =>
                      matchesDetail(
                        item,
                        [item.createdByName, item.createdByEmail].filter(Boolean).join(' ')
                      )
                    );
                    const filteredAliases = (record.aliasItems || []).filter(item =>
                      matchesDetail(item, item.reason)
                    );
                    return (
                    <tr className="bg-zinc-900/30">
                      <td colSpan={6} className="p-0">
                        <div className="px-4 md:px-6 pt-4 border-t border-white/5">
                          <div className="relative w-full md:w-80">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <Input
                              placeholder="Search by song title, date, verifier, or email..."
                              value={detailSearch}
                              onChange={e => setDetailSearch(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              className="pl-9 h-8 text-xs bg-zinc-900/50 border-white/10 text-white w-full"
                            />
                          </div>
                        </div>
                        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Composed Items */}
                          <div className="space-y-3">
                            <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-400 border-b border-white/5 pb-2">
                              <Music className="w-4 h-4" /> Composed Songs ({filteredSubmitted.length}
                              {detailSearch.trim() && ` of ${record.submittedItems?.length || 0}`})
                            </h4>
                            {filteredSubmitted.length > 0 ? (
                              <ul className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                                {filteredSubmitted.map((item, idx) => (
                                  <li 
                                    key={`${item.id}-${idx}`} 
                                    className="text-xs text-zinc-300 bg-black/40 p-2 rounded border border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                                    onClick={() => handlePreview(item.id)}
                                  >
                                    <div className="font-medium truncate">{item.title}</div>
                                    <div className="text-[10px] text-zinc-500 mt-1 flex justify-between">
                                      <span>{item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}</span>
                                      {item.verifiedByName && (
                                        <span className="text-blue-400/80 text-right truncate max-w-[60%]" title={item.verifiedByEmail || undefined}>
                                          Verified by: {item.verifiedByName}
                                          {item.verifiedByEmail ? ` (${item.verifiedByEmail})` : ''}
                                        </span>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-zinc-500 italic">
                                {detailSearch.trim() ? 'No composed songs match your search.' : 'No songs composed.'}
                              </p>
                            )}
                          </div>

                          {/* Verified Items */}
                          <div className="space-y-3">
                            <h4 className="flex items-center gap-2 text-sm font-semibold text-green-400 border-b border-white/5 pb-2">
                              <CheckCircle2 className="w-4 h-4" /> Verified Songs ({filteredVerified.length}
                              {detailSearch.trim() && ` of ${record.verifiedItems?.length || 0}`})
                            </h4>
                            {filteredVerified.length > 0 ? (
                              <ul className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                                {filteredVerified.map((item, idx) => (
                                  <li 
                                    key={`${item.id}-${idx}`} 
                                    className="text-xs text-zinc-300 bg-black/40 p-2 rounded border border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                                    onClick={() => handlePreview(item.id)}
                                  >
                                    <div className="font-medium truncate">{item.title}</div>
                                    <div className="text-[10px] text-zinc-500 mt-1 flex justify-between">
                                      <span>{item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}</span>
                                      {item.createdByName && (
                                        <span className="text-green-400/80 text-right truncate max-w-[60%]" title={item.createdByEmail || undefined}>
                                          Composed by: {item.createdByName}
                                          {item.createdByEmail ? ` (${item.createdByEmail})` : ''}
                                        </span>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-zinc-500 italic">
                                {detailSearch.trim() ? 'No verified songs match your search.' : 'No songs verified.'}
                              </p>
                            )}
                          </div>

                          {/* Alias Items */}
                          <div className="space-y-3">
                            <h4 className="flex items-center gap-2 text-sm font-semibold text-orange-400 border-b border-white/5 pb-2">
                              <Link2 className="w-4 h-4" /> Aliases Added ({filteredAliases.length}
                              {detailSearch.trim() && ` of ${record.aliasItems?.length || 0}`})
                            </h4>
                            {filteredAliases.length > 0 ? (
                              <div className="space-y-3 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                                {Object.entries(
                                  filteredAliases.reduce((acc, item) => {
                                    let canonical = "Unknown Song";
                                    let alias = item.title;

                                    const auditMatch = item.title.match(/^Alias "(.*?)" added to "(.*?)"$/);
                                    if (auditMatch) {
                                      alias = auditMatch[1];
                                      canonical = auditMatch[2];
                                    } else if (item.reason) {
                                      const rejectMatch = item.reason.match(/^Duplicate of "(.*?)"/);
                                      if (rejectMatch) {
                                        canonical = rejectMatch[1];
                                      }
                                    }

                                    if (!acc[canonical]) acc[canonical] = [];
                                    acc[canonical].push({ ...item, aliasTitle: alias });
                                    return acc;
                                  }, {} as Record<string, any[]>)
                                ).map(([canonical, aliases]) => (
                                  <div key={canonical} className="bg-black/30 rounded-md border border-orange-500/10 p-2">
                                    <div className="text-[11px] font-semibold text-orange-400/80 mb-1.5 uppercase tracking-wide px-1">
                                      {canonical}
                                    </div>
                                    <ul className="space-y-1 pl-2 border-l border-orange-500/20 ml-1">
                                      {aliases.map((item, idx) => (
                                        <li 
                                          key={`${item.id}-${idx}`} 
                                          className="text-xs text-zinc-300 p-1.5 rounded hover:bg-white/5 cursor-pointer transition-colors flex items-center justify-between"
                                          onClick={() => item.id && handlePreview(item.id)}
                                        >
                                          <span className="truncate flex-1 pr-2">{item.aliasTitle}</span>
                                          <span className="text-[9px] text-zinc-500 shrink-0">{item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-500 italic">
                                {detailSearch.trim() ? 'No aliases match your search.' : 'No aliases added.'}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                    );
                  })()}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Preview Dialog */}
      <Dialog open={!!previewSongId} onOpenChange={(open) => !open && setPreviewSongId(null)}>
        <DialogContent className="sm:max-w-[600px] bg-zinc-950 border-white/10 text-white max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">{previewLoading ? 'Loading...' : previewSong?.title || 'Preview Song'}</DialogTitle>
            {!previewLoading && previewSong && (
              <DialogDescription className="text-zinc-400">
                {previewSong.artist || 'Unknown Artist'}
                {previewSong.aliases?.length > 0 && ` • Aliases: ${previewSong.aliases.join(', ')}`}
              </DialogDescription>
            )}
          </DialogHeader>

          {previewLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          ) : previewSong ? (
            <ScrollArea className="flex-1 mt-4 rounded-md border border-white/5 bg-black/20 p-4">
              <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-300">
                {previewSong.lyrics || <span className="italic text-zinc-500">No lyrics available for this song.</span>}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-12 text-center text-red-400">
              Failed to load song details. The song might have been deleted.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={!!payoutTarget} onOpenChange={(open) => !open && !payoutSaving && setPayoutTarget(null)}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-yellow-400" />
              Record Payout
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Paying subtracts points from {payoutTarget?.name}&apos;s remaining balance.
            </DialogDescription>
          </DialogHeader>

          {payoutTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Earned</span>
                  <span className="text-zinc-200">{payoutTarget.earnedPoints ?? payoutTarget.totalPoints} pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Already paid</span>
                  <span className="text-zinc-200">{payoutTarget.paidPoints ?? 0} pts</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
                  <span className="text-yellow-400/80 font-medium">Remaining</span>
                  <span className="text-yellow-400 font-bold">{payoutTarget.totalPoints} pts</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payout-points">Points to pay</Label>
                <Input
                  id="payout-points"
                  type="number"
                  min={1}
                  max={payoutTarget.totalPoints}
                  value={payoutPoints}
                  onChange={(e) => setPayoutPoints(e.target.value)}
                  className="bg-zinc-900/50 border-white/10"
                />
                <button
                  type="button"
                  className="text-[11px] text-yellow-400/80 hover:text-yellow-300"
                  onClick={() => setPayoutPoints(String(payoutTarget.totalPoints))}
                >
                  Pay full remaining balance
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payout-note">Note (optional)</Label>
                <Textarea
                  id="payout-note"
                  value={payoutNote}
                  onChange={(e) => setPayoutNote(e.target.value)}
                  placeholder="e.g. Bank transfer ref #123"
                  className="min-h-[70px] bg-zinc-900/50 border-white/10 text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPayoutTarget(null)}
              disabled={payoutSaving}
            >
              Cancel
            </Button>
            <Button
              className="bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 border border-yellow-500/30"
              onClick={handleRecordPayout}
              disabled={payoutSaving || !payoutTarget || payoutTarget.totalPoints <= 0}
            >
              {payoutSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Banknote className="w-4 h-4 mr-2" />}
              Confirm Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
