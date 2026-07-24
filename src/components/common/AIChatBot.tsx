"use client";

import React, { useState, useRef, useEffect, FormEvent, useCallback, useMemo } from "react";
import { X, Sparkles, User, Loader2, Trash2, Plus, MessageSquare, ArrowUp, SquarePen, ArrowUpRight } from "lucide-react";
import { getFullUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { motion, useAnimation } from "framer-motion";
import { Markdown } from "@/components/prompt-kit/markdown";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input";
import { SystemMessage } from "@/components/prompt-kit/system-message";
import { Button } from "@/components/ui/button";
import type { Components } from "react-markdown";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";

const AI_CONVERSATION_SESSION_KEY = "grace_ai_conversation_id";

function createConversationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function AppLogoAvatar({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <div
      className={`mt-0.5 flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-400/25 bg-blue-500/10 p-1 shadow-sm shadow-blue-500/10 ${className}`}
    >
      <img
        src="/lovable-uploads/gracemain.png"
        alt="Grace"
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/** Normalize AI markdown so song chips and lists render cleanly. */
function normalizeAssistantContent(content: string): string {
  if (!content) return content;

  let text = content
    // Drop incomplete song links: [Title](/songs/view?id=) or empty/broken id
    .replace(/\[([^\]]*)\]\(\/songs\/view\?id=\s*\)/g, "$1")
    .replace(/\[([^\]]*)\]\(\/songs\/view\?id=(?![a-zA-Z0-9_-])[^)]*\)/g, "$1")
    // Separate jammed song links onto their own lines
    .replace(/\)[ \t]*\[/g, ")\n- [");

  text = text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const songOnly = trimmed.match(
        /^[-*•]?\s*\[([^\]]+)\]\(\/songs\/view\?id=([^)\s]+)\)\s*$/
      );
      if (songOnly) {
        return `- [${songOnly[1]}](/songs/view?id=${songOnly[2]})`;
      }
      return line;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

export default function AIChatBot() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hideOnSongSetBuilder = pathname?.startsWith("/groups/new/ai");
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const dragControls = useAnimation();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<
    { id: string; title: string; messageCount: number; updatedAt: string }[]
  >([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  /** Android/iOS keyboard overlap — lift fixed chat panel above the keyboard */
  const keyboardInset = useKeyboardInset(isOpen);

  // Seed a conversation id; openChat always starts a fresh chat.
  useEffect(() => {
    const id = createConversationId();
    if (typeof window !== "undefined") {
      sessionStorage.setItem(AI_CONVERSATION_SESSION_KEY, id);
    }
    setConversationId(id);
    setHistoryLoaded(true);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      dragControls.set({ x: window.innerWidth - 72, y: 0 });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dragControls]);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch(getFullUrl("/api/settings"));
        if (res.ok) {
          const data = await res.json();
          setAiEnabled(data.enable_ai_chat ?? true);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };
    loadSettings();
  }, []);

  // Reset chat if user logs out
  useEffect(() => {
    if (!currentUser) {
      setMessages([]);
      setHistoryLoaded(false);
    }
  }, [currentUser]);

  // Get auth token helper
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, []);

  // Load THIS session's conversation (empty if it's a brand-new app session)
  useEffect(() => {
    if (!isOpen || historyLoaded || !currentUser || !conversationId) return;

    const loadHistory = async () => {
      try {
        const res = await fetch(
          getFullUrl(`/api/ai/chat/history?conversationId=${encodeURIComponent(conversationId)}`),
          { headers: getAuthHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          } else {
            setMessages([]);
          }
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setHistoryLoaded(true);
      }
    };

    loadHistory();
  }, [isOpen, historyLoaded, getAuthHeaders, currentUser, conversationId]);

  // Save into the current conversation only
  const saveHistory = useCallback(async (msgs: Message[]) => {
    if (!conversationId) return;
    if (msgs.length === 0) return;
    try {
      await fetch(getFullUrl("/api/ai/chat/history"), {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          conversationId,
          channel: "copilot",
          messages: msgs.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        }),
      });
    } catch (err) {
      console.error("Failed to save chat history:", err);
    }
  }, [getAuthHeaders, conversationId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // When the keyboard opens, keep the latest message / input in view
  useEffect(() => {
    if (keyboardInset <= 0) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      inputAreaRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  }, [keyboardInset]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(getFullUrl("/api/ai/chat"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            content: m.content,
          })),
          mode: "normal",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${res.status})`);
      }

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveHistory(finalMessages);
    } catch (err) {
      console.error("AI Chat error:", err);
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    setMessages([]);
    try {
      const qs = conversationId
        ? `?conversationId=${encodeURIComponent(conversationId)}`
        : "";
      await fetch(getFullUrl(`/api/ai/chat/history${qs}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error("Failed to clear chat history:", err);
    }
  };

  // ── Conversation history (ChatGPT-style sidebar) ──
  const openHistorySidebar = async () => {
    setHistoryOpen(true);
    setLoadingConversations(true);
    try {
      const res = await fetch(getFullUrl("/api/ai/chat/history?channel=copilot"), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const switchConversation = (id: string) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(AI_CONVERSATION_SESSION_KEY, id);
    }
    setConversationId(id);
    setMessages([]);
    setHistoryLoaded(false); // triggers reload of the selected conversation
    setHistoryOpen(false);
  };

  const startNewConversation = () => {
    const id = createConversationId();
    if (typeof window !== "undefined") {
      sessionStorage.setItem(AI_CONVERSATION_SESSION_KEY, id);
    }
    setConversationId(id);
    setMessages([]);
    setHistoryLoaded(true); // brand new — nothing to load
    setHistoryOpen(false);
  };

  const deleteConversation = async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) {
      setMessages([]);
    }
    try {
      await fetch(getFullUrl(`/api/ai/chat/history?conversationId=${encodeURIComponent(id)}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const setQuickPrompt = (text: string) => {
    setInput(text);
  };

  const openChat = () => {
    startNewConversation();
    setIsOpen(true);
    setError(null);
  };

  const navigateFromChat = useCallback(
    (url: string) => {
      if (typeof document !== "undefined") {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      setHistoryOpen(false);
      setIsOpen(false);
      if (typeof window !== "undefined") {
        window.scrollTo(0, 0);
      }
      // Close first so the fixed overlay doesn't cover the destination page
      // (AIChatBot lives in the root layout and stays mounted across routes).
      router.push(url);
    },
    [router]
  );

  const markdownComponents: Partial<Components> = useMemo(
    () => ({
      p: ({ children }) => (
        <p className="my-2 text-[15px] leading-relaxed text-zinc-200 first:mt-0 last:mb-0">
          {children}
        </p>
      ),
      strong: ({ children }) => (
        <strong className="font-semibold text-zinc-50">{children}</strong>
      ),
      em: ({ children }) => <em className="italic text-zinc-400">{children}</em>,
      h1: ({ children }) => (
        <h1 className="mb-2 mt-3 text-base font-semibold text-zinc-50 first:mt-0">{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 className="mb-2 mt-3 text-[15px] font-semibold text-zinc-100 first:mt-0">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="mb-1.5 mt-2.5 text-sm font-semibold text-zinc-200 first:mt-0">{children}</h3>
      ),
      ul: ({ children }) => (
        <ul className="my-2.5 flex list-none flex-col gap-1.5 p-0 first:mt-0">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol
          className="my-2.5 flex list-none flex-col gap-1.5 p-0 first:mt-0"
          style={{ counterReset: "options" }}
        >
          {children}
        </ol>
      ),
      a: ({ children, href, ...props }) => {
        const url = typeof href === "string" ? href : "";
        const isInternal =
          url.startsWith("/") && !url.startsWith("//");
        const isSongLink = url.includes("/songs/view");
        if (isInternal) {
          return (
            <a
              {...props}
              href={url}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateFromChat(url);
              }}
              className={
                isSongLink
                  ? "my-1 inline-flex max-w-full cursor-pointer items-center gap-1 text-[15px] font-medium text-blue-400 no-underline transition-colors hover:text-blue-300"
                  : "inline-flex items-center gap-1 text-blue-400 underline underline-offset-2 hover:text-blue-300"
              }
            >
              <span className="min-w-0 break-words underline underline-offset-2 decoration-blue-400/80">
                {children}
              </span>
              {isSongLink && (
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-blue-400" />
              )}
            </a>
          );
        }
        return (
          <a
            {...props}
            href={url}
            className="inline-flex items-center gap-1 text-blue-400 underline underline-offset-2 hover:text-blue-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </a>
        );
      },
      blockquote: ({ children }) => (
        <blockquote className="my-3 border-l-2 border-white/15 pl-3 text-zinc-400 italic">
          {children}
        </blockquote>
      ),
      li: ({ node, children, ...props }: React.ComponentPropsWithoutRef<"li"> & { node?: any }) => {
        const isOrdered =
          node?.parent?.tagName === "ol" ||
          (node?.parent?.type === "element" && node?.parent?.tagName === "ol");

        const childArr = React.Children.toArray(children);
        const hasSongLink = childArr.some((child) => {
          if (!React.isValidElement(child)) return false;
          const childHref = (child.props as { href?: string })?.href || "";
          return typeof childHref === "string" && childHref.includes("/songs/view");
        });

        if (hasSongLink) {
          return (
            <li className="m-0 list-none p-0" {...props}>
              {children}
            </li>
          );
        }

        if (isOrdered) {
          return (
            <li className="m-0 flex w-full list-none p-0" {...props}>
              <button
                type="button"
                onClick={() => {
                  let text = "";
                  const extractText = (childArray: React.ReactNode) => {
                    React.Children.forEach(childArray, (child) => {
                      if (typeof child === "string") text += child;
                      else if (React.isValidElement(child)) {
                        const childProps = child.props as Record<string, unknown>;
                        extractText(childProps?.children as React.ReactNode);
                      }
                    });
                  };
                  extractText(children);
                  setQuickPrompt(text.trim());
                }}
                className="group flex w-full items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-left text-sm text-zinc-200 transition-colors hover:border-blue-400/40 hover:bg-blue-500/10"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-500/15 text-xs font-medium text-blue-300 before:content-[counter(options)]"
                  style={{ counterIncrement: "options" }}
                />
                <span className="min-w-0 flex-1 leading-snug">{children}</span>
              </button>
            </li>
          );
        }

        return (
          <li className="my-0.5 flex items-start gap-2.5 text-[15px] leading-relaxed text-zinc-200" {...props}>
            <span className="mt-2.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/80" />
            <span className="min-w-0 flex-1">{children}</span>
          </li>
        );
      },
    }),
    [navigateFromChat]
  );

  // Dedicated Song Set Builder page — hide FAB Copilot entirely
  if (hideOnSongSetBuilder) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <motion.div
        drag
        dragMomentum={false}
        animate={dragControls}
        onDragEnd={(e, info) => {
          if (typeof window !== 'undefined') {
            dragControls.start({ x: window.innerWidth - 72, y: 0, rotate: 0, transition: { type: "spring", bounce: 0.2, duration: 0.5 } });
          }
        }}
        whileDrag={{ scale: 1.05 }}
        data-tour="ai-chatbot"
        className={`fixed bottom-20 sm:bottom-6 left-0 z-50 w-14 ${isOpen ? "translate-x-full opacity-0 pointer-events-none" : "translate-x-0 opacity-100"}`}
        style={{ touchAction: "none" }}
      >
        <button
          onClick={openChat}
          className="ml-2 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-violet-600 text-white border border-white/15 shadow-lg shadow-blue-600/40 hover:shadow-blue-500/50 hover:scale-105 transition-all duration-300 flex items-center justify-center cursor-grab active:cursor-grabbing"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="w-7 h-7 pointer-events-none" />
        </button>
      </motion.div>

      <div
        data-tour="ai-chat-panel"
        className={`fixed inset-x-0 top-0 bottom-0 z-[100] flex w-full flex-col overflow-hidden bg-background font-ai transition-[opacity,transform] duration-300 md:bottom-24 md:left-auto md:right-6 md:top-auto md:h-[650px] md:max-h-[calc(100vh-8rem)] md:w-[400px] md:rounded-2xl md:border md:border-white/10 md:shadow-2xl ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={
          {
            // iOS overlay keyboard only — Android uses adjustResize (inset stays 0)
            bottom: keyboardInset > 0 ? keyboardInset : undefined,
            ["--keyboard-inset" as string]: `${keyboardInset}px`,
          } as React.CSSProperties
        }
      >
        {/* Soft brand wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.08),_transparent_50%)]"
        />

        {/* Header — ChatGPT-style history + new chat */}
        <div className="relative z-20 flex shrink-0 items-center justify-between border-b border-blue-500/10 bg-zinc-950/80 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-foreground backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-1">
            {currentUser && (
              <button
                type="button"
                onClick={() => void openHistorySidebar()}
                className="shrink-0 rounded-full p-2 text-zinc-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
                title="Chat history"
                aria-label="Open chat history"
              >
                <span className="flex h-5 w-5 flex-col justify-center gap-[5px]" aria-hidden>
                  <span className="block h-[1.5px] w-5 rounded-full bg-current" />
                  <span className="block h-[1.5px] w-3.5 rounded-full bg-current" />
                </span>
              </button>
            )}
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-blue-400/20 bg-blue-500/10 p-1 shadow-sm shadow-blue-500/10">
                <img
                  src="/lovable-uploads/gracemain.png"
                  alt="Grace Music"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold leading-tight text-blue-400">Grace Copilot</h3>
                <p className="truncate text-xs text-zinc-400">Worship Ministry Assistant</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {currentUser && (
              <button
                type="button"
                onClick={startNewConversation}
                className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
                title="New chat"
                aria-label="New chat"
              >
                <SquarePen className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (typeof document !== "undefined") {
                  (document.activeElement as HTMLElement | null)?.blur?.();
                }
                setHistoryOpen(false);
                setIsOpen(false);
                if (typeof window !== "undefined") {
                  window.scrollTo(0, 0);
                }
              }}
              className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* History sidebar overlay */}
        {historyOpen && currentUser && (
          <div className="absolute inset-0 z-30 flex">
            <aside className="flex h-full w-[min(100%,18rem)] flex-col border-r border-white/5 bg-background shadow-2xl">
              <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-white/5">
                <p className="text-sm font-medium text-zinc-100">Chat history</p>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  aria-label="Close history"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-3 pt-3">
                <button
                  type="button"
                  onClick={startNewConversation}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  New chat
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 space-y-1 [-webkit-overflow-scrolling:touch]">
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
                          ? "bg-secondary text-zinc-50"
                          : "text-zinc-300 hover:bg-zinc-900"
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
                        className="shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
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

        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-background">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        ) : !currentUser ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background text-center space-y-6">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center text-zinc-300 border border-white/5">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-2 max-w-xs">
              <h4 className="font-semibold text-lg text-zinc-200">
                Unlock Grace Copilot
              </h4>
              <p className="text-sm text-muted-foreground">
                Please sign in to start chatting with your AI worship ministry assistant.
              </p>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/login");
              }}
              className="w-full max-w-[240px] py-2.5 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-zinc-200 active:scale-95 transition-all text-sm"
            >
              Sign In to Chat
            </button>
          </div>
        ) : (
          <>
            {/* Messages Area — min-h-0 required so flex child can scroll on iOS WKWebView */}
            <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain bg-transparent p-4 [-webkit-overflow-scrolling:touch]">
              {messages.length === 0 && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center space-y-4 px-4 py-6 text-center text-muted-foreground">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-400/25 bg-blue-500/10 p-2 shadow-lg shadow-blue-500/10">
                    <img src="/lovable-uploads/gracemain.png" alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200">I'm your worship assistant.</p>
                    <p className="mt-1 text-sm text-zinc-400">Ask me to suggest setlists, check vocal ranges, or find songs in your library.</p>
                  </div>
                </div>
              )}

              {messages.map((m) => {
                return (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-3 ${m.role === "user" ? "max-w-[88%] flex-row-reverse" : "w-full max-w-[92%] flex-row"}`}>
                    {m.role === "user" ? (
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/20 text-violet-200">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <AppLogoAvatar />
                    )}

                    <div
                      className={`min-w-0 rounded-2xl px-3.5 py-3 ${m.role === "user"
                        ? "rounded-tr-sm border border-violet-400/25 bg-gradient-to-br from-violet-600/40 to-blue-600/30 text-zinc-50 shadow-sm shadow-violet-500/10"
                        : "flex-1 rounded-tl-sm border border-white/[0.08] bg-zinc-900/50 text-zinc-200"
                        }`}
                    >
                      {m.role === "user" ? (
                        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</p>
                      ) : (
                        <Markdown
                          className="max-w-none text-[15px] leading-relaxed"
                          components={markdownComponents}
                        >
                          {normalizeAssistantContent(m.content)}
                        </Markdown>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex max-w-[85%] flex-row gap-3">
                    <AppLogoAvatar className="h-8 w-8" />
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-blue-400/20 bg-blue-500/10 p-4">
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]"></div>
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]"></div>
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-300"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error Display */}
            {error && (
              <div className="relative z-10 px-3 py-2">
                <SystemMessage
                  variant="error"
                  fill
                  cta={{ label: "Dismiss", onClick: () => setError(null), variant: "ghost" }}
                >
                  {error}
                </SystemMessage>
              </div>
            )}

            {/* Input Area */}
            <div
              ref={inputAreaRef}
              className="relative z-10 shrink-0 space-y-2 border-t border-blue-500/10 bg-zinc-950/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md"
            >
              {aiEnabled ? (
                <PromptInput
                  value={input}
                  onValueChange={setInput}
                  isLoading={isLoading}
                  onSubmit={() => void handleSubmit()}
                  disabled={isLoading}
                  maxHeight={120}
                  className="w-full border-blue-500/20 bg-zinc-900/80 focus-within:border-blue-400/40"
                >
                  <PromptInputTextarea
                    placeholder="Ask Grace Copilot..."
                    className="text-base text-zinc-100 placeholder:text-zinc-500 md:text-sm"
                  />
                  <PromptInputActions className="justify-end pt-1">
                    <PromptInputAction
                      tooltip={isLoading ? "Stop generation" : "Send message"}
                    >
                      <Button
                        type="button"
                        variant="default"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-md shadow-blue-600/30 hover:from-blue-400 hover:to-violet-500 disabled:opacity-50"
                        disabled={!input.trim() && !isLoading}
                        onClick={() => void handleSubmit()}
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
                  AI Assistant is currently disabled by the administrator.
                </SystemMessage>
              )}
              <SystemMessage variant="action" fill isIconHidden className="justify-center py-1.5 text-center text-[10px] text-zinc-500">
                Grace AI can make mistakes. Verify keys and chords.
              </SystemMessage>
            </div>
          </>
        )}
      </div>
    </>
  );
}
