import { NOTE_COLORS, NOTE_LIMITS } from "@/domain/note";

const colorIds = NOTE_COLORS.map((color) => color.id);

const errorResponses = {
  "400": {
    description: "The request is invalid.",
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  },
  "404": {
    description: "The note was not found.",
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  },
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Papier Notes API",
    version: "1.0.0",
    description: "Create, read, update, and delete notes stored in PostgreSQL.",
  },
  servers: [{ url: "/", description: "Current application" }],
  tags: [{ name: "Notes", description: "Note persistence operations" }],
  paths: {
    "/api/notes": {
      get: {
        tags: ["Notes"],
        summary: "List notes",
        operationId: "listNotes",
        parameters: [
          { $ref: "#/components/parameters/PageCursor" },
          { $ref: "#/components/parameters/PageLimit" },
        ],
        responses: {
          "200": {
            description: "Notes ordered by most recently updated.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NotesPage" },
              },
            },
          },
          "400": errorResponses["400"],
        },
      },
      post: {
        tags: ["Notes"],
        summary: "Create a note",
        operationId: "createNote",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateNoteInput" } } },
        },
        responses: {
          "201": {
            description: "The created note.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Note" } } },
          },
          "400": errorResponses["400"],
        },
      },
    },
    "/api/notes/{id}": {
      parameters: [{ $ref: "#/components/parameters/NoteId" }],
      patch: {
        tags: ["Notes"],
        summary: "Update a note",
        operationId: "updateNote",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/NoteChanges" } } },
        },
        responses: {
          "200": {
            description: "The updated note.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Note" } } },
          },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Notes"],
        summary: "Delete a note",
        operationId: "deleteNote",
        responses: {
          "204": { description: "The note was deleted." },
          ...errorResponses,
        },
      },
    },
  },
  components: {
    parameters: {
      NoteId: {
        name: "id",
        in: "path",
        required: true,
        description: "The note UUID.",
        schema: { type: "string", format: "uuid" },
      },
      PageCursor: {
        name: "cursor",
        in: "query",
        description: "Opaque continuation cursor returned by the previous page.",
        schema: { type: "string" },
      },
      PageLimit: {
        name: "limit",
        in: "query",
        description: "Number of notes to return.",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
      },
    },
    schemas: {
      Note: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "body", "color", "updatedAt"],
        properties: {
          id: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
          title: { type: "string", maxLength: NOTE_LIMITS.title, example: "Project ideas" },
          body: { type: "string", maxLength: NOTE_LIMITS.body, example: "Build a quiet place to think." },
          color: { type: "string", enum: colorIds, example: "sage" },
          updatedAt: { type: "integer", format: "int64", minimum: 0, example: 1784577600000 },
        },
      },
      NotesPage: {
        type: "object",
        additionalProperties: false,
        required: ["items", "nextCursor", "totalCount"],
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/Note" }, maxItems: 100 },
          nextCursor: { type: ["string", "null"] },
          totalCount: {
            type: "integer",
            minimum: 0,
            description: "Total number of notes in the collection across all pages.",
          },
        },
      },
      NoteChanges: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body", "color"],
        properties: {
          title: { type: "string", maxLength: NOTE_LIMITS.title, example: "Updated project ideas" },
          body: { type: "string", maxLength: NOTE_LIMITS.body, example: "Build an even quieter place to think." },
          color: { type: "string", enum: colorIds, example: "sky" },
        },
      },
      CreateNoteInput: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body", "color"],
        properties: {
          title: { type: "string", maxLength: NOTE_LIMITS.title, example: "Project ideas" },
          body: { type: "string", maxLength: NOTE_LIMITS.body, example: "Build a quiet place to think." },
          color: { type: "string", enum: colorIds, example: "sage" },
        },
      },
      Error: {
        type: "object",
        additionalProperties: false,
        required: ["error"],
        properties: { error: { type: "string", example: "Note not found" } },
      },
    },
  },
} as const;
