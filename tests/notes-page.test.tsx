// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotesPage from "@/app/page";

const state = vi.hoisted(() => ({
  authenticationRequired: false,
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
    authenticationRequired: state.authenticationRequired,
    authenticate: vi.fn(),
    create: vi.fn(),
    update,
    remove: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

describe("NotesPage", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    state.authenticationRequired = false;
    state.note.body = "Text";
    update.mockClear();
  });

  it("shows the configured local token on the unlock screen", () => {
    vi.stubEnv("NEXT_PUBLIC_PAPIER_LOCAL_TOKEN", "papier-local");
    state.authenticationRequired = true;

    render(<NotesPage />);

    expect(screen.getByText("Local preview token:")).toBeTruthy();
    expect(screen.getByText("papier-local")).toBeTruthy();
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
