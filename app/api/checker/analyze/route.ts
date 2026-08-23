import { NextRequest, NextResponse } from "next/server";
import {
  runComplianceCheck,
  CHAINS,
  type ChainKey,
} from "@/lib/complianceCheck";

// Runs the mechanical (non-AI) TBA compliance checks server-side, so the
// optional ETHERSCAN_API_KEY never has to reach the browser. Everything
// this route touches is public on-chain data or a public explorer API - no
// user secrets pass through here (the AI key, if any, only goes to
// app/api/checker/ai-explain, never to this route).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnalyzeRequestBody {
  chainKey?: string;
  tokenContract?: string;
  tokenId?: string;
  claimedTbaAddress?: string;
  implementationOverride?: string;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function POST(request: NextRequest) {
  let body: AnalyzeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    chainKey,
    tokenContract,
    tokenId,
    claimedTbaAddress,
    implementationOverride,
  } = body;

  if (!chainKey || !(chainKey in CHAINS)) {
    return NextResponse.json(
      { error: `chainKey must be one of: ${Object.keys(CHAINS).join(", ")}.` },
      { status: 400 },
    );
  }
  if (!tokenContract || !ADDRESS_RE.test(tokenContract.trim())) {
    return NextResponse.json(
      { error: "tokenContract must be a valid 0x-prefixed address." },
      { status: 400 },
    );
  }
  if (!tokenId || !/^\d+$/.test(tokenId.trim())) {
    return NextResponse.json(
      { error: "tokenId must be a non-negative integer." },
      { status: 400 },
    );
  }
  if (claimedTbaAddress?.trim() && !ADDRESS_RE.test(claimedTbaAddress.trim())) {
    return NextResponse.json(
      {
        error:
          "claimedTbaAddress must be a valid 0x-prefixed address if provided.",
      },
      { status: 400 },
    );
  }
  if (
    implementationOverride?.trim() &&
    !ADDRESS_RE.test(implementationOverride.trim())
  ) {
    return NextResponse.json(
      {
        error:
          "implementationOverride must be a valid 0x-prefixed address if provided.",
      },
      { status: 400 },
    );
  }

  try {
    const report = await runComplianceCheck(
      {
        chainKey: chainKey as ChainKey,
        tokenContract: tokenContract.trim(),
        tokenId: tokenId.trim(),
        claimedTbaAddress: claimedTbaAddress?.trim() || undefined,
        implementationOverride: implementationOverride?.trim() || undefined,
      },
      { etherscanApiKey: process.env.ETHERSCAN_API_KEY },
    );
    return NextResponse.json({ report });
  } catch (error) {
    console.error("Compliance check failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Compliance check failed for an unknown reason.",
      },
      { status: 502 },
    );
  }
}
