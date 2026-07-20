import { NextResponse } from "next/server";
import { openApiDocument } from "@/domain/openapi";

export function GET() {
  return NextResponse.json(openApiDocument);
}
