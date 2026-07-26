"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "papier-theme";

function savedTheme(): Theme | null {
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : null;
}

function systemTheme(media: MediaQueryList): Theme {
  return media.matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (nextTheme: Theme) => {
      document.documentElement.dataset.theme = nextTheme;
      setTheme(nextTheme);
    };

    applyTheme(savedTheme() ?? systemTheme(media));

    const followSystemPreference = (event: MediaQueryListEvent) => {
      if (!savedTheme()) applyTheme(event.matches ? "dark" : "light");
    };

    media.addEventListener("change", followSystemPreference);
    return () => media.removeEventListener("change", followSystemPreference);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      return nextTheme;
    });
  }, []);

  return { theme, toggleTheme };
}
