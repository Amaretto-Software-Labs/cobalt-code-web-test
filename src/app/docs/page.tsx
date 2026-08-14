import { openApiDocument } from "@/domain/openapi";

const operations = [
  { method: "GET", path: "/api/notes", summary: openApiDocument.paths["/api/notes"].get.summary },
  { method: "POST", path: "/api/notes", summary: openApiDocument.paths["/api/notes"].post.summary },
  { method: "PATCH", path: "/api/notes/{id}", summary: openApiDocument.paths["/api/notes/{id}"].patch.summary },
  { method: "DELETE", path: "/api/notes/{id}", summary: openApiDocument.paths["/api/notes/{id}"].delete.summary },
] as const;

export default function ApiDocsPage() {
  return (
    <main className="api-docs-page">
      <header className="api-docs-header">
        <span className="api-docs-kicker">Papier API reference</span>
        <h1>{openApiDocument.info.title}</h1>
        <p>{openApiDocument.info.description}</p>
        <a href="api/openapi">View raw OpenAPI JSON</a>
      </header>

      <section className="api-docs-auth" aria-labelledby="authentication-heading">
        <h2 id="authentication-heading">Authentication</h2>
        <p>
          Send <code>Authorization: Bearer &lt;token&gt;</code> with direct API requests. Browser requests use
          the preview-safe <code>X-Papier-Token</code> header.
        </p>
      </section>

      <section className="api-docs-operations" aria-labelledby="operations-heading">
        <h2 id="operations-heading">Endpoints</h2>
        <div className="api-operation-list">
          {operations.map((operation) => (
            <article className="api-operation" key={`${operation.method}-${operation.path}`}>
              <span className={`api-method api-method-${operation.method.toLowerCase()}`}>{operation.method}</span>
              <code>{operation.path}</code>
              <p>{operation.summary}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
