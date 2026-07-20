"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/contexts/AuthContext';
import { MessageSquare, Trash2, ChevronUp, ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

function matchesSearch(history: any, q: string) {
  if (!q) return true;
  const query = q.toLowerCase();
  return (
    (history.userName || '').toLowerCase().includes(query) ||
    (history.userEmail || '').toLowerCase().includes(query) ||
    (history.messages || []).some((m: any) => (m.content || '').toLowerCase().includes(query)) ||
    (history.conversations || []).some((c: any) => (c.title || '').toLowerCase().includes(query))
  );
}

export default function AdminAIChats() {
  const { toast } = useToast();

  const [chatHistories, setChatHistories] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [expandedChatUserId, setExpandedChatUserId] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await authFetch('/api/admin/chat-histories');
      if (res.ok) {
        const data = await res.json();
        setChatHistories(data.histories || []);
      }
    } catch (error) {
      console.error('Failed to fetch chat histories:', error);
      toast({ title: "Error", description: "Failed to load chat histories", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const [chatToDelete, setChatToDelete] = useState<{ userId: string; userName: string } | null>(null);

  const handleDeleteChatHistory = (userId: string, userName: string) => {
    setChatToDelete({ userId, userName });
  };

  const handleConfirmDeleteChat = async () => {
    if (!chatToDelete) return;
    const { userId } = chatToDelete;
    setChatToDelete(null);

    try {
      const res = await authFetch(`/api/admin/chat-histories/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: "Success", description: "Chat history deleted" });
        setChatHistories(chatHistories.filter(h => h.userId !== userId));
        if (expandedChatUserId === userId) setExpandedChatUserId(null);
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to delete chat history", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    }
  };

  if (loadingData && chatHistories.length === 0) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const filtered = chatHistories.filter((h) => matchesSearch(h, chatSearchQuery));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              AI Chat Histories
            </CardTitle>
            <CardDescription>View all users' conversations with Grace Copilot</CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              placeholder="Search user or message..."
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              className="h-8 text-xs w-full sm:w-[200px] bg-transparent border-white/10"
            />
            <Button variant="outline" size="sm" onClick={fetchChats} disabled={loadingData} className="whitespace-nowrap">
              {loadingData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {chatHistories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No chat histories found</p>
              <p className="text-sm mt-1">Users haven't started any AI conversations yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground mb-2">
                Showing {filtered.length} of {chatHistories.length} users with chat history
              </div>
              {filtered.map((history: any) => (
                <div key={history.userId} className="rounded-xl border border-white/5 bg-zinc-900/50 overflow-hidden">
                  <div
                    onClick={() => setExpandedChatUserId(
                      expandedChatUserId === history.userId ? null : history.userId
                    )}
                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-sm font-bold">
                        {(history.userName || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{history.userName}</p>
                        <p className="text-xs text-muted-foreground">{history.userEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">
                          {history.conversationCount ?? 1} conversation{(history.conversationCount ?? 1) === 1 ? '' : 's'} · {history.messageCount} messages · {(history.sizeBytes / 1024).toFixed(1)} KB
                        </p>
                        {history.updatedAt && (
                          <p className="text-[10px] text-muted-foreground/60">
                            Last active: {new Date(history.updatedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChatHistory(history.userId, history.userName);
                          }}
                          title="Delete chat history"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {expandedChatUserId === history.userId
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        }
                      </div>
                    </div>
                  </div>

                  {expandedChatUserId === history.userId && (
                    <div className="border-t border-white/5 bg-transparent/50 max-h-[500px] overflow-y-auto">
                      <div className="p-4 space-y-4">
                        {(history.conversations?.length
                          ? history.conversations
                          : [{ id: 'legacy', title: 'Conversation', messages: history.messages || [] }]
                        ).map((conv: any) => (
                          <div key={conv.id} className="rounded-lg border border-white/5 bg-black/20 overflow-hidden">
                            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-zinc-300 truncate">{conv.title || 'Conversation'}</p>
                              <p className="text-[10px] text-zinc-500 shrink-0">
                                {conv.messageCount ?? conv.messages?.length ?? 0} msgs
                                {conv.updatedAt ? ` · ${new Date(conv.updatedAt).toLocaleString()}` : ''}
                              </p>
                            </div>
                            <div className="p-3 space-y-3">
                              {(conv.messages || []).length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-2">No messages</p>
                              ) : (
                                (conv.messages || []).map((msg: any, idx: number) => (
                                  <div key={msg.id || idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                                      msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-tr-sm'
                                        : 'bg-zinc-800 border border-white/5 text-zinc-200 rounded-tl-sm'
                                    }`}>
                                      {msg.role === 'user' ? (
                                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                      ) : (
                                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-snug prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
                                          <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                              a: ({ node, ...props }) => (
                                                <a {...props} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-400 hover:text-blue-300">
                                                  {props.children}
                                                  <ExternalLink className="w-3 h-3 opacity-70" />
                                                </a>
                                              )
                                            }}
                                          >
                                            {msg.content}
                                          </ReactMarkdown>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!chatToDelete}
        onOpenChange={(open) => { if (!open) setChatToDelete(null); }}
        icon={<Trash2 />}
        title="Delete Chat History"
        description={<>This will permanently delete the chat history for <span className="font-bold text-white">{chatToDelete?.userName}</span>.</>}
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteChat}
      />
    </div>
  );
}
