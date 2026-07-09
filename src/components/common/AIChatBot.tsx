"use client";

import React, { useState, useRef, useEffect, FormEvent, useCallback } from "react";
import { Bot, X, Send, Sparkles, User, Loader2, ExternalLink, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getFullUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { motion, useAnimation } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function AIChatBot() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragControls = useAnimation();

  useEffect(() => {
    const handleResize = () => {
      if (side === 'right') {
        dragControls.set({ x: window.innerWidth - 60 });
      } else {
        dragControls.set({ x: 0 });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [side, dragControls]);

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

  // Load chat history from server on first open
  useEffect(() => {
    if (!isOpen || historyLoaded || !currentUser) return;

    const loadHistory = async () => {
      try {
        const res = await fetch(getFullUrl("/api/ai/chat/history"), {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          }
        }
      } catch (err) {
        // Silently fail — user just won't see old messages
        console.error("Failed to load chat history:", err);
      } finally {
        setHistoryLoaded(true);
      }
    };

    loadHistory();
  }, [isOpen, historyLoaded, getAuthHeaders, currentUser]);

  // Save chat history to server
  const saveHistory = useCallback(async (msgs: Message[]) => {
    if (msgs.length === 0) return;
    try {
      await fetch(getFullUrl("/api/ai/chat/history"), {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
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
  }, [getAuthHeaders]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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

      // Auto-save to server after each exchange
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
      await fetch(getFullUrl("/api/ai/chat/history"), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error("Failed to clear chat history:", err);
    }
  };

  const setQuickPrompt = (text: string) => {
    setInput(text);
  };

  return (
    <>
      {/* Floating Button */}
      <motion.div
        drag
        dragMomentum={false}
        animate={dragControls}
        onDragEnd={(e, info) => {
          if (typeof window !== 'undefined') {
            if (info.point.x > window.innerWidth / 2) {
              setSide('right');
              dragControls.start({ x: window.innerWidth - 60, transition: { type: "spring", bounce: 0.2, duration: 0.5 } });
            } else {
              setSide('left');
              dragControls.start({ x: 0, transition: { type: "spring", bounce: 0.2, duration: 0.5 } });
            }
          }
        }}
        whileDrag={{ scale: 1.05 }}
        className={`fixed bottom-20 sm:bottom-6 left-0 z-50 ${isOpen ? (side === 'left' ? "-translate-x-full" : "translate-x-full") + " opacity-0 pointer-events-none" : "translate-x-0 opacity-100"}`}
        style={{ touchAction: "none" }}
      >
        <button
          onClick={() => setIsOpen(true)}
          className={`py-3 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center border cursor-grab active:cursor-grabbing bg-zinc-900 border-zinc-800 text-blue-500 ${
            side === 'left' 
              ? 'pl-3 pr-4 rounded-r-2xl border-l-0 hover:pr-5' 
              : 'pr-3 pl-4 rounded-l-2xl border-r-0 hover:pl-5'
          }`}
          aria-label="Open AI Assistant"
        >
          <Sparkles className="w-7 h-7 animate-flame pointer-events-none" />
        </button>
      </motion.div>

      {/* Chat Window */}
      <div
        className={`fixed bottom-[60px] sm:bottom-6 w-full sm:max-w-md bg-zinc-950 border border-zinc-800 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 z-50 ${
          side === 'left' ? 'left-0 sm:left-6 origin-bottom-left' : 'right-0 sm:right-6 origin-bottom-right'
        } ${isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"}`}
        style={{ height: "600px", maxHeight: "calc(100vh - 80px)" }}
      >
        {/* Header */}
        <div className="bg-zinc-900 border-b border-zinc-800 p-4 text-zinc-100 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg text-blue-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight text-blue-500">Grace Copilot</h3>
              <p className="text-zinc-400 text-xs">Worship Ministry Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-zinc-950">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : !currentUser ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950 text-center space-y-6">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500 animate-pulse">
              <Sparkles className="w-8 h-8 animate-bounce" />
            </div>
            <div className="space-y-2 max-w-xs">
              <h4 className="font-bold text-lg text-zinc-200">
                Unlock Grace Copilot
              </h4>
              <p className="text-sm text-zinc-400">
                Please sign in to start chatting with your AI worship ministry assistant.
              </p>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/login");
              }}
              className="w-full max-w-[240px] py-2.5 px-4 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl shadow-lg active:scale-95 transition-all text-sm animate-pulse"
            >
              Sign In to Chat
            </button>
          </div>
        ) : (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 flex flex-col gap-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 px-4 space-y-4">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-300">I'm your worship assistant.</p>
                    <p className="text-sm mt-1">Ask me to suggest setlists, check vocal ranges, or find songs in your library.</p>
                  </div>
                  <div className="grid gap-2 w-full mt-4">
                    <button
                      onClick={() => setQuickPrompt("Suggest an upbeat worship set for this Sunday")}
                      className="text-xs bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-left hover:bg-zinc-800 transition-colors"
                    >
                      "Suggest an upbeat worship set for this Sunday"
                    </button>
                    <button
                      onClick={() => setQuickPrompt("What key is best for a female leading 'Way Maker'?")}
                      className="text-xs bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-left hover:bg-zinc-800 transition-colors"
                    >
                      "What key is best for a female leading 'Way Maker'?"
                    </button>
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[85%] gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Avatar */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${m.role === "user"
                        ? "bg-zinc-800 text-zinc-300"
                        : "bg-blue-500/20 text-blue-500"
                        }`}
                    >
                      {m.role === "user" ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`p-3 rounded-2xl ${m.role === "user"
                        ? "bg-red-700 text-white rounded-tr-sm"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm shadow-sm"
                        }`}
                    >
                      {m.role === "user" ? (
                        <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <div className="text-sm prose prose-sm prose-invert max-w-none prose-p:leading-snug prose-table:w-full prose-table:my-4 prose-th:text-left prose-th:text-zinc-400 prose-th:font-medium prose-th:pb-2 prose-th:border-b prose-th:border-zinc-800 prose-td:py-3 prose-td:border-b prose-td:border-zinc-800/50">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ node, ...props }) => (
                                <a
                                  {...props}
                                  className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-500 px-3 py-2 rounded-lg font-semibold no-underline hover:bg-blue-500/30 transition-all shadow-sm my-1 border border-blue-500/30 w-fit max-w-full"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <span className="leading-tight text-left break-words">{props.children}</span>
                                  <ExternalLink className="w-4 h-4 shrink-0 opacity-70" />
                                </a>
                              ),
                              ol: ({ node, ...props }) => (
                                <ol className="flex flex-col gap-2 my-4 list-none p-0 w-full" style={{ counterReset: "options" }} {...props} />
                              ),
                              li: ({ node, children, ...props }: React.ComponentPropsWithoutRef<'li'> & { node?: unknown }) => {
                                // @ts-expect-error - hast Element type is too complex to inline
                                const isOrdered = node?.parent?.tagName === 'ol' || node?.parent?.type === 'element' && node?.parent?.tagName === 'ol';

                                if (isOrdered) {
                                  return (
                                    <li className="flex w-full m-0 p-0" {...props}>
                                      <button
                                        onClick={() => {
                                          let text = "";
                                          const extractText = (childArray: React.ReactNode) => {
                                            React.Children.forEach(childArray, child => {
                                              if (typeof child === 'string') text += child;
                                              else if (React.isValidElement(child)) {
                                                const childProps = child.props as Record<string, unknown>;
                                                extractText(childProps?.children as React.ReactNode);
                                              }
                                            });
                                          };
                                          extractText(children);
                                          setQuickPrompt(text.trim());
                                        }}
                                        className="w-full text-left bg-zinc-800/50 hover:bg-zinc-800 text-zinc-200 p-3 rounded-xl border border-zinc-800 transition-colors flex items-center gap-3 text-sm group"
                                      >
                                        <span
                                          className="flex-shrink-0 w-6 h-6 rounded bg-zinc-900 flex items-center justify-center text-xs font-medium text-zinc-400 group-hover:bg-zinc-800 transition-colors before:content-[counter(options)]"
                                          style={{ counterIncrement: "options" }}
                                        />
                                        <span className="flex-1">{children}</span>
                                      </button>
                                    </li>
                                  );
                                }
                                return <li className="mb-1 ml-4 list-disc" {...props}>{children}</li>;
                              }
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex max-w-[85%] gap-2 flex-row">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mt-1 text-blue-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 rounded-tl-sm shadow-sm flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error Display */}
            {error && (
              <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs text-center">
                {error}
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 bg-zinc-950 border-t border-zinc-800">
              {aiEnabled ? (
                <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
                  <textarea
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none text-zinc-100 placeholder:text-zinc-500"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Grace Copilot..."
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (input.trim()) {
                          const form = e.currentTarget.form;
                          if (form) form.requestSubmit();
                        }
                      }
                    }}
                    style={{ minHeight: "44px", maxHeight: "120px" }}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 bottom-2 p-2 rounded-lg bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-700 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-zinc-900 rounded-xl text-center text-sm text-zinc-500 border border-zinc-800">
                  <p>AI Assistant is currently disabled by the administrator.</p>
                </div>
              )}
              <div className="text-center mt-2">
                <span className="text-[10px] text-zinc-500">
                  Grace AI can make mistakes. Verify keys and chords.
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
