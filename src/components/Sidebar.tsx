"use client";

import { Clock3, Github, LogOut, MessageSquare, MoreHorizontal, Pencil, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { AuthProviderId } from "@/lib/auth-providers";

export type ConversationSummary = {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
  messageCount: number;
};

type Props = {
  conversations: ConversationSummary[];
  conversationCount: number;
  isSearching: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onRename: (conversation: ConversationSummary) => void;
  onDelete: (conversation: ConversationSummary) => void;
  onSearchChange: (query: string) => void;
  onLoadMore: () => void;
  onOpenSettings: () => void;
  authenticated: boolean;
  accountName?: string | null;
  authProviders: AuthProviderId[];
  onSignIn: (provider: AuthProviderId) => void;
  onSignOut: () => void;
};

export function Sidebar({ conversations, conversationCount, isSearching, hasMore, loadingMore, activeId, open, onClose, onNewChat, onSelect, onRename, onDelete, onSearchChange, onLoadMore, onOpenSettings, authenticated, accountName, authProviders, onSignIn, onSignOut }: Props) {
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const filtered = useMemo(() => conversations.filter((conversation) => conversation.title.toLowerCase().includes(query.trim().toLowerCase())), [conversations, query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => onSearchChange(query), 220);
    return () => window.clearTimeout(timeout);
  }, [onSearchChange, query]);

  function relativeTime(value: string) {
    const date = new Date(value);
    const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return (
    <>
      {open && <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="Conversation navigation">
        <div className="sidebar-top">
          <div className="brand-row">
            <span className="brand-text">aqiza<span>ai</span></span>
            <button type="button" className="icon-button mobile-close" onClick={onClose} aria-label="Close navigation"><X size={17} /></button>
          </div>
          <button type="button" className="new-chat-button" onClick={onNewChat}>
            <Plus size={16} strokeWidth={2.3} />
            <span>New conversation</span>
            <kbd>Ctrl K</kbd>
          </button>
          <label className="conversation-search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={13} /></button>}
          </label>
        </div>

        <div className="conversation-section">
          <div className="section-heading"><span>{query ? "Search results" : "Recent"}</span><span className="conversation-count">{conversationCount}</span></div>
          {filtered.length > 0 ? (
            <div className="conversation-list">
              {filtered.map((conversation) => (
                <div className={`conversation-item ${activeId === conversation.id ? "conversation-item-active" : ""}`} key={conversation.id}>
                  <button className="conversation-select" type="button" onClick={() => onSelect(conversation.id)} title={conversation.title}>
                    <MessageSquare size={15} />
                    <span className="conversation-title">{conversation.title}</span>
                    <span className="conversation-time">{relativeTime(conversation.updatedAt)}</span>
                  </button>
                  <button className="conversation-more" type="button" aria-label={`More actions for ${conversation.title}`} onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)}>
                    <MoreHorizontal size={15} />
                  </button>
                  {menuId === conversation.id && (
                    <div className="conversation-menu">
                      <button type="button" onClick={() => { setMenuId(null); onRename(conversation); }}><Pencil size={13} />Rename</button>
                      <button type="button" className="danger-action" onClick={() => { setMenuId(null); onDelete(conversation); }}><Trash2 size={13} />Delete</button>
                    </div>
                  )}
                </div>
              ))}
              {hasMore && <button className="conversation-load-more" type="button" disabled={isSearching || loadingMore} onClick={onLoadMore}>{loadingMore ? "Loading…" : "Load older conversations"}</button>}
            </div>
          ) : (
            <div className="empty-history">
              {isSearching
                ? <><Search size={17} /><span>Searching conversations…</span></>
                : query ? <><Search size={17} /><span>No matches found</span></> : <><Clock3 size={17} /><span>Your conversations will appear here</span></>}
            </div>
          )}
        </div>

        <div className="sidebar-bottom">
          <button className="sidebar-utility" type="button" onClick={onOpenSettings}>
            <Settings2 size={16} /><span>Settings &amp; instructions</span><kbd>Ctrl .</kbd>
          </button>
          <ThemeToggle />
          <div className="sidebar-account">
            <span className="account-avatar">{authenticated ? (accountName?.slice(0, 1).toUpperCase() ?? "G") : "A"}</span>
            <div><strong>{authenticated ? accountName ?? "Signed-in account" : "Local workspace"}</strong><span>{authenticated ? "Signed in" : "Private to this browser"}</span></div>
            {authenticated
              ? <button type="button" className="account-action" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={14} /></button>
              : <div className="account-provider-actions">
                  <button
                    type="button"
                    className="account-action"
                    disabled={!authProviders.includes("google")}
                    onClick={() => onSignIn("google")}
                    aria-label={authProviders.includes("google") ? "Sign in with Google" : "Google sign-in needs setup"}
                    title={authProviders.includes("google") ? "Sign in with Google" : "Add AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET to enable Google sign-in"}
                  >
                    <span className="google-provider-mark" aria-hidden="true">G</span>
                  </button>
                  {authProviders.includes("github") && (
                    <button type="button" className="account-action" onClick={() => onSignIn("github")} aria-label="Sign in with GitHub" title="Sign in with GitHub">
                      <Github size={15} />
                    </button>
                  )}
                  {authProviders.length === 0 && <span className="local-status" title="Private local session" />}
                </div>
            }
          </div>
        </div>
      </aside>
    </>
  );
}
