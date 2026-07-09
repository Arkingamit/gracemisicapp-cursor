import React, { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/contexts/AuthContext";
import { MessageSquare, AlertCircle, Lightbulb, HelpCircle, X, Send, Sparkles } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPES = [
  { key: 'general' as const, label: 'General',  icon: MessageSquare },
  { key: 'question' as const, label: 'Question', icon: HelpCircle },
  { key: 'idea' as const,    label: 'Idea',      icon: Lightbulb },
  { key: 'bug' as const,     label: 'Bug',       icon: AlertCircle },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [type, setType] = useState<'question' | 'bug' | 'general' | 'idea'>('general');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const activeType = TYPES.find(t => t.key === type)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ type, message })
      });

      if (res.ok) {
        toast({
          title: "Feedback Submitted!",
          description: "Thank you for reaching out. We'll review it shortly.",
        });
        setMessage('');
        setType('general');
        onClose();
      } else {
        const data = await res.json();
        toast({
          title: "Error",
          description: data.error || "Failed to submit feedback",
          variant: "destructive"
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An error occurred while submitting feedback",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        {/* Content */}
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Glassmorphism Card */}
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(18,18,24,0.98) 0%, rgba(24,24,30,0.98) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >

            {/* Header */}
            <div className="relative px-6 pt-6 pb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <DialogPrimitive.Title className="text-base font-bold text-white tracking-tight">
                      Share Feedback
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="text-xs text-zinc-500 mt-0.5">
                      Help us improve Grace Music
                    </DialogPrimitive.Description>
                  </div>
                </div>
                <DialogPrimitive.Close
                  className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all duration-200 focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </DialogPrimitive.Close>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 pb-6 pt-5 space-y-5">

              {/* Type selector */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Category</p>
                <div className="grid grid-cols-4 gap-2">
                  {TYPES.map((t) => {
                    const Icon = t.icon;
                    const isActive = type === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setType(t.key)}
                        className={`relative flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl border transition-all duration-200 ${
                          isActive
                            ? 'bg-white/10 border-white/25 shadow-lg'
                            : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ${
                          isActive ? 'bg-white/15' : 'bg-white/5'
                        }`}
                          style={isActive ? { boxShadow: `0 4px 12px rgba(0,0,0,0.3)` } : {}}
                        >
                          <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-zinc-500'} transition-colors`} />
                        </div>
                        <span className={`text-[10px] font-semibold tracking-tight transition-colors ${
                          isActive ? 'text-white' : 'text-zinc-600'
                        }`}>
                          {t.label}
                        </span>
                        {isActive && (
                          <span
                            className="absolute inset-0 rounded-2xl pointer-events-none"
                            style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1)` }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Message</p>
                <div className="relative">
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what's on your mind..."
                    rows={4}
                    className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 resize-none focus:outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: message.trim()
                        ? `1px solid rgba(255,255,255,0.2)`
                        : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: message.trim()
                        ? '0 0 0 3px rgba(255,255,255,0.05)'
                        : 'none',
                    }}
                  />
                  {message.length > 0 && (
                    <span className="absolute bottom-3 right-3 text-[10px] text-zinc-600">
                      {message.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-white border border-white/[0.06] hover:border-white/10 hover:bg-white/[0.04] transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !message.trim()}
                  className="flex-1 relative py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    boxShadow: message.trim() && !isSubmitting
                      ? '0 4px 20px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.1) inset'
                      : 'none',
                  }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Submit
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
