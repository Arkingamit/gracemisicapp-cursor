"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ChevronDown,
  Loader2,
  MessageSquare,
  Music2,
  PanelLeft,
  Plus,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { getFullUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/prompt-kit/markdown";
import { createGraceChatMarkdownComponents } from "@/components/prompt-kit/grace-chat-markdown";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input";
import { SystemMessage } from "@/components/prompt-kit/system-message";
import SongSetPicker, {
  type ActiveSongSet,
  type ChatSongRef,
} from "@/components/common/SongSetPicker";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";

const SONGSET_CONVERSATION_KEY = "grace_ai_songset_conversation_id";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  selectableSongs?: ChatSongRef[];
}

function createConversationId() {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `songset_${suffix}`;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "I'll help you build a song set.\n\nTell me:\n1. **Organization** (if you have more than one)\n2. **Set name** (e.g. Sunday Morning Worship)\n3. **Theme or songs** you want\n\nOnce the set is created, I'll show checkboxes so you can add songs.",
};

export default function SongSetAIBuilder() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [activeSongSet, setActiveSongSet] = useState<ActiveSongSet | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [awaitingMoreSongs, setAwaitingMoreSongs] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [conversations, setConversations] = useState<
    { id: string; title: string; messageCount: number; updatedAt: string }[]
  >([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const keyboardInset = useKeyboardInset(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, []);

  // Always start a fresh chat when entering Song Set AI
  useEffect(() => {
    const id = createConversationId();
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SONGSET_CONVERSATION_KEY, id);
    }
    setConversationId(id);
    setMessages([WELCOME_MESSAGE]);
    setActiveSongSet(null);
    setAwaitingMoreSongs(false);
    setHistoryLoaded(true);
    startedRef.current = true;
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch(getFullUrl("/api/settings"));
        if (res.ok) {
          const data = await res.json();
          setAiEnabled(data.enable_ai_chat ?? true);
        }
      } catch {
        // ignore
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (keyboardInset <= 0) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      inputAreaRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  }, [keyboardInset]);

  // Load this song-set conversation (or seed welcome for a brand-new one)
  useEffect(() => {
    if (!currentUser || !conversationId || historyLoaded) return;

    const load = async () => {
      try {
        const res = await fetch(
          getFullUrl(
            `/api/ai/chat/history?conversationId=${encodeURIComponent(conversationId)}&channel=song-set`
          ),
          { headers: getAuthHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(
              data.messages.map((m: Message) => ({
                id: m.id,
                role: m.role,
                content: m.content,
              }))
            );
            startedRef.current = true;
          } else if (!startedRef.current) {
            startedRef.current = true;
            setMessages([WELCOME_MESSAGE]);
          }
        } else if (!startedRef.current) {
          startedRef.current = true;
          setMessages([WELCOME_MESSAGE]);
        }
      } catch {
        if (!startedRef.current) {
          startedRef.current = true;
          setMessages([WELCOME_MESSAGE]);
        }
      } finally {
        setHistoryLoaded(true);
      }
    };

    void load();
  }, [currentUser, conversationId, historyLoaded, getAuthHeaders]);

  const saveHistory = useCallback(
    async (msgs: Message[]) => {
      if (!conversationId) return;
      const toSave = msgs.filter((m) => m.id !== "welcome" || msgs.length > 1);
      if (toSave.length === 0) return;
      try {
        await fetch(getFullUrl("/api/ai/chat/history"), {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            conversationId,
            channel: "song-set",
            messages: toSave.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            })),
          }),
        });
      } catch {
        // ignore
      }
    },
    [conversationId, getAuthHeaders]
  );

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setError(null);
    setAwaitingMoreSongs(false);

    try {
      const res = await fetch(getFullUrl("/api/ai/chat"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          messages: updatedMessages
            .filter((m) => m.id !== "welcome")
            .map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              content: m.content,
            })),
          activeSongSetId: activeSongSet?.id || null,
          mode: "song-set",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${res.status})`);
      }

      const data = await res.json();

      if (data.activeSongSet) {
        setActiveSongSet(data.activeSongSet);
      }

      let selectable: ChatSongRef[] = data.selectableSongs || [];
      if ((!selectable || selectable.length === 0) && data.content) {
        const idMatches = [
          ...String(data.content).matchAll(/\/songs\/view\?id=([a-f0-9]{24})/gi),
        ].map((m) => m[1]);
        if (idMatches.length) {
          const unique = [...new Set(idMatches)];
          selectable = unique.map((id) => {
            const linkRe = new RegExp(
              `\\[([^\\]]+)\\]\\(/songs/view\\?id=${id}\\)`,
              "i"
            );
            const titleMatch = String(data.content).match(linkRe);
            return {
              id,
              title: titleMatch?.[1]?.trim() || "Song",
            };
          });
        }
      }

      const inSet = new Set(
        (data.activeSongSet?.songs || activeSongSet?.songs || []).map(
          (s: ChatSongRef) => s.id
        )
      );
      selectable = selectable.filter((s) => !inSet.has(s.id));

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
        ...(selectable.length ? { selectableSongs: selectable } : {}),
      };

      setMessages([...updatedMessages, assistantMessage]);
      void saveHistory([...updatedMessages, assistantMessage]);
    } catch (err) {
      console.error("Song set AI error:", err);
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    void sendMessage(input);
  };

  const handleSongsAdded = (info: {
    addedTitles: string[];
    set: ActiveSongSet;
  }) => {
    setActiveSongSet(info.set);

    const names =
      info.addedTitles.length === 1
        ? `**${info.addedTitles[0]}**`
        : info.addedTitles.map((t) => `**${t}**`).join(", ");
    const count = info.addedTitles.length;
    const followUp: Message = {
      id: `added_${Date.now()}`,
      role: "assistant",
      content:
        count > 0
          ? `Added ${names} to **${info.set.name}**.\n\nWant to add more songs? If yes, type the song name (or a theme) below and I’ll find matches for you.`
          : `Songs added to **${info.set.name}**.\n\nWant to add more? If yes, type the song name below.`,
    };

    // Collapse checkboxes + ask follow-up in one update
    setMessages((prev) => {
      const next = [
        ...prev.map((m) =>
          m.selectableSongs?.length ? { ...m, selectableSongs: undefined } : m
        ),
        followUp,
      ];
      void saveHistory(next);
      return next;
    });
    setAwaitingMoreSongs(true);
  };

  const handleCancelSongPicker = () => {
    setMessages((prev) => {
      const next = [
        ...prev.map((m) =>
          m.selectableSongs?.length ? { ...m, selectableSongs: undefined } : m
        ),
        {
          id: `cancel_picker_${Date.now()}`,
          role: "assistant" as const,
          content:
            "No problem — skipped those songs. Type a song name (or a theme) whenever you want to add some.",
        },
      ];
      void saveHistory(next);
      return next;
    });
  };

  const handleDoneAdding = () => {
    setAwaitingMoreSongs(false);
    setMessages((prev) => {
      const next: Message[] = [
        ...prev,
        {
          id: `done_${Date.now()}`,
          role: "user",
          content: "No, I'm done",
        },
        {
          id: `done_reply_${Date.now()}`,
          role: "assistant",
          content: `Great — **${activeSongSet?.name || "your set"}** is ready with ${
            activeSongSet?.songs.length || 0
          } song${(activeSongSet?.songs.length || 0) === 1 ? "" : "s"}. You can open it anytime from Sets.`,
        },
      ];
      void saveHistory(next);
      return next;
    });
  };

  const handleWantMore = () => {
    setAwaitingMoreSongs(false);
    setInput("");
    setMessages((prev) => {
      const next: Message[] = [
        ...prev,
        {
          id: `more_${Date.now()}`,
          role: "user",
          content: "Yes, add more",
        },
        {
          id: `more_reply_${Date.now()}`,
          role: "assistant",
          content:
            "Sure — type the song name (or a theme like “communion”) and I’ll show checkboxes to add.",
        },
      ];
      void saveHistory(next);
      return next;
    });
  };

  const openHistorySidebar = async () => {
    setMenuOpen(false);
    setHistoryOpen(true);
    setLoadingConversations(true);
    try {
      const res = await fetch(
        getFullUrl("/api/ai/chat/history?channel=song-set"),
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error("Failed to load song-set history:", err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const startNewConversation = () => {
    const id = createConversationId();
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SONGSET_CONVERSATION_KEY, id);
    }
    setConversationId(id);
    setMessages([WELCOME_MESSAGE]);
    setActiveSongSet(null);
    setAwaitingMoreSongs(false);
    setHistoryLoaded(true);
    setError(null);
    setHistoryOpen(false);
    setMenuOpen(false);
    startedRef.current = true;
  };

  const switchConversation = (id: string) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SONGSET_CONVERSATION_KEY, id);
    }
    setConversationId(id);
    setMessages([]);
    setActiveSongSet(null);
    setAwaitingMoreSongs(false);
    setHistoryLoaded(false);
    setError(null);
    setHistoryOpen(false);
    setMenuOpen(false);
    startedRef.current = false;
  };

  const deleteConversation = async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) {
      startNewConversation();
    }
    try {
      await fetch(
        getFullUrl(
          `/api/ai/chat/history?conversationId=${encodeURIComponent(id)}`
        ),
        { method: "DELETE", headers: getAuthHeaders() }
      );
    } catch (err) {
      console.error("Failed to delete song-set conversation:", err);
    }
  };

  // After adding songs — yes/no chips
  const showMoreSongReplies = awaitingMoreSongs && !isLoading;

  const markdownComponents = useMemo(
    () =>
      createGraceChatMarkdownComponents((href) => {
        // Full-screen builder — navigate away so the song page is visible
        router.push(href);
      }),
    [router]
  );

  if (!currentUser) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center bg-[#07070a]">
        <p className="text-zinc-400">Sign in to create a song set with AI.</p>
        <Button onClick={() => router.push("/login")}>Sign in</Button>
      </div>
    );
  }

  return (
    <div
      data-tour="ai-songset-panel"
      className="fixed inset-x-0 top-0 z-[60] flex flex-col bg-[#07070a] text-zinc-100 overflow-hidden font-ai"
      style={{
        top: 0,
        bottom: keyboardInset,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),_transparent_55%)]"
      />

      {/* ChatGPT-style top bar */}
      <header className="relative z-20 shrink-0 border-b border-white/[0.06] bg-[#07070a]/90 px-3 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => void openHistorySidebar()}
              className="rounded-lg p-2 text-zinc-200 hover:bg-white/10 transition-colors"
              aria-label="Open chat history"
              title="History"
            >
              {/* ChatGPT-like two-line sidebar icon */}
              <span className="flex h-5 w-5 flex-col justify-center gap-[5px]" aria-hidden>
                <span className="block h-[1.5px] w-5 rounded-full bg-current" />
                <span className="block h-[1.5px] w-3.5 rounded-full bg-current" />
              </span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-zinc-100 hover:bg-white/10 transition-colors"
              >
                <span className="text-[15px] font-medium tracking-tight">Grace</span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-30"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute left-0 top-full z-40 mt-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#121218] shadow-xl">
                    <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500">
                      Song Set Builder
                    </p>
                    {activeSongSet && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          router.push(activeSongSet.link);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-200 hover:bg-white/5"
                      >
                        <Music2 className="h-4 w-4 text-indigo-300" />
                        Open “{activeSongSet.name}”
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/groups");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-200 hover:bg-white/5"
                    >
                      <PanelLeft className="h-4 w-4 text-zinc-400" />
                      Back to Sets
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={startNewConversation}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-100 transition-colors"
              aria-label="New chat"
              title="New chat"
            >
              <SquarePen className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setHistoryOpen(false);
                setMenuOpen(false);
                router.push("/groups");
              }}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-100 transition-colors"
              aria-label="Close"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* History sidebar (ChatGPT-style) */}
      {historyOpen && (
        <div className="absolute inset-0 z-30 flex">
          <aside className="flex h-full w-[min(100%,20rem)] flex-col border-r border-white/10 bg-[#0b0b10] shadow-2xl">
            <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-white/[0.06]">
              <p className="text-sm font-medium text-zinc-100">Chat history</p>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                aria-label="Close history"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-3 pt-3">
              <button
                type="button"
                onClick={startNewConversation}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
              {loadingConversations ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="px-3 py-8 text-center text-zinc-500 space-y-1">
                  <MessageSquare className="mx-auto h-7 w-7 opacity-40" />
                  <p className="text-sm">No chats yet</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                      conv.id === conversationId
                        ? "bg-white/10 text-zinc-50"
                        : "text-zinc-300 hover:bg-white/5"
                    }`}
                    onClick={() => switchConversation(conv.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{conv.title || "Conversation"}</p>
                      <p className="truncate text-[10px] text-zinc-500">
                        {conv.messageCount} msgs ·{" "}
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteConversation(conv.id);
                      }}
                      className="shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-red-500/15 hover:text-red-400"
                      aria-label="Delete chat"
                      title="Delete chat"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>
          <button
            type="button"
            className="flex-1 bg-black/50 backdrop-blur-[1px]"
            aria-label="Close history overlay"
            onClick={() => setHistoryOpen(false)}
          />
        </div>
      )}

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 min-h-0 flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <div className="flex items-center gap-3 py-2">
            <div className="h-px flex-1 bg-zinc-800/80" />
            <span className="text-[11px] text-zinc-500 font-medium">Today</span>
            <div className="h-px flex-1 bg-zinc-800/80" />
          </div>

          {messages.map((m, msgIdx) => {
            const isLastAssistant =
              m.role === "assistant" &&
              !messages.slice(msgIdx + 1).some((x) => x.role === "assistant");
            const showPicker =
              m.role === "assistant" &&
              ((m.selectableSongs && m.selectableSongs.length > 0) ||
                (isLastAssistant && !!activeSongSet));

            return (
              <div key={m.id} className="space-y-2">
                <div
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`min-w-0 max-w-[88%] px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      m.role === "user"
                        ? "rounded-[22px] rounded-br-md bg-indigo-600 text-white"
                        : "rounded-[22px] rounded-bl-md bg-[#16161c] text-zinc-100 border border-white/[0.06]"
                    } ${showPicker ? "w-full max-w-full" : ""}`}
                  >
                    {m.role === "user" ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <>
                        <Markdown
                          className="text-sm prose-invert max-w-none"
                          components={markdownComponents}
                        >
                          {m.content}
                        </Markdown>
                        {showPicker && (
                          <SongSetPicker
                            selectableSongs={m.selectableSongs || []}
                            activeSongSet={activeSongSet}
                            getAuthHeaders={getAuthHeaders}
                            onSetUpdated={setActiveSongSet}
                            onSongsAdded={handleSongsAdded}
                            onCancel={handleCancelSongPicker}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {showMoreSongReplies && (
            <div className="flex flex-col items-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleWantMore}
                className="rounded-full border border-indigo-400/50 bg-[#0c0c12]/90 px-4 py-2 text-sm text-indigo-300 shadow-sm transition-colors hover:bg-indigo-500/10 hover:border-indigo-300/70"
              >
                Yes — I&apos;ll type a song ✍️
              </button>
              <button
                type="button"
                onClick={handleDoneAdding}
                className="rounded-full border border-zinc-600/50 bg-[#0c0c12]/90 px-4 py-2 text-sm text-zinc-400 shadow-sm transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
              >
                No, I&apos;m done ✓
              </button>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-[22px] rounded-bl-md border border-white/[0.06] bg-[#16161c] px-5 py-3.5">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400/70 [animation-delay:-0.3s]" />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400/70 [animation-delay:-0.15s]" />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400/70" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="mx-4 mb-2">
            <SystemMessage
              variant="error"
              fill
              cta={{ label: "Dismiss", onClick: () => setError(null), variant: "ghost" }}
            >
              {error}
            </SystemMessage>
          </div>
        )}

        <div
          ref={inputAreaRef}
          className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
        >
          {aiEnabled ? (
            <PromptInput
              value={input}
              onValueChange={setInput}
              isLoading={isLoading}
              onSubmit={handleSubmit}
              disabled={isLoading}
              maxHeight={112}
              className="w-full border-white/10 bg-[#121218]/95 shadow-xl shadow-black/40 backdrop-blur"
            >
              <PromptInputTextarea
                placeholder={
                  awaitingMoreSongs
                    ? "Type a song name to add more…"
                    : "Ask Grace to build your set…"
                }
                className="text-zinc-100 placeholder:text-zinc-500"
              />
              <PromptInputActions className="justify-end pt-1">
                <PromptInputAction
                  tooltip={isLoading ? "Stop generation" : "Send message"}
                >
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30 hover:from-indigo-400 hover:to-violet-500 disabled:opacity-35"
                    disabled={!input.trim() && !isLoading}
                    onClick={handleSubmit}
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowUp className="size-4" />
                    )}
                  </Button>
                </PromptInputAction>
              </PromptInputActions>
            </PromptInput>
          ) : (
            <SystemMessage variant="warning" fill>
              AI Assistant is disabled by the administrator.
            </SystemMessage>
          )}
          {activeSongSet && (
            <p className="mt-2 text-center text-[10px] text-zinc-600">
              Set:{" "}
              <span className="text-indigo-400/80">{activeSongSet.name}</span>
              {" · "}
              {activeSongSet.songs.length} song
              {activeSongSet.songs.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
