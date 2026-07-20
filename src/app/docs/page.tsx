"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function ApiDocsPage() {
  return (
    <main className="swagger-page">
      <SwaggerUI
        url="/api/openapi"
        deepLinking
        displayRequestDuration
        docExpansion="list"
        filter
        tryItOutEnabled
      />
    </main>
  );
}
