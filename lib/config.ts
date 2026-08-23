// Central runtime configuration. Every value that makes this UI point at a
// *specific* NFT collection/chain lives here, read from environment
// variables (see .env.example) - nothing about the collection or chain is
// hardcoded in the component or lib code itself, so this whole repo can be
// pointed at a different project just by changing .env.local.
//
// getConfig() is called at request/render time inside Server Components,
// Client Components, and API routes (never at module load time), so
// `next build` succeeds even with no env vars set - pages that need it are
// marked `export const dynamic = "force-dynamic"` and only actually read
// env vars once a real request comes in.

export interface TbaWalletConfig {
  tokenContract: string;
  chainId: number;
  chainIdHex: string;
  chainName: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  reownProjectId: string | undefined;
}

export class ConfigError extends Error {}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

// Same-origin path that app/api/rpc/route.ts listens on. Every browser-side
// caller (lib/chainReads.ts, lib/txBuilders.ts via @pixelpushin/tba-kit,
// lib/appkit.ts's Reown chain config) resolves to this proxy instead of the
// real upstream RPC endpoint.
const CLIENT_RPC_PROXY_PATH = "/api/rpc";

// Deliberately NOT read via NEXT_PUBLIC_ - RPC_URL commonly bakes in a
// billable API key (e.g. https://<network>.g.alchemy.com/v2/<key>). A
// NEXT_PUBLIC_ var gets inlined verbatim into the client JS bundle at build
// time, which would let anyone view-source the key and run up charges on
// whoever's account funds it (see README.md / .env.example). Reading this
// as a bare env var means webpack/turbopack never inlines it into client
// bundles, and in the browser `process.env.RPC_URL` is simply `undefined` -
// so this branch only ever resolves on the server. Client code instead
// gets a same-origin path to the proxy in app/api/rpc/route.ts, which reads
// this same server-only var and forwards the request upstream.
function resolveRpcUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${CLIENT_RPC_PROXY_PATH}`;
  }
  const rpcUrl = readEnv("RPC_URL");
  if (!rpcUrl) {
    throw new ConfigError(
      "Missing required environment variable: RPC_URL. " +
        "Copy .env.example to .env.local, fill it in, and restart the dev server.",
    );
  }
  return rpcUrl;
}

export function getConfig(): TbaWalletConfig {
  const tokenContract = readEnv("NEXT_PUBLIC_TOKEN_CONTRACT");
  const chainIdRaw = readEnv("NEXT_PUBLIC_CHAIN_ID");

  const missing = [
    !tokenContract && "NEXT_PUBLIC_TOKEN_CONTRACT",
    !chainIdRaw && "NEXT_PUBLIC_CHAIN_ID",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new ConfigError(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Copy .env.example to .env.local, fill them in, and restart the dev server.",
    );
  }

  const chainId = Number(chainIdRaw);
  if (!Number.isFinite(chainId) || chainId <= 0) {
    throw new ConfigError(
      `NEXT_PUBLIC_CHAIN_ID must be a positive number, got "${chainIdRaw}".`,
    );
  }

  return {
    tokenContract: tokenContract as string,
    rpcUrl: resolveRpcUrl(),
    chainId,
    chainIdHex: `0x${chainId.toString(16)}`,
    chainName: readEnv("NEXT_PUBLIC_CHAIN_NAME") ?? `Chain ${chainId}`,
    blockExplorerUrl:
      readEnv("NEXT_PUBLIC_BLOCK_EXPLORER_URL") ?? "https://etherscan.io",
    reownProjectId: readEnv("NEXT_PUBLIC_REOWN_PROJECT_ID"),
  };
}
