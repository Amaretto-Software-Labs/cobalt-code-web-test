import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Papier — Notes",
  description: "A quiet place for your thoughts.",
};

const themeInitializer = `
  (() => {
    try {
      const savedTheme = localStorage.getItem("papier-theme");
      const theme = savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch {}
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
