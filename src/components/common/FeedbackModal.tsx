import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/contexts/AuthContext";
import { MessageSquare, AlertCircle, Lightbulb, HelpCircle } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [type, setType] = useState<'question' | 'bug' | 'general' | 'idea'>('general');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

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
          description: "Thank you for reaching out. We will review it shortly.",
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
    } catch (error) {
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[#09090b] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageSquare className="w-5 h-5 text-primary" />
            Give Feedback
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Have a question, found a bug, or want to share an idea? Let us know!
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setType('general')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                type === 'general' 
                  ? 'bg-primary/20 border-primary text-primary' 
                  : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <MessageSquare className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">General</span>
            </button>
            <button
              type="button"
              onClick={() => setType('question')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                type === 'question' 
                  ? 'bg-blue-500/20 border-blue-500 text-blue-500' 
                  : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <HelpCircle className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Question</span>
            </button>
            <button
              type="button"
              onClick={() => setType('idea')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                type === 'idea' 
                  ? 'bg-green-500/20 border-green-500 text-green-500' 
                  : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <Lightbulb className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Idea</span>
            </button>
            <button
              type="button"
              onClick={() => setType('bug')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                type === 'bug' 
                  ? 'bg-red-500/20 border-red-500 text-red-500' 
                  : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <AlertCircle className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Bug</span>
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Your Message</label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              className="w-full h-32 bg-zinc-900 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose}
              className="text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !message.trim()}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {isSubmitting ? 'Sending...' : 'Submit Feedback'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
