// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ApiDocsPage from "@/app/docs/page";

describe("ApiDocsPage", () => {
  it("renders the OpenAPI operations without a browser-only documentation runtime", () => {
    render(<ApiDocsPage />);

    expect(screen.getByRole("heading", { name: "Papier Notes API" })).toBeTruthy();
    expect(screen.getByText("List notes")).toBeTruthy();
    expect(screen.getByText("Create a note")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View raw OpenAPI JSON" }).getAttribute("href")).toBe("api/openapi");
  });
});
