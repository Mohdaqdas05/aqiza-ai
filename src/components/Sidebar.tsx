"use client";

import { Clock3, LogOut, MessageSquare, MoreHorizontal, Pencil, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  accountEmail?: string | null;
  accountImage?: string | null;
  accountProvider?: string | null;
  onOpenSignIn: () => void;
  onSignOut: () => void;
};

export function Sidebar({ conversations, conversationCount, isSearching, hasMore, loadingMore, activeId, open, onClose, onNewChat, onSelect, onRename, onDelete, onSearchChange, onLoadMore, onOpenSettings, authenticated, accountName, accountEmail, accountImage, accountProvider, onOpenSignIn, onSignOut }: Props) {
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
            <span>New chat</span>
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
            <Settings2 size={16} /><span>Settings</span><kbd>Ctrl .</kbd>
          </button>
          <ThemeToggle />
          {authenticated ? (
            <div className="sidebar-account sidebar-account-signed-in">
              <span className={`account-avatar ${accountImage ? "account-avatar-image" : ""}`} aria-hidden="true">
                {accountImage ? <img src={accountImage} alt="" referrerPolicy="no-referrer" /> : accountName?.slice(0, 1).toUpperCase() ?? "A"}
              </span>
              <div title={accountEmail ?? undefined}><strong>{accountName ?? "Your account"}</strong><span>{accountEmail ?? (accountProvider ? `Signed in with ${accountProvider === "google" ? "Google" : "GitHub"}` : "Signed in")}</span></div>
              <button type="button" className="account-action" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={14} /></button>
            </div>
          ) : (
            <button className="sidebar-account sidebar-account-guest" type="button" onClick={onOpenSignIn}>
              <span className="account-avatar" aria-hidden="true">A</span>
              <span className="sidebar-account-copy"><strong>Sign in or create account</strong><span>Optional · local models work as a guest</span></span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

