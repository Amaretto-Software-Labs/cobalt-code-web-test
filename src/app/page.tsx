"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, FileText, Menu, Palette, Plus, Search, Trash2, X } from "lucide-react";

const NOTE_COLORS = [
  { id: "coral", label: "Coral", value: "#e2673f" },
  { id: "gold", label: "Gold", value: "#d5a83d" },
  { id: "sage", label: "Sage", value: "#769475" },
  { id: "sky", label: "Sky", value: "#668fa9" },
  { id: "lilac", label: "Lilac", value: "#9179a8" },
  { id: "graphite", label: "Graphite", value: "#696d68" },
] as const;

type NoteColor = (typeof NOTE_COLORS)[number]["id"];

type Note = {
  id: string;
  title: string;
  body: string;
  color: NoteColor;
  updatedAt: number;
};

type SaveStatus = "loading" | "saved" | "saving" | "error";

const STORAGE_KEY = "papier-notes";

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
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadNotes() {
      try {
        const response = await fetch("/api/notes");
        if (!response.ok) throw new Error("Could not load notes");

        let databaseNotes = (await response.json()) as Note[];
        const saved = localStorage.getItem(STORAGE_KEY);

        if (databaseNotes.length === 0 && saved) {
          const localNotes = (
            JSON.parse(saved) as Array<Omit<Note, "color"> & { color?: NoteColor }>
          ).map((note) => ({ ...note, color: note.color ?? "coral" }));

          await Promise.all(
            localNotes.map(async (note) => {
              const migration = await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(note),
              });
              if (!migration.ok) throw new Error("Could not migrate notes");
            }),
          );
          databaseNotes = localNotes;
        }

        localStorage.removeItem(STORAGE_KEY);
        if (!cancelled) {
          setNotes(databaseNotes);
          setActiveId(databaseNotes[0]?.id ?? null);
          setSaveStatus("saved");
        }
      } catch {
        if (!cancelled) setSaveStatus("error");
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    loadNotes();
    const timers = saveTimers.current;
    return () => {
      cancelled = true;
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

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

  async function createNote() {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
      color: "coral",
      updatedAt: Date.now(),
    };
    setNotes((current) => [note, ...current]);
    setActiveId(note.id);
    setSidebarOpen(false);
    setSaveStatus("saving");

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note),
      });
      if (!response.ok) throw new Error("Could not create note");
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  function updateNote(changes: Partial<Pick<Note, "title" | "body" | "color">>) {
    if (!activeNote) return;
    const updatedNote = { ...activeNote, ...changes };
    setNotes((current) => current.map((note) => (note.id === activeId ? updatedNote : note)));
    setSaveStatus("saving");

    clearTimeout(saveTimers.current[updatedNote.id]);
    saveTimers.current[updatedNote.id] = setTimeout(async () => {
      try {
        const response = await fetch(`/api/notes/${updatedNote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedNote),
        });
        if (!response.ok) throw new Error("Could not save note");
        const savedNote = (await response.json()) as { updatedAt: number };
        setNotes((current) =>
          current.map((note) =>
            note.id === updatedNote.id ? { ...note, updatedAt: savedNote.updatedAt } : note,
          ),
        );
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 450);
  }

  async function deleteNote() {
    if (!activeNote) return;
    setSaveStatus("saving");
    clearTimeout(saveTimers.current[activeNote.id]);

    try {
      const response = await fetch(`/api/notes/${activeNote.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete note");
      const remaining = notes.filter((note) => note.id !== activeNote.id);
      setNotes(remaining);
      setActiveId(remaining[0]?.id ?? null);
      setSaveStatus("saved");
      setConfirmingDelete(false);
    } catch {
      setSaveStatus("error");
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
