// Central runtime configuration. Every value that makes this UI point at a
// *specific* NFT collection/chain lives here, read from environment
// variables (see .env.example) - nothing about the collection or chain is
// hardcoded in the component or lib code itself, so this whole repo can be
// pointed at a different project just by changing .env.local.
//
// getConfig() is called at request/render time inside Server Components
// and API routes (never at module load time), so `next build` succeeds
// even with no env vars set - pages that need it are marked
// `export const dynamic = "force-dynamic"` and only actually read env vars
// once a real request comes in.

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

export function getConfig(): TbaWalletConfig {
  const tokenContract = readEnv("NEXT_PUBLIC_TOKEN_CONTRACT");
  const rpcUrl = readEnv("NEXT_PUBLIC_RPC_URL");
  const chainIdRaw = readEnv("NEXT_PUBLIC_CHAIN_ID");

  const missing = [
    !tokenContract && "NEXT_PUBLIC_TOKEN_CONTRACT",
    !rpcUrl && "NEXT_PUBLIC_RPC_URL",
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
    rpcUrl: rpcUrl as string,
    chainId,
    chainIdHex: `0x${chainId.toString(16)}`,
    chainName: readEnv("NEXT_PUBLIC_CHAIN_NAME") ?? `Chain ${chainId}`,
    blockExplorerUrl:
      readEnv("NEXT_PUBLIC_BLOCK_EXPLORER_URL") ?? "https://etherscan.io",
    reownProjectId: readEnv("NEXT_PUBLIC_REOWN_PROJECT_ID"),
  };
}
