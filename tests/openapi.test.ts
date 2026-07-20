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
});
