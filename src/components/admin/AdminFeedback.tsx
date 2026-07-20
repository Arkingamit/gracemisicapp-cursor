"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/contexts/AuthContext';
import { MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function AdminFeedback() {
  const { toast } = useToast();
  
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const fetchFeedback = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await authFetch('/api/admin/feedback');
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data.feedbacks || []);
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
      toast({ title: "Error", description: "Failed to load user feedback", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleUpdateFeedbackStatus = async (id: string, newStatus: string) => {
    try {
      const res = await authFetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setFeedbacks(feedbacks.map(f => f.id === id ? { ...f, status: newStatus } : f));
        toast({ title: "Updated", description: "Status updated successfully" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const [feedbackToDelete, setFeedbackToDelete] = useState<string | null>(null);

  const handleDeleteFeedback = async (id: string) => {
    try {
      const res = await authFetch(`/api/admin/feedback/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFeedbacks(feedbacks.filter(f => f.id !== id));
        toast({ title: "Deleted", description: "Feedback removed" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete feedback", variant: "destructive" });
    }
  };

  if (loadingData && feedbacks.length === 0) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div
        className="relative rounded-2xl overflow-hidden p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(18,18,24,0.95) 0%, rgba(24,24,32,0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">User Feedback</h2>
              <p className="text-xs text-zinc-500">Questions, bugs, and ideas from users</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Stats pills */}
            {feedbacks.length > 0 && (
              <div className="hidden sm:flex items-center gap-2">
                {[
                  { label: 'New', count: feedbacks.filter((f: any) => f.status === 'new').length, color: 'text-zinc-300', bg: 'bg-white/5 border-white/10' },
                  { label: 'Open', count: feedbacks.filter((f: any) => f.status === 'in-progress').length, color: 'text-zinc-300', bg: 'bg-white/5 border-white/10' },
                  { label: 'Done', count: feedbacks.filter((f: any) => f.status === 'resolved').length, color: 'text-zinc-300', bg: 'bg-white/5 border-white/10' },
                ].map(s => (
                  <span key={s.label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${s.bg} ${s.color}`}>
                    <span className="font-bold">{s.count}</span>
                    <span className="opacity-70">{s.label}</span>
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={fetchFeedback}
              disabled={loadingData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white border border-white/[0.07] hover:border-white/15 hover:bg-white/[0.05] transition-all duration-200 disabled:opacity-40"
            >
              {loadingData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Feedback list */}
      {feedbacks.length === 0 ? (
        <div
          className="rounded-2xl p-16 flex flex-col items-center gap-4 text-center"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <MessageSquare className="w-7 h-7 text-zinc-600" />
          </div>
          <div>
            <p className="text-white font-semibold">No feedback yet</p>
            <p className="text-zinc-500 text-sm mt-1">User submissions will appear here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((item: any) => {
            const typeConfig = {
              bug:      { label: 'Bug',      icon: '🐛', color: 'text-red-300',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-500'     },
              idea:     { label: 'Idea',     icon: '💡', color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
              question: { label: 'Question', icon: '❓', color: 'text-blue-300',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-500'    },
              general:  { label: 'General',  icon: '💬', color: 'text-violet-300',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  dot: 'bg-violet-500'  },
            }[item.type as string] || { label: item.type, icon: '💬', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', dot: 'bg-zinc-500' };

            const statusConfig = {
              'new':         { label: 'New',         color: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
              'in-progress': { label: 'In Progress', color: 'text-amber-300',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30'  },
              'resolved':    { label: 'Resolved',    color: 'text-emerald-300',bg: 'bg-emerald-500/10',border: 'border-emerald-500/30' },
            }[item.status as string] || { label: item.status, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };

            return (
              <div
                key={item.id}
                className="group relative rounded-2xl overflow-hidden transition-all duration-200 hover:translate-y-[-1px]"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                }}
              >
                {/* Colored left accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${typeConfig.dot} opacity-60 rounded-full`} />

                <div className="p-4 pl-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.7)',
                        }}
                      >
                        {(item.userName || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white truncate">{item.userName}</span>
                          {/* Type badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${typeConfig.bg} ${typeConfig.border} ${typeConfig.color}`}>
                            <span>{typeConfig.icon}</span>
                            {typeConfig.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600 mt-0.5">
                          {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Status select styled */}
                      <div className="relative">
                        <select
                          value={item.status}
                          onChange={(e) => handleUpdateFeedbackStatus(item.id, e.target.value)}
                          className={`appearance-none pl-2.5 pr-6 py-1.5 rounded-lg border text-[11px] font-semibold focus:outline-none cursor-pointer transition-all ${statusConfig.bg} ${statusConfig.border} ${statusConfig.color}`}
                          style={{ background: 'transparent' }}
                        >
                          <option value="new" className="bg-zinc-900 text-white">New</option>
                          <option value="in-progress" className="bg-zinc-900 text-white">In Progress</option>
                          <option value="resolved" className="bg-zinc-900 text-white">Resolved</option>
                        </select>
                        <svg className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${statusConfig.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      {/* Delete */}
                      <button
                        onClick={() => setFeedbackToDelete(item.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Message */}
                  <div
                    className="mt-3 p-3 rounded-xl text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    {item.message}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!feedbackToDelete}
        onOpenChange={(open) => { if (!open) setFeedbackToDelete(null); }}
        icon={<Trash2 />}
        title="Delete Feedback"
        description="This will permanently remove this feedback."
        confirmLabel="Delete"
        onConfirm={() => {
          if (feedbackToDelete) {
            const id = feedbackToDelete;
            setFeedbackToDelete(null);
            handleDeleteFeedback(id);
          }
        }}
      />
    </div>
  );
}
