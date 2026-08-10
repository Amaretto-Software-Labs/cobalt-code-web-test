"use client";

import { useEffect, useRef, useState } from "react";
import * as notesApi from "@/client/notes-api";
import { parseLegacyNotes, type CreateNoteInput, type Note, type NoteChanges } from "@/domain/note";

export type SaveStatus = "loading" | "saved" | "saving" | "error";

const STORAGE_KEY = "papier-notes";
const SAVE_DELAY_MS = 450;

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const notesRef = useRef<Note[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queues = useRef(new Map<string, Promise<unknown>>());
  const pendingNotes = useRef(new Map<string, Note>());
  const operationCount = useRef(0);
  const loadingMoreRef = useRef(false);

  function beginOperation() {
    operationCount.current += 1;
    setSaveStatus("saving");
  }

  function finishOperation(error?: unknown) {
    operationCount.current = Math.max(0, operationCount.current - 1);
    if (error) setSaveStatus("error");
    else if (operationCount.current === 0) setSaveStatus("saved");
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
      (error) => {
        clearQueue();
        finishOperation(error);
      },
    );
    return next;
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const page = await notesApi.listNotes();
        let databaseNotes = page.items;
        let databaseNextCursor = page.nextCursor;
        let databaseTotalCount = page.totalCount;
        const saved = localStorage.getItem(STORAGE_KEY);

        if (databaseNotes.length === 0 && saved) {
          const localNotes = parseLegacyNotes(saved);
          databaseNotes = await Promise.all(
            localNotes.map(({ title, body, color }) => notesApi.createNote({ title, body, color })),
          );
          databaseNextCursor = null;
          databaseTotalCount = databaseNotes.length;
        }

        localStorage.removeItem(STORAGE_KEY);
        if (!cancelled) {
          notesRef.current = databaseNotes;
          setNotes(databaseNotes);
          setNextCursor(databaseNextCursor);
          setTotalCount(databaseTotalCount);
          setActiveId(databaseNotes[0]?.id ?? null);
          setSaveStatus("saved");
        }
      } catch {
        if (!cancelled) setSaveStatus("error");
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

  async function loadMore() {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const page = await notesApi.listNotes(nextCursor);
      const knownIds = new Set(notesRef.current.map((note) => note.id));
      notesRef.current = [...notesRef.current, ...page.items.filter((note) => !knownIds.has(note.id))];
      setNotes(notesRef.current);
      setNextCursor(page.nextCursor);
      setTotalCount(page.totalCount);
    } catch (error) {
      setLoadMoreError(true);
      throw error;
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  async function create() {
    const input: CreateNoteInput = {
      title: "",
      body: "",
      color: "coral",
    };
    let failed = false;
    beginOperation();
    try {
      const note = await notesApi.createNote(input);
      notesRef.current = [note, ...notesRef.current];
      setNotes(notesRef.current);
      setTotalCount((count) => count + 1);
      setActiveId(note.id);
      return note;
    } catch (error) {
      failed = true;
      finishOperation(error);
      throw error;
    } finally {
      if (!failed) finishOperation();
    }
  }

  function update(id: string, changes: Partial<NoteChanges>) {
    const currentNote = notesRef.current.find((note) => note.id === id);
    if (!currentNote) return;
    const updatedNote = { ...currentNote, ...changes };
    notesRef.current = notesRef.current.map((note) => (note.id === id ? updatedNote : note));
    setNotes(notesRef.current);
    pendingNotes.current.set(id, updatedNote);
    setSaveStatus("saving");

    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        const pending = pendingNotes.current.get(id);
        if (!pending) return;
        pendingNotes.current.delete(id);
        void enqueue(id, () => notesApi.updateNote(id, pending)).then(
          (saved) => {
            notesRef.current = notesRef.current.map((note) =>
              note.id === id ? { ...note, updatedAt: saved.updatedAt } : note,
            );
            setNotes(notesRef.current);
          },
          () => undefined,
        );
      }, SAVE_DELAY_MS),
    );
  }

  async function remove(id: string) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    pendingNotes.current.delete(id);
    try {
      await enqueue(id, () => notesApi.deleteNote(id));
    } catch (error) {
      setSaveStatus("error");
      throw error;
    }
    notesRef.current = notesRef.current.filter((note) => note.id !== id);
    setNotes(notesRef.current);
    setTotalCount((count) => Math.max(0, count - 1));
    setActiveId((selected) => (selected === id ? (notesRef.current[0]?.id ?? null) : selected));
  }

  return {
    notes,
    activeId,
    setActiveId,
    ready,
    saveStatus,
    totalCount,
    hasMore: nextCursor !== null,
    loadingMore,
    loadMoreError,
    loadMore,
    create,
    update,
    remove,
  };
}
