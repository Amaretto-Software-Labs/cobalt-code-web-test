"use client";

import { useEffect, useRef, useState } from "react";
import * as notesApi from "@/client/notes-api";
import { parseLegacyNotes, type Note, type NoteChanges } from "@/domain/note";

export type SaveStatus = "loading" | "saved" | "saving" | "error";

const STORAGE_KEY = "papier-notes";
const SAVE_DELAY_MS = 450;

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [canRetry, setCanRetry] = useState(false);
  const notesRef = useRef<Note[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queues = useRef(new Map<string, Promise<unknown>>());
  const pendingNotes = useRef(new Map<string, Note>());
  const failedNotes = useRef(new Map<string, Note>());
  const operationCount = useRef(0);
  const lastOperationFailed = useRef(false);
  const readyRef = useRef(false);
  const loadFailed = useRef(false);

  function refreshPersistence() {
    if (!readyRef.current) return;
    setCanRetry(failedNotes.current.size > 0);
    if (loadFailed.current || lastOperationFailed.current || failedNotes.current.size > 0) {
      setSaveStatus("error");
    } else if (pendingNotes.current.size > 0 || timers.current.size > 0 || operationCount.current > 0) {
      setSaveStatus("saving");
    } else {
      setSaveStatus("saved");
    }
  }

  function beginOperation() {
    operationCount.current += 1;
    lastOperationFailed.current = false;
    refreshPersistence();
  }

  function finishOperation() {
    operationCount.current = Math.max(0, operationCount.current - 1);
    refreshPersistence();
  }

  function enqueue<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const previous = queues.current.get(id) ?? Promise.resolve();
    beginOperation();
    const next = previous.catch(() => undefined).then(operation);
    queues.current.set(id, next);
    const clearQueue = () => {
      if (queues.current.get(id) === next) queues.current.delete(id);
    };
    void next.then(
      () => {
        clearQueue();
        finishOperation();
      },
      () => {
        clearQueue();
        lastOperationFailed.current = true;
        finishOperation();
      },
    );
    return next;
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let databaseNotes = await notesApi.listNotes();
        const saved = localStorage.getItem(STORAGE_KEY);

        if (databaseNotes.length === 0 && saved) {
          const localNotes = parseLegacyNotes(saved);
          databaseNotes = await Promise.all(localNotes.map((note) => notesApi.createNote(note)));
        }

        localStorage.removeItem(STORAGE_KEY);
        if (!cancelled) {
          notesRef.current = databaseNotes;
          setNotes(databaseNotes);
          setActiveId(databaseNotes[0]?.id ?? null);
          readyRef.current = true;
          loadFailed.current = false;
          refreshPersistence();
        }
      } catch {
        if (!cancelled) {
          readyRef.current = true;
          loadFailed.current = true;
          refreshPersistence();
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    function flushPendingNotes() {
      for (const note of pendingNotes.current.values()) {
        void fetch(`/api/notes/${note.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(note),
          keepalive: true,
        });
      }
    }

    void load();
    window.addEventListener("pagehide", flushPendingNotes);
    const activeTimers = timers.current;
    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", flushPendingNotes);
      flushPendingNotes();
      activeTimers.forEach(clearTimeout);
    };
  }, []);

  function create() {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
      color: "coral",
      updatedAt: Date.now(),
    };
    notesRef.current = [note, ...notesRef.current];
    setNotes(notesRef.current);
    setActiveId(note.id);
    void enqueue(note.id, () => notesApi.createNote(note)).catch(() => undefined);
    return note;
  }

  function update(id: string, changes: Partial<NoteChanges>) {
    const currentNote = notesRef.current.find((note) => note.id === id);
    if (!currentNote) return;
    const updatedNote = { ...currentNote, ...changes };
    notesRef.current = notesRef.current.map((note) => (note.id === id ? updatedNote : note));
    setNotes(notesRef.current);
    pendingNotes.current.set(id, updatedNote);
    failedNotes.current.delete(id);

    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        const pending = pendingNotes.current.get(id);
        if (!pending) return;
        void enqueue(id, () => notesApi.updateNote(id, pending)).then(
          (saved) => {
            if (pendingNotes.current.get(id) === pending) {
              pendingNotes.current.delete(id);
              failedNotes.current.delete(id);
            }
            notesRef.current = notesRef.current.map((note) =>
              note.id === id ? { ...note, updatedAt: saved.updatedAt } : note,
            );
            setNotes(notesRef.current);
          },
          () => {
            if (pendingNotes.current.get(id) === pending) {
              failedNotes.current.set(id, pending);
            }
            refreshPersistence();
          },
        );
        refreshPersistence();
      }, SAVE_DELAY_MS),
    );
    refreshPersistence();
  }

  function retryFailed() {
    for (const [id, failed] of failedNotes.current) {
      if (pendingNotes.current.get(id) !== failed) continue;
      failedNotes.current.delete(id);
      void enqueue(id, () => notesApi.updateNote(id, failed)).then(
        (saved) => {
          if (pendingNotes.current.get(id) === failed) {
            pendingNotes.current.delete(id);
            notesRef.current = notesRef.current.map((note) =>
              note.id === id ? { ...note, updatedAt: saved.updatedAt } : note,
            );
            setNotes(notesRef.current);
          }
          refreshPersistence();
        },
        () => {
          if (pendingNotes.current.get(id) === failed) failedNotes.current.set(id, failed);
          refreshPersistence();
        },
      );
    }
    refreshPersistence();
  }

  async function remove(id: string) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    pendingNotes.current.delete(id);
    failedNotes.current.delete(id);
    try {
      await enqueue(id, () => notesApi.deleteNote(id));
    } catch (error) {
      throw error;
    }
    notesRef.current = notesRef.current.filter((note) => note.id !== id);
    setNotes(notesRef.current);
    setActiveId((selected) => (selected === id ? (notesRef.current[0]?.id ?? null) : selected));
  }

  return {
    notes,
    activeId,
    setActiveId,
    ready,
    saveStatus,
    canRetry,
    create,
    update,
    retryFailed,
    remove,
  };
}
