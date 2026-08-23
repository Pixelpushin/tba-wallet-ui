import { NextRequest, NextResponse } from "next/server";

// Thin, transparent JSON-RPC proxy. The browser posts a standard JSON-RPC
// request body here (see lib/chainReads.ts, lib/txBuilders.ts via
// @pixelpushin/tba-kit, and lib/appkit.ts's Reown chain config, all of
// which now resolve to this same-origin path instead of the real upstream
// RPC URL - see lib/config.ts's resolveRpcUrl()). This route forwards the
// body verbatim to the real upstream RPC endpoint (RPC_URL, a server-only
// env var that commonly bakes in a billable API key, e.g. a paid Alchemy
// URL) and returns the upstream response verbatim. The point is keeping
// that real URL/key out of the client bundle entirely - it's read here via
// process.env on the server, never through a NEXT_PUBLIC_ var.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function upstreamRpcUrl(): string | null {
  const value = process.env.RPC_URL;
  return value && value.trim().length > 0 ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  const rpcUrl = upstreamRpcUrl();
  if (!rpcUrl) {
    return NextResponse.json(
      { error: "RPC_URL is not configured on this server." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const upstream = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("RPC proxy request failed", error);
    return NextResponse.json(
      { error: "Unable to reach the upstream RPC endpoint." },
      { status: 502 },
    );
  }
}
