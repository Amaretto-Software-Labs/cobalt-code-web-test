// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotesPage from "@/app/page";

const state = vi.hoisted(() => ({
  note: {
    id: "5e80db90-9a7f-4fa8-b4b5-8fc06f1b8baa",
    title: "Existing",
    body: "Text",
    color: "sage" as const,
    updatedAt: 1_700_000_000_000,
  },
}));

const update = vi.hoisted(() => vi.fn((id: string, changes: { body?: string }) => {
  if (id === state.note.id && changes.body !== undefined) state.note.body = changes.body;
}));

vi.mock("@/hooks/use-notes", () => ({
  useNotes: () => ({
    notes: [state.note],
    activeId: state.note.id,
    setActiveId: vi.fn(),
    ready: true,
    saveStatus: "saved",
    create: vi.fn(),
    update,
    remove: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

describe("NotesPage", () => {
  beforeEach(() => {
    state.note.body = "Text";
    update.mockClear();
  });

  it("shows a live character count beneath the body editor", () => {
    const { rerender } = render(<NotesPage />);
    const editor = screen.getByLabelText("Note body");
    const counter = screen.getByText("4 characters");

    expect(editor.getAttribute("aria-describedby")).toBe(counter.id);

    fireEvent.change(editor, { target: { value: "A longer note" } });
    rerender(<NotesPage />);

    expect(update).toHaveBeenCalledWith(state.note.id, { body: "A longer note" });
    expect(screen.getByText("13 characters")).toBeTruthy();
  });
});
