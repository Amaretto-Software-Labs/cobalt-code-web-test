import SwaggerParser from "@apidevtools/swagger-parser";
import { describe, expect, it } from "vitest";
import { openApiDocument } from "@/domain/openapi";

describe("OpenAPI document", () => {
  it("is a valid OpenAPI specification", async () => {
    const document = JSON.parse(JSON.stringify(openApiDocument));
    await expect(SwaggerParser.validate(document)).resolves.toMatchObject({ openapi: "3.1.0" });
  });

  it("documents every notes operation", () => {
    expect(openApiDocument.paths["/api/notes"]).toHaveProperty("get");
    expect(openApiDocument.paths["/api/notes"]).toHaveProperty("post");
    expect(openApiDocument.paths["/api/notes/{id}"]).toHaveProperty("patch");
    expect(openApiDocument.paths["/api/notes/{id}"]).toHaveProperty("delete");
  });

  it("documents the bounded cursor pagination contract", () => {
    const list = openApiDocument.paths["/api/notes"].get;
    expect(list.parameters).toEqual([
      { $ref: "#/components/parameters/PageCursor" },
      { $ref: "#/components/parameters/PageLimit" },
    ]);
    expect(openApiDocument.components.parameters.PageLimit.schema).toMatchObject({
      default: 10,
      maximum: 100,
    });
    expect(openApiDocument.components.schemas.NotesPage.properties.items.maxItems).toBe(100);
    expect(openApiDocument.components.schemas.NotesPage.required).toContain("totalCount");
    expect(openApiDocument.components.schemas.NotesPage.properties.totalCount.minimum).toBe(0);
  });
});
