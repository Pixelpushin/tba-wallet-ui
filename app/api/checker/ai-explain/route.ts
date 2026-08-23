import { NextRequest, NextResponse } from "next/server";
import {
  explainFindings,
  detectProviderKind,
  type AiProviderKind,
} from "@/lib/aiProviders";

// Same-request passthrough for the optional AI explanation layer. The
// caller's API key travels in this one request body, is used exactly once
// to call the chosen provider, and is discarded when this function returns.
//
// IMPORTANT: never add logging of `body`, `apiKey`, or `findings` here (no
// console.log/console.error on the raw request) - that's the whole point of
// "used only for this request, never stored" in the UI copy. Error logging
// below intentionally logs only the error message, never the request body.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AiExplainRequestBody {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  findings?: unknown;
}

const VALID_PROVIDERS: AiProviderKind[] = ["anthropic", "openai", "custom"];

export async function POST(request: NextRequest) {
  let body: AiExplainRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { apiKey, baseUrl, model, findings } = body;
  let provider = body.provider as AiProviderKind | undefined;

  if (!apiKey?.trim()) {
    return NextResponse.json({ error: "apiKey is required." }, { status: 400 });
  }
  if (!findings) {
    return NextResponse.json(
      { error: "findings is required." },
      { status: 400 },
    );
  }

  if (!provider) {
    provider = detectProviderKind(apiKey) ?? undefined;
  }
  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      {
        error:
          "Could not determine AI provider from the key - pick one explicitly (anthropic, openai, or custom).",
      },
      { status: 400 },
    );
  }
  if (provider === "custom" && !baseUrl?.trim()) {
    return NextResponse.json(
      { error: "baseUrl is required when provider is 'custom'." },
      { status: 400 },
    );
  }

  try {
    const result = await explainFindings(
      { kind: provider, apiKey: apiKey.trim(), baseUrl, model },
      findings,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "AI explanation call failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI explanation failed for an unknown reason.",
      },
      { status: 502 },
    );
  }
}
