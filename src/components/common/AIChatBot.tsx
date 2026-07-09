"use client";

import React, { useState, useRef, useEffect, FormEvent, useCallback } from "react";
import { Bot, X, Send, Sparkles, User, Loader2, ExternalLink, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getFullUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    } catch (err: any) {
      console.error("AI Chat error:", err);
      setError(err.message || "Something went wrong. Please try again.");
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
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 sm:bottom-6 right-6 p-4 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105 hover:shadow-xl transition-all duration-300 z-50 flex items-center justify-center ${isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"}`}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="w-6 h-6 animate-pulse" />
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-[72px] sm:bottom-6 right-0 sm:right-6 w-full sm:max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform origin-bottom-right z-50 ${isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"}`}
        style={{ height: "600px", maxHeight: "calc(100vh - 80px)" }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Grace Copilot</h3>
              <p className="text-blue-100 text-xs">Worship Ministry Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">

            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        ) : !currentUser ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-950 text-center space-y-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 animate-pulse">
              <Bot className="w-8 h-8 animate-bounce" />
            </div>
            <div className="space-y-2 max-w-xs">
              <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200">
                Unlock Grace Copilot
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Please sign in to start chatting with your AI worship ministry assistant.
              </p>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/login");
              }}
              className="w-full max-w-[240px] py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-sm animate-pulse"
            >
              Sign In to Chat
            </button>
          </div>
        ) : (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-950 flex flex-col gap-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 px-4 space-y-4">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">I'm your worship assistant.</p>
                    <p className="text-sm mt-1">Ask me to suggest setlists, check vocal ranges, or find songs in your library.</p>
                  </div>
                  <div className="grid gap-2 w-full mt-4">
                    <button
                      onClick={() => setQuickPrompt("Suggest an upbeat worship set for this Sunday")}
                      className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      "Suggest an upbeat worship set for this Sunday"
                    </button>
                    <button
                      onClick={() => setQuickPrompt("What key is best for a female leading 'Way Maker'?")}
                      className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        : "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                        }`}
                    >
                      {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`p-3 rounded-2xl ${m.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm"
                        }`}
                    >
                      {m.role === "user" ? (
                        <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:leading-snug prose-table:w-full prose-table:my-4 prose-th:text-left prose-th:text-gray-500 dark:prose-th:text-gray-400 prose-th:font-medium prose-th:pb-2 prose-th:border-b prose-th:border-gray-200 dark:prose-th:border-gray-700 prose-td:py-3 prose-td:border-b prose-td:border-gray-100 dark:prose-td:border-gray-800/50">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ node, ...props }) => (
                                <a
                                  {...props}
                                  className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg font-semibold no-underline hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-all shadow-sm my-1 border border-blue-200 dark:border-blue-800 w-fit max-w-full"
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
                              li: ({ node, children, ...props }: any) => {
                                const isOrdered = node?.parent?.tagName === 'ol' || node?.parent?.type === 'element' && node?.parent?.tagName === 'ol';

                                if (isOrdered) {
                                  return (
                                    <li className="flex w-full m-0 p-0" {...props}>
                                      <button
                                        onClick={() => {
                                          let text = "";
                                          const extractText = (childArray: any) => {
                                            React.Children.forEach(childArray, child => {
                                              if (typeof child === 'string') text += child;
                                              else if (React.isValidElement(child)) extractText((child as any).props?.children);
                                            });
                                          };
                                          extractText(children);
                                          setQuickPrompt(text.trim());
                                        }}
                                        className="w-full text-left bg-gray-100 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 p-3 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-3 text-sm group"
                                      >
                                        <span
                                          className="flex-shrink-0 w-6 h-6 rounded bg-gray-200 dark:bg-gray-900 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:bg-gray-300 dark:group-hover:bg-gray-800 transition-colors before:content-[counter(options)]"
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
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mt-1 text-blue-600 dark:text-blue-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-tl-sm shadow-sm flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
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
            <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
              {aiEnabled ? (
                <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
                  <textarea
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
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
                    className="absolute right-2 bottom-2 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center text-sm text-gray-500 border border-gray-200 dark:border-gray-700">
                  <p>AI Assistant is currently disabled by the administrator.</p>
                </div>
              )}
              <div className="text-center mt-2">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
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
