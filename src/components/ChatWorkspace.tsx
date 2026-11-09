"use client";

import {
  Braces, Check, Code2, Download, FileCode2, GitBranch, Moon, PanelLeft, ShieldCheck, Sun, X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { ChatMessage, type ChatMessageItem } from "@/components/ChatMessage";
import { ModelSelector, type ModelReadiness } from "@/components/ModelSelector";
import { Sidebar, type ConversationSummary } from "@/components/Sidebar";
import { DEFAULT_MODEL, modelLabel } from "@/lib/models";
import type { AuthProviderId } from "@/lib/auth-providers";

type ConversationDetail = Omit<ConversationSummary, "messageCount"> & {
  systemPrompt: string;
  messages: (ChatMessageItem & { createdAt: string })[];
};

type ConversationResponse = { conversation: ConversationDetail };
type ConversationListResponse = { conversations: ConversationSummary[]; totalCount: number; nextCursor: string | null };
type ModelResponse = ModelReadiness;
type AccountPreferences = {
  defaultModel: string;
  theme: "dark" | "light";
  defaultSystemPrompt: string;
};

function displayMessages(conversation: ConversationDetail): ChatMessageItem[] {
  return conversation.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({ id: message.id, role: message.role, content: message.content, model: message.model }));
}

const QUICK_PROMPTS = [
  { icon: Code2, title: "Understand a function", subtitle: "Follow the logic and edge cases", prompt: "Explain this code step by step. Point out any edge cases or assumptions:\n\n" },
  { icon: Braces, title: "Trace a bug", subtitle: "Start from the evidence", prompt: "Help me debug this issue. Ask for missing context if needed, then explain the likely root cause and a minimal fix:\n\n" },
  { icon: FileCode2, title: "Review a diff", subtitle: "Check correctness and risk", prompt: "Review this code for correctness, security, and performance. List only actionable findings with their severity:\n\n" },
  { icon: GitBranch, title: "Shape an API", subtitle: "Find a clear boundary", prompt: "Help me design a developer-friendly API for this requirement. Include request and response examples, error behavior, and trade-offs:\n\n" },
];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status}).`);
  return payload;
}

function newMessageId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `message-${Date.now()}`;
}

function isLocalModel(model: string) {
  return model.startsWith("ollama:");
}

export function ChatWorkspace({ initialConversationId }: { initialConversationId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationCursor, setConversationCursor] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [retryMessageId, setRetryMessageId] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ModelReadiness | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [defaultModel, setDefaultModel] = useState(DEFAULT_MODEL);
  const [defaultModelDraft, setDefaultModelDraft] = useState(DEFAULT_MODEL);
  const [accountPreferences, setAccountPreferences] = useState<AccountPreferences | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExportingConversation, setIsExportingConversation] = useState(false);
  const [isLoadingLocalModel, setIsLoadingLocalModel] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(Boolean(initialConversationId));
  const [messageError, setMessageError] = useState("");
  const [localProviderError, setLocalProviderError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [providerHelpOpen, setProviderHelpOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const [isConnectingOllama, setIsConnectingOllama] = useState(false);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const claimedGuestHistoryForUser = useRef<string | null>(null);
  const appliedAccountPreferencesForUser = useRef<string | null>(null);
  const themeRef = useRef(theme);
  const accountUserIdRef = useRef(session?.user?.id);
  const conversationSearchRef = useRef(conversationSearch);
  const conversationCursorRef = useRef(conversationCursor);
  const conversationRequestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);
  themeRef.current = theme;
  accountUserIdRef.current = session?.user?.id;
  conversationSearchRef.current = conversationSearch;
  conversationCursorRef.current = conversationCursor;
  const activeController = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const currentConversationIdRef = useRef(initialConversationId);
  currentConversationIdRef.current = conversationId;
  const startNewChatRef = useRef<() => void>(() => undefined);
  const openSettingsRef = useRef<() => void>(() => undefined);
  const inputRef = useRef(input);
  inputRef.current = input;

  const enabledModelIds = useMemo(() => new Set(readiness?.models.filter((item) => item.enabled).map((item) => item.id) ?? []), [readiness]);
  const anyProviderEnabled = Boolean(readiness && (Object.values(readiness.providers).some(Boolean)));
  const selectedModelEnabled = enabledModelIds.has(model);

  const refreshConversations = useCallback(async () => {
    const requestId = ++conversationRequestIdRef.current;
    const requestedSearch = conversationSearch;
    setIsLoadingConversations(true);
    try {
      const params = new URLSearchParams();
      if (requestedSearch) params.set("search", requestedSearch);
      const query = params.size ? `?${params.toString()}` : "";
      const result = await requestJson<ConversationListResponse>(`/api/conversations${query}`);
      if (requestId !== conversationRequestIdRef.current || conversationSearchRef.current !== requestedSearch) return;
      setConversations(result.conversations);
      setConversationCount(result.totalCount);
      setConversationCursor(result.nextCursor);
    } catch (error) {
      if (requestId !== conversationRequestIdRef.current) return;
      const detail = error instanceof Error ? error.message : "Try again in a moment.";
      setMessageError(`Could not load conversation history. ${detail}`);
    } finally {
      if (requestId === conversationRequestIdRef.current) setIsLoadingConversations(false);
    }
  }, [conversationSearch]);

  const changeConversationSearch = useCallback((value: string) => {
    const nextSearch = value.trim().slice(0, 120);
    if (nextSearch === conversationSearchRef.current) return;
    conversationSearchRef.current = nextSearch;
    setConversationSearch(nextSearch);
    setConversations([]);
    setConversationCount(0);
    setConversationCursor(null);
    setIsLoadingConversations(true);
  }, []);

  const loadMoreConversations = useCallback(async () => {
    const cursor = conversationCursor;
    const requestedSearch = conversationSearch;
    if (!cursor || isLoadingConversations || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMoreConversations(true);
    const requestId = conversationRequestIdRef.current;

    try {
      const params = new URLSearchParams({ cursor });
      if (requestedSearch) params.set("search", requestedSearch);
      const result = await requestJson<ConversationListResponse>(`/api/conversations?${params.toString()}`);
      if (requestId !== conversationRequestIdRef.current
        || conversationSearchRef.current !== requestedSearch
        || conversationCursorRef.current !== cursor) return;
      setConversations((current) => [...current, ...result.conversations]);
      setConversationCount(result.totalCount);
      setConversationCursor(result.nextCursor);
    } catch (error) {
      if (requestId !== conversationRequestIdRef.current) return;
      const detail = error instanceof Error ? error.message : "Try again in a moment.";
      setMessageError(`Could not load older conversations. ${detail}`);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMoreConversations(false);
    }
  }, [conversationCursor, conversationSearch, isLoadingConversations]);

  useEffect(() => {
    let alive = true;
    fetch("/api/models", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: ModelResponse) => {
        if (!alive) return;
        setReadiness(result);
        const savedDefaultModel = window.localStorage.getItem("aqizaai-default-model") || DEFAULT_MODEL;
        setDefaultModel(savedDefaultModel);
        setDefaultModelDraft(savedDefaultModel);
        const firstReady = result.models.find((item) => item.enabled)?.id;
        if (!initialConversationId) {
          const preferredReady = result.models.some((item) => item.id === savedDefaultModel && item.enabled);
          setModel((current) => preferredReady
            ? savedDefaultModel
            : result.models.some((item) => item.id === current && item.enabled) ? current : firstReady ?? current);
          if (!preferredReady && firstReady) {
            setDefaultModel(firstReady);
            window.localStorage.setItem("aqizaai-default-model", firstReady);
          }
        }
      })
      .catch(() => {
        if (alive) setReadiness({
          models: [],
          providers: { google: false, groq: false, openrouter: false, ollama: false },
          ollama: { localRuntime: false, installed: false, connected: false, models: [] },
        });
      });
    const savedTheme = window.localStorage.getItem("aqizaai-theme");
    const nextTheme = savedTheme === "light" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    return () => { alive = false; };
  }, [initialConversationId]);

  useEffect(() => { void refreshConversations(); }, [refreshConversations]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      appliedAccountPreferencesForUser.current = null;
      setAccountPreferences(null);
      return;
    }

    let alive = true;
    setAccountPreferences(null);
    requestJson<AccountPreferences>("/api/settings")
      .then((preferences) => { if (alive) setAccountPreferences(preferences); })
      .catch((error: unknown) => {
        if (alive) setMessageError(error instanceof Error
          ? `Could not load your account settings. ${error.message}`
          : "Could not load your account settings.");
      });
    return () => { alive = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !accountPreferences || !readiness || appliedAccountPreferencesForUser.current === userId) return;
    appliedAccountPreferencesForUser.current = userId;

    const storedModelIsReady = readiness.models.some((item) => item.id === accountPreferences.defaultModel && item.enabled);
    const defaultModelForThisDevice = storedModelIsReady
      ? accountPreferences.defaultModel
      : readiness.models.find((item) => item.enabled)?.id ?? accountPreferences.defaultModel;
    setDefaultModel(defaultModelForThisDevice);
    setDefaultModelDraft(defaultModelForThisDevice);
    window.localStorage.setItem("aqizaai-default-model", defaultModelForThisDevice);
    setTheme(accountPreferences.theme);
    document.documentElement.dataset.theme = accountPreferences.theme;
    window.localStorage.setItem("aqizaai-theme", accountPreferences.theme);

    if (!currentConversationIdRef.current) {
      setModel(defaultModelForThisDevice);
      setSystemPrompt(accountPreferences.defaultSystemPrompt);
      window.localStorage.setItem("aqizaai-default-system-prompt", accountPreferences.defaultSystemPrompt);
    }
  }, [accountPreferences, readiness, session?.user?.id]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      claimedGuestHistoryForUser.current = null;
      void refreshConversations();
      return;
    }
    if (claimedGuestHistoryForUser.current === userId) return;
    claimedGuestHistoryForUser.current = userId;
    if (currentConversationIdRef.current) setIsLoadingConversation(true);

    void (async () => {
      try {
        const result = await requestJson<{ transferred: number }>("/api/conversations/claim", { method: "POST" });
        const activeConversationId = currentConversationIdRef.current;
        if (activeConversationId) {
          const { conversation } = await requestJson<ConversationResponse>(`/api/conversations/${encodeURIComponent(activeConversationId)}`);
          if (currentConversationIdRef.current === activeConversationId) {
            const restoredMessages = displayMessages(conversation);
            setMessages(restoredMessages);
            const lastMessage = restoredMessages.at(-1);
            setRetryMessageId(lastMessage?.role === "user" ? lastMessage.id : null);
            setModel(conversation.model);
            setSystemPrompt(conversation.systemPrompt ?? "");
            setMessageError("");
            setIsLoadingConversation(false);
          }
        }
        if (result.transferred > 0) {
          setToast(`${result.transferred} ${result.transferred === 1 ? "conversation" : "conversations"} added to your account`);
          window.setTimeout(() => setToast(""), 1800);
        }
        await refreshConversations();
      } catch (error) {
        setMessageError(error instanceof Error
          ? `Could not finish restoring your chats after sign-in. ${error.message}`
          : "Could not finish restoring your chats after sign-in.");
        setIsLoadingConversation(false);
        await refreshConversations();
      }
    })();
  }, [session?.user?.id, refreshConversations]);

  useEffect(() => {
    let alive = true;
    if (!initialConversationId) {
      setConversationId(null);
      setMessages([]);
      setRetryMessageId(null);
      setMessageError("");
      setModel((current) => current || DEFAULT_MODEL);
      setSystemPrompt(window.localStorage.getItem("aqizaai-default-system-prompt") ?? "");
      setIsLoadingConversation(false);
      return () => { alive = false; };
    }

    setConversationId(initialConversationId);
    setIsLoadingConversation(true);
    setRetryMessageId(null);
    setMessageError("");
    requestJson<ConversationResponse>(`/api/conversations/${encodeURIComponent(initialConversationId)}`)
      .then(({ conversation }) => {
        if (!alive) return;
        const restoredMessages = displayMessages(conversation);
        setMessages(restoredMessages);
        const lastMessage = restoredMessages.at(-1);
        setRetryMessageId(lastMessage?.role === "user" ? lastMessage.id : null);
        setModel(conversation.model);
        setSystemPrompt(conversation.systemPrompt ?? "");
      })
      .catch((error: unknown) => {
        if (alive) setMessageError(error instanceof Error ? error.message : "Could not open this conversation.");
      })
      .finally(() => { if (alive) setIsLoadingConversation(false); });
    return () => { alive = false; };
  }, [initialConversationId]);

  useEffect(() => {
    const node = chatScrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, messageError]);

  const applyThemePreference = useCallback((nextTheme: "dark" | "light") => {
    themeRef.current = nextTheme;
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("aqizaai-theme", nextTheme);

    if (accountUserIdRef.current) {
      void requestJson("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ theme: nextTheme }),
      }).catch((error: unknown) => {
        setMessageError(error instanceof Error ? `Could not sync your theme. ${error.message}` : "Could not sync your theme.");
      });
    }
  }, []);

  useEffect(() => {
    const onThemeToggle = () => {
      applyThemePreference(themeRef.current === "dark" ? "light" : "dark");
    };
    window.addEventListener("aqiza-toggle-theme", onThemeToggle);
    return () => window.removeEventListener("aqiza-toggle-theme", onThemeToggle);
  }, [applyThemePreference]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        startNewChatRef.current();
      } else if ((event.ctrlKey || event.metaKey) && event.key === ".") {
        event.preventDefault();
        openSettingsRef.current();
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        toggleTheme();
      } else if (event.key === "Escape" && mobileNavOpen) {
        setMobileNavOpen(false);
      }
      if (isTyping && event.key === "Escape" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [mobileNavOpen, pathname]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  function toggleTheme() {
    window.dispatchEvent(new Event("aqiza-toggle-theme"));
  }

  function setThemePreference(nextTheme: "dark" | "light") {
    applyThemePreference(nextTheme);
  }

  function openSettings() {
    setPromptDraft(systemPrompt);
    setDefaultModelDraft(defaultModel);
    setSettingsOpen(true);
  }

  startNewChatRef.current = startNewChat;
  openSettingsRef.current = openSettings;

  function startNewChat() {
    if (isStreaming) activeController.current?.abort();
    setMobileNavOpen(false);
    if (pathname !== "/") router.push("/");
    setConversationId(null);
    setMessages([]);
    setRetryMessageId(null);
    setInput("");
    setMessageError("");
    setModel(defaultModel);
    setSystemPrompt(window.localStorage.getItem("aqizaai-default-system-prompt") ?? "");
  }

  function openConversation(id: string) {
    if (id === conversationId) {
      setMobileNavOpen(false);
      return;
    }
    if (isStreaming) activeController.current?.abort();
    setMobileNavOpen(false);
    router.push(`/chat/${encodeURIComponent(id)}`);
  }

  async function changeModel(nextModel: string) {
    setModel(nextModel);
    setMessageError("");
    if (conversationId) {
      try {
        await requestJson(`/api/conversations/${encodeURIComponent(conversationId)}`, {
          method: "PATCH",
          body: JSON.stringify({ model: nextModel }),
        });
        await refreshConversations();
      } catch (error) {
        setMessageError(error instanceof Error ? error.message : "Could not update this conversation.");
      }
    }
  }

  async function exportConversation() {
    if (!conversationId || isExportingConversation || isStreaming) return;
    setIsExportingConversation(true);
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/export`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? `Export failed (${response.status}).`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/i)?.[1] ?? "aqizaai-conversation.md";
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      notify("Conversation exported");
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Could not export this conversation.");
    } finally {
      setIsExportingConversation(false);
    }
  }

  async function renameConversation(conversation: ConversationSummary) {
    const nextTitle = window.prompt("Rename conversation", conversation.title);
    if (nextTitle === null || !nextTitle.trim()) return;
    try {
      await requestJson(`/api/conversations/${encodeURIComponent(conversation.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ title: nextTitle.trim() }),
      });
      await refreshConversations();
      notify("Conversation renamed");
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Could not rename this conversation.");
    }
  }

  async function deleteConversation(conversation: ConversationSummary) {
    if (!window.confirm(`Delete “${conversation.title}”? This removes its messages from your conversation history.`)) return;
    try {
      await requestJson(`/api/conversations/${encodeURIComponent(conversation.id)}`, { method: "DELETE" });
      setConversations((current) => current.filter((item) => item.id !== conversation.id));
      setConversationCount((current) => Math.max(0, current - 1));
      if (conversation.id === conversationId) startNewChat();
      notify("Conversation deleted");
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Could not delete this conversation.");
    }
  }

  async function clearConversationHistory() {
    if (isClearingHistory || isStreaming) return;
    const ownerLabel = session?.user ? "your account" : "this browser";
    if (!window.confirm(`Permanently delete every conversation saved in ${ownerLabel}? All messages will be removed and this cannot be undone.`)) return;

    setIsClearingHistory(true);
    try {
      const result = await requestJson<{ deleted: number }>("/api/conversations", { method: "DELETE" });
      setConversations([]);
      setConversationCount(0);
      setConversationCursor(null);
      startNewChat();
      setSettingsOpen(false);
      notify(result.deleted > 0
        ? `${result.deleted} ${result.deleted === 1 ? "conversation" : "conversations"} deleted`
        : "Conversation history is already empty");
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Could not clear conversation history.");
    } finally {
      setIsClearingHistory(false);
    }
  }

  async function saveSettings() {
    const nextPrompt = promptDraft.trim();
    try {
      if (session?.user?.id) {
        await requestJson("/api/settings", {
          method: "PATCH",
          body: JSON.stringify({
            defaultModel: defaultModelDraft,
            theme,
            ...(!conversationId ? { defaultSystemPrompt: nextPrompt } : {}),
          }),
        });
      }
      if (conversationId) {
        await requestJson(`/api/conversations/${encodeURIComponent(conversationId)}`, {
          method: "PATCH",
          body: JSON.stringify({ systemPrompt: nextPrompt }),
        });
      } else {
        window.localStorage.setItem("aqizaai-default-system-prompt", nextPrompt);
      }
      window.localStorage.setItem("aqizaai-default-model", defaultModelDraft);
      setDefaultModel(defaultModelDraft);
      if (!conversationId) setModel(defaultModelDraft);
      setSystemPrompt(nextPrompt);
      setSettingsOpen(false);
      notify("Settings saved");
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Could not save your instructions.");
    }
  }

  async function connectLocalOllama() {
    if (isConnectingOllama) return;
    setIsConnectingOllama(true);
    setMessageError("");
    setLocalProviderError("");
    try {
      const result = await requestJson<ModelResponse>("/api/models/ollama", { method: "POST" });
      setReadiness(result);
      const firstLocalModel = result.ollama.models[0];
      if (firstLocalModel) {
        const cloudModelReady = result.models.some((item) => item.enabled && !isLocalModel(item.id));
        if (!cloudModelReady || !enabledModelIds.has(model)) await changeModel(firstLocalModel.id);
        if (!cloudModelReady) {
          window.localStorage.setItem("aqizaai-default-model", firstLocalModel.id);
          setDefaultModel(firstLocalModel.id);
          setDefaultModelDraft(firstLocalModel.id);
        }
        notify(`${result.ollama.models.length} local chat ${result.ollama.models.length === 1 ? "model" : "models"} ready`);
      } else {
        notify("Ollama is connected, but no chat model is installed yet");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not connect to local Ollama.";
      setLocalProviderError(message);
      setMessageError(message);
    } finally {
      setIsConnectingOllama(false);
    }
  }

  async function sendMessage(messageText = inputRef.current, retryOfMessageId?: string) {
    const content = messageText.trim();
    if (!content || isStreaming) return;
    const isRetry = Boolean(retryOfMessageId);
    if (isRetry && (!conversationId || retryMessageId !== retryOfMessageId
      || messages.at(-1)?.id !== retryOfMessageId || messages.at(-1)?.role !== "user")) return;
    if (!selectedModelEnabled) {
      setProviderHelpOpen(true);
      return;
    }

    setInput("");
    setMessageError("");
    setIsLoadingLocalModel(false);
    if (!isRetry) setRetryMessageId(null);
    let pendingAssistantId: string | null = null;
    let clientUserMessageId: string | null = null;
    let savedUserMessageId: string | null = retryOfMessageId ?? null;
    let localWarmupTimer: number | undefined;
    let activeId = conversationId;
    try {
      if (!activeId) {
        const created = await requestJson<{ conversation: { id: string; title: string; model: string; updatedAt: string } }>("/api/conversations", {
          method: "POST",
          body: JSON.stringify({ title: "New chat", model, systemPrompt }),
        });
        activeId = created.conversation.id;
        setConversationId(activeId);
      }

      const userMessage: ChatMessageItem | null = isRetry ? null : { id: newMessageId(), role: "user", content, model };
      clientUserMessageId = userMessage?.id ?? null;
      const assistantId = newMessageId();
      pendingAssistantId = assistantId;
      setMessages((current) => [...current, ...(userMessage ? [userMessage] : []), { id: assistantId, role: "assistant", content: "", model }]);
      setIsStreaming(true);
      if (isLocalModel(model)) {
        localWarmupTimer = window.setTimeout(() => setIsLoadingLocalModel(true), 900);
      }
      const controller = new AbortController();
      activeController.current = controller;
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          action: isRetry ? "retry" : "send",
          conversationId: activeId,
          model,
          ...(isRetry ? { messageId: retryOfMessageId } : { message: content }),
          systemPrompt,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (isRetry && response.status === 409) {
          const { conversation } = await requestJson<ConversationResponse>(`/api/conversations/${encodeURIComponent(activeId)}`);
          const restoredMessages = displayMessages(conversation);
          setMessages(restoredMessages);
          const lastMessage = restoredMessages.at(-1);
          setRetryMessageId(lastMessage?.role === "user" ? lastMessage.id : null);
          setModel(conversation.model);
          setSystemPrompt(conversation.systemPrompt ?? "");
          setMessageError("");
          await refreshConversations();
          notify("Saved response restored");
          return;
        }
        throw new Error(payload.error ?? `Request failed (${response.status}).`);
      }
      savedUserMessageId = response.headers.get("x-aqiza-user-message-id") ?? savedUserMessageId;
      if (savedUserMessageId && !isRetry && clientUserMessageId) {
        const localId = clientUserMessageId;
        const savedId = savedUserMessageId;
        setMessages((current) => current.map((item) => item.id === localId ? { ...item, id: savedId } : item));
        setRetryMessageId(savedId);
      }
      if (!response.body) throw new Error("The model did not open a response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;
      let streamFailure = "";
      let streamedText = "";

      const consumeFrames = (frames: string[]) => {
        for (const frame of frames) {
          const data = frame.split(/\r?\n/).find((line) => line.startsWith("data: "))?.slice(6);
          if (!data) continue;
          try {
            const payload = JSON.parse(data) as { type: string; text?: string; message?: string };
            if (payload.type === "delta" && payload.text) {
              streamedText += payload.text;
              if (localWarmupTimer !== undefined) {
                window.clearTimeout(localWarmupTimer);
                localWarmupTimer = undefined;
              }
              setIsLoadingLocalModel(false);
              setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + payload.text } : item));
            } else if (payload.type === "done") {
              completed = true;
              setRetryMessageId(null);
            } else if (payload.type === "error") {
              streamFailure = payload.message ?? "The model could not finish the response.";
            }
          } catch {
            streamFailure = "The response stream contained invalid data.";
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";
        consumeFrames(frames);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeFrames([buffer]);
      if (streamFailure) throw new Error(streamFailure);
      if (completed && !streamedText.trim()) throw new Error("The model returned an empty response. Try again or choose another local model.");
      if (!completed && !controller.signal.aborted) throw new Error("The connection ended before the model finished.");

      await refreshConversations();
      if (!conversationId && activeId) router.replace(`/chat/${encodeURIComponent(activeId)}`);
    } catch (error) {
      const failedAssistantId = pendingAssistantId;
      if (failedAssistantId) {
        setMessages((current) => current.filter((item) => item.id !== failedAssistantId));
      }
      if (savedUserMessageId) {
        setRetryMessageId(savedUserMessageId);
      } else if (isRetry) {
        setRetryMessageId(retryOfMessageId ?? null);
      } else {
        if (clientUserMessageId) setMessages((current) => current.filter((item) => item.id !== clientUserMessageId));
        setInput(content);
      }
      if (!(error instanceof Error && error.name === "AbortError")) {
        setMessageError(error instanceof Error ? error.message : "The message could not be sent.");
      }
      if (!conversationId) await refreshConversations();
    } finally {
      if (localWarmupTimer !== undefined) window.clearTimeout(localWarmupTimer);
      setIsLoadingLocalModel(false);
      activeController.current = null;
      setIsStreaming(false);
    }
  }

  const welcome = messages.length === 0 && !isLoadingConversation;
  const lastMessage = messages.at(-1);
  const retryTarget = retryMessageId && lastMessage?.role === "user" && lastMessage.id === retryMessageId
    ? lastMessage
    : null;

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        conversationCount={conversationCount}
        isSearching={isLoadingConversations}
        hasMore={Boolean(conversationCursor)}
        loadingMore={isLoadingMoreConversations}
        activeId={conversationId}
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onNewChat={startNewChat}
        onSelect={openConversation}
        onRename={renameConversation}
        onDelete={deleteConversation}
        onSearchChange={changeConversationSearch}
        onLoadMore={() => void loadMoreConversations()}
        onOpenSettings={openSettings}
        authenticated={Boolean(session?.user)}
        accountName={session?.user?.name}
          authProviders={readiness?.authProviders ?? []}
          onSignIn={(provider: AuthProviderId) => { void signIn(provider, { callbackUrl: pathname }); }}
        onSignOut={() => { void signOut({ callbackUrl: "/" }); }}
      />
      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button desktop-menu-button" type="button" aria-label="Open conversations" onClick={() => setMobileNavOpen(true)}><PanelLeft size={17} /></button>
            <div className="topbar-title">
              <strong>{conversationId ? conversations.find((item) => item.id === conversationId)?.title ?? "Conversation" : "Workspace"}</strong>
              <span>Private, persistent conversations</span>
            </div>
          </div>
          <div className="topbar-right">
            {conversationId && messages.length > 0 && (
              <button className="icon-button header-export" type="button" aria-label="Export conversation as Markdown" title="Export conversation as Markdown" disabled={isStreaming || isExportingConversation} onClick={() => void exportConversation()}>
                <Download size={15} />
              </button>
            )}
            <ModelSelector value={model} readiness={readiness} onChange={changeModel} />
            <span className="environment-label"><i />{session?.user ? "Account session" : "Browser session"}</span>
            <button className="header-theme" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={toggleTheme}>
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        <div className="chat-scroll-area" ref={chatScrollRef}>
          <div className="chat-content">
            {welcome ? (
              <section className="welcome-state">
                <div className="welcome-eyebrow">Code, in context</div>
                <h1>Work through<br />the <em>hard parts.</em></h1>
                <p>Trace a bug, understand a function, or get a second read on a change. Keep the conversation grounded in your code.</p>
                <div className="prompt-grid">
                  {QUICK_PROMPTS.map(({ icon: Icon, title, subtitle, prompt }) => (
                    <button className="prompt-card" key={title} type="button" onClick={() => { setInput(prompt); document.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(); }}>
                      <strong><Icon size={14} /> {title}</strong>
                      <span>{subtitle}</span>
                    </button>
                  ))}
                </div>
                <div className="welcome-meta"><ShieldCheck size={13} /><span>{session?.user ? "Chats saved to your account" : "Chats stay in this browser session"}</span><span className="meta-dot" /><span>Markdown and code ready</span></div>
              </section>
            ) : isLoadingConversation ? (
              <div className="loading-thread" aria-label="Loading conversation"><span /><span /><span /></div>
            ) : (
              <section className="message-list" aria-label="Conversation messages">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    streaming={isStreaming && index === messages.length - 1 && message.role === "assistant"}
                    loadingModel={isLoadingLocalModel && index === messages.length - 1 && message.role === "assistant"}
                  />
                ))}
              </section>
            )}
            {(messageError || (retryTarget && !isStreaming)) && (
              <div className="message-error" role="alert">
                <span>{messageError || "The response did not finish."}</span>
                {retryTarget && !isStreaming && (
                  <button className="message-retry-button" type="button" onClick={() => void sendMessage(retryTarget.content, retryTarget.id)}>Retry last message</button>
                )}
              </div>
            )}
          </div>
        </div>

        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={() => void sendMessage()}
          model={model}
          readiness={readiness}
          onModelChange={changeModel}
          disabled={!selectedModelEnabled || !input.trim()}
          streaming={isStreaming}
          onStop={() => activeController.current?.abort()}
        />
        {!anyProviderEnabled && readiness && (
          <div className="composer-config-callout">
            <span>{readiness.ollama.installed ? "Ollama is installed on this computer." : "No model provider is connected."}</span>
            <button
              type="button"
              disabled={isConnectingOllama}
              onClick={() => readiness.ollama.installed ? void connectLocalOllama() : setProviderHelpOpen(true)}
            >
              {isConnectingOllama ? "Connecting…" : readiness.ollama.installed ? "Start & connect" : "Set up a model"}
            </button>
          </div>
        )}
      </main>

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="settings-modal-header">
              <div><h2 id="settings-title">Settings</h2><p>{conversationId
                ? "Choose account defaults and instructions for this conversation."
                : session?.user ? "Your defaults sync with your account." : "Defaults apply to new chats in this browser."}</p></div>
              <button className="icon-button" type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={16} /></button>
            </div>
            <div className="settings-preferences">
              <div className="settings-preference">
                <span className="settings-preference-label">Default model</span>
                <ModelSelector value={defaultModelDraft} readiness={readiness} onChange={setDefaultModelDraft} compact ariaLabel="Default model" />
              </div>
              <label className="settings-preference settings-preference-theme">
                <span className="settings-preference-label">Theme</span>
                <select value={theme} onChange={(event) => setThemePreference(event.target.value as "dark" | "light")}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>
            </div>
            <p className="settings-help">The default model is used for new chats. You can switch models inside any conversation.</p>
            {session?.user && <p className="settings-help">Account defaults are available when you sign in on another device.</p>}
            <label htmlFor="system-prompt">Custom instructions</label>
            <textarea id="system-prompt" value={promptDraft} onChange={(event) => setPromptDraft(event.target.value)} maxLength={4_000} placeholder="For example: Prefer TypeScript, explain trade-offs, and keep examples production-ready." />
            <p className="settings-help">Up to 4,000 characters. Treat model output as suggestions and review generated code.</p>
            <div className="modal-divider" />
            <label>Local models</label>
            <div className="ollama-connect-row">
              <div>
                <strong>Ollama on this computer</strong>
                <span>{readiness?.ollama.connected
                  ? `${readiness.ollama.models.length} chat ${readiness.ollama.models.length === 1 ? "model" : "models"} detected`
                  : readiness?.ollama.installed ? "Installed · ready to connect" : "No API key needed for local models"}</span>
              </div>
              <button type="button" disabled={isConnectingOllama || !readiness?.ollama.localRuntime} onClick={() => void connectLocalOllama()}>
                {isConnectingOllama ? "Connecting…" : readiness?.ollama.connected ? "Refresh models" : "Connect Ollama"}
              </button>
            </div>
            {localProviderError && <p className="provider-local-error" role="alert">{localProviderError}</p>}
            <p className="settings-help">Only already-downloaded chat models are listed. AqizaAI does not download models for you.</p>
            <div className="modal-divider" />
            <div className="settings-danger-zone">
              <div><strong>Delete conversation history</strong><span>Remove all chats saved in {session?.user ? "your account" : "this browser"}.</span></div>
              <button type="button" disabled={isClearingHistory || isStreaming} onClick={() => void clearConversationHistory()}>
                {isStreaming ? "Stop response first" : isClearingHistory ? "Deleting…" : "Delete all chats"}
              </button>
            </div>
            <div className="settings-actions"><button type="button" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="save-button" type="button" onClick={() => void saveSettings()}>Save settings</button></div>
          </section>
        </div>
      )}

      {providerHelpOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setProviderHelpOpen(false); }}>
          <section className="settings-modal provider-modal" role="dialog" aria-modal="true" aria-labelledby="provider-title">
            <div className="settings-modal-header">
              <div><h2 id="provider-title">Connect a model provider</h2><p>Provider keys stay on the server and are never sent to the browser.</p></div>
              <button className="icon-button" type="button" onClick={() => setProviderHelpOpen(false)} aria-label="Close provider setup"><X size={16} /></button>
            </div>
            <div className="provider-local-card">
              <div className="provider-local-copy">
                <strong>Ollama · local and free</strong>
                <span>{readiness?.ollama.connected
                  ? `${readiness.ollama.models.length} chat ${readiness.ollama.models.length === 1 ? "model" : "models"} available on this computer`
                  : readiness?.ollama.installed ? "Installed here · click to start and detect your models" : readiness?.ollama.localRuntime ? "Check this computer for Ollama" : "Run AqizaAI on the same computer as Ollama to connect it"}</span>
              </div>
              <button
                type="button"
                disabled={isConnectingOllama || !readiness?.ollama.localRuntime}
                onClick={() => void connectLocalOllama()}
              >
                {isConnectingOllama ? "Connecting…" : readiness?.ollama.connected ? "Refresh models" : "Connect Ollama"}
              </button>
            </div>
            {localProviderError && <p className="provider-local-error" role="alert">{localProviderError}</p>}
            <p className="settings-help provider-local-help">No API key is required. Your existing local models are detected automatically; nothing is downloaded.</p>
            <div className="modal-divider" />
            <div className="provider-instructions">
              <p>Cloud providers are optional. To use one, copy <code>.env.example</code> to <code>.env</code>, add its key, then restart the development server.</p>
              <pre>GOOGLE_GENERATIVE_AI_API_KEY=…{"\n"}GROQ_API_KEY=…{"\n"}OPENROUTER_API_KEY=…</pre>
            </div>
            <div className="settings-actions"><button className="save-button" type="button" onClick={() => setProviderHelpOpen(false)}>Got it</button></div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status"><Check size={14} />{toast}</div>}
      <span className="sr-only">{modelLabel(model)} selected</span>
    </div>
  );
}
