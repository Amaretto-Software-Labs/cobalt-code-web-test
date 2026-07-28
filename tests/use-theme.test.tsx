// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useTheme } from "@/hooks/use-theme";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "";
  });

  it("uses the theme initialized on the document", async () => {
    document.documentElement.dataset.theme = "dark";

    const { result } = renderHook(() => useTheme());

    await waitFor(() => expect(result.current.theme).toBe("dark"));
  });

  it("toggles and persists the selected theme", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem("papier-theme")).toBe("dark");
  });
});
