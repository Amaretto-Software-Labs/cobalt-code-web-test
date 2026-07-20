import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API documentation — Papier",
  description: "Interactive documentation for the Papier Notes API.",
};

export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
