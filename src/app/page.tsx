"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, Menu, Palette, Plus, Search, Trash2, X } from "lucide-react";
import { NOTE_COLORS, type Note } from "@/domain/note";
import { useNotes } from "@/hooks/use-notes";

function preview(note: Note) {
  return note.body.trim() || "No additional text";
}

function relativeTime(timestamp: number) {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(timestamp);
}

export default function NotesPage() {
  const { notes, activeId, setActiveId, ready, saveStatus, create, update, remove } = useNotes();
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!confirmingDelete) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmingDelete(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmingDelete]);

  const filteredNotes = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return notes
      .filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(normalized))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, query]);

  const activeNote = notes.find((note) => note.id === activeId) ?? null;

  function createNote() {
    create();
    setSidebarOpen(false);
  }

  function updateNote(changes: Partial<Pick<Note, "title" | "body" | "color">>) {
    if (!activeNote) return;
    update(activeNote.id, changes);
  }

  async function deleteNote() {
    if (!activeNote) return;
    try {
      await remove(activeNote.id);
      setConfirmingDelete(false);
    } catch {
      setConfirmingDelete(false);
    }
  }

  return (
    <main className="app-shell">
      {sidebarOpen && (
        <button className="scrim" aria-label="Close notes" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <span className="brand-name">papier</span>
          <button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <button className="new-note-button" onClick={createNote}>
          <Plus size={18} strokeWidth={2.2} />
          New note
          <span className="shortcut">N</span>
        </button>

        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" />
          {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
        </label>

        <div className="section-heading">
          <span>Notes</span>
          <span>{filteredNotes.length}</span>
        </div>

        <div className="note-list">
          {filteredNotes.map((note) => (
            <button
              className={`note-card ${note.id === activeId ? "note-card-active" : ""}`}
              key={note.id}
              style={{ "--note-color": NOTE_COLORS.find((color) => color.id === note.color)?.value } as React.CSSProperties}
              onClick={() => { setActiveId(note.id); setSidebarOpen(false); }}
            >
              <span className="note-card-title-row">
                <span className="note-color-dot" />
                <span className="note-card-title">{note.title.trim() || "Untitled note"}</span>
              </span>
              <span className="note-card-preview">{preview(note)}</span>
              <span className="note-card-time">{relativeTime(note.updatedAt)}</span>
            </button>
          ))}

          {ready && filteredNotes.length === 0 && query && (
            <p className="no-results">No notes match “{query}”</p>
          )}
        </div>

        <div className="sidebar-footer">
          <span>
            {saveStatus === "loading" && "Connecting to database…"}
            {saveStatus === "saving" && "Saving to database…"}
            {saveStatus === "saved" && "Saved to PostgreSQL"}
            {saveStatus === "error" && "Database connection failed"}
          </span>
          <span className={`status-dot status-${saveStatus}`} />
        </div>
      </aside>

      <section className="workspace">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu size={20} /></button>
          <div className="mobile-brand"><div className="brand-mark small"><span /></div>papier</div>
          <button className="icon-button" onClick={createNote} aria-label="New note"><Plus size={20} /></button>
        </header>

        {!ready ? (
          <div className="loading-state">Loading your notes…</div>
        ) : activeNote ? (
          <article className="editor">
            <div className="editor-toolbar">
              <span>Last edited {relativeTime(activeNote.updatedAt)}</span>
              <div className="toolbar-actions">
                <div className="color-picker" aria-label="Note color">
                  <Palette size={16} aria-hidden="true" />
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color.id}
                      className={`color-swatch ${activeNote.color === color.id ? "color-swatch-active" : ""}`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => updateNote({ color: color.id })}
                      aria-label={`Tag as ${color.label}`}
                      aria-pressed={activeNote.color === color.id}
                      title={color.label}
                    />
                  ))}
                </div>
                <button className="icon-button danger" onClick={() => setConfirmingDelete(true)} aria-label="Delete note"><Trash2 size={17} /></button>
              </div>
            </div>
            <div className="paper">
              <input
                className="title-input"
                value={activeNote.title}
                onChange={(event) => updateNote({ title: event.target.value })}
                placeholder="Untitled note"
                aria-label="Note title"
              />
              <textarea
                className="body-input"
                value={activeNote.body}
                onChange={(event) => updateNote({ body: event.target.value })}
                placeholder="Start writing…"
                aria-label="Note body"
                autoFocus
              />
            </div>
          </article>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><FileText size={30} strokeWidth={1.4} /></div>
            <h1>Your thoughts, in one place.</h1>
            <p>Create your first note and give that idea somewhere to live.</p>
            <button onClick={createNote}><Plus size={17} />Create a note</button>
            <span>Press <kbd>N</kbd> anytime</span>
          </div>
        )}
      </section>

      {confirmingDelete && activeNote && (
        <div className="dialog-backdrop" onMouseDown={() => setConfirmingDelete(false)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dialog-icon"><AlertTriangle size={21} strokeWidth={1.8} /></div>
            <div className="dialog-copy">
              <h2 id="delete-dialog-title">Delete this note?</h2>
              <p id="delete-dialog-description">
                “{activeNote.title.trim() || "Untitled note"}” will be permanently removed from the database.
              </p>
            </div>
            <div className="dialog-actions">
              <button className="dialog-cancel" onClick={() => setConfirmingDelete(false)} autoFocus>Cancel</button>
              <button className="dialog-delete" onClick={deleteNote}><Trash2 size={15} />Delete note</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
