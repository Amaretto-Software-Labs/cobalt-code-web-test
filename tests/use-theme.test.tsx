// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, useTheme } from "@/hooks/use-theme";

function mockSystemTheme(dark: boolean) {
  let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
  const addEventListener = vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
    if (event === "change") changeListener = listener;
  });
  const removeEventListener = vi.fn();
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: dark,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener,
    removeEventListener,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
  return {
    addEventListener,
    removeEventListener,
    change(matches: boolean) {
      changeListener?.({ matches } as MediaQueryListEvent);
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

describe("useTheme", () => {
  it("defaults to the system preference without persisting it", async () => {
    mockSystemTheme(true);
    const { result } = renderHook(() => useTheme());

    await waitFor(() => expect(result.current.theme).toBe("dark"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("restores a saved choice instead of the system preference", async () => {
    mockSystemTheme(true);
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    const { result } = renderHook(() => useTheme());

    await waitFor(() => expect(result.current.theme).toBe("light"));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("toggles and persists the explicit choice", async () => {
    mockSystemTheme(false);
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("follows system changes only until the user makes an explicit choice", async () => {
    const system = mockSystemTheme(false);
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.theme).toBe("light"));

    act(() => system.change(true));
    expect(result.current.theme).toBe("dark");

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("light");

    act(() => system.change(true));
    expect(result.current.theme).toBe("light");
  });

  it("continues to work when browser storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    mockSystemTheme(true);
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.theme).toBe("dark"));

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
