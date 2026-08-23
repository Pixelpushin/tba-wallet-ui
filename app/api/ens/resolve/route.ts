import { NextRequest, NextResponse } from "next/server";
import { resolveEnsName } from "@/lib/ens";

// Resolves an ENS name server-side so TbaWalletPanel (a client component)
// never needs an RPC/API key in the browser bundle.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing name." }, { status: 400 });
  }

  try {
    const address = await resolveEnsName(name);
    return NextResponse.json({ address });
  } catch (error) {
    console.error(`Failed to resolve ENS name "${name}"`, error);
    return NextResponse.json(
      { error: "Unable to resolve ENS name right now." },
      { status: 502 },
    );
  }
}
