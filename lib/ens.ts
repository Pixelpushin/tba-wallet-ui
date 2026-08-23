// ENS name resolution for the recipient field, always against Ethereum
// mainnet's registry regardless of what chain your collection itself lives
// on (ENS doesn't exist per-chain). Server only - must never be imported
// from a client component.
import { JsonRpcProvider, getDefaultProvider } from "ethers";

let cachedProvider: ReturnType<typeof getDefaultProvider> | null = null;

// Uses ENS_RPC_URL if set (recommended - a shared public/free-tier RPC will
// rate-limit under real traffic); otherwise falls back to ethers' built-in
// getDefaultProvider("mainnet"), which round-robins several public
// providers with no API key required, fine for local dev/demo use.
function mainnetProvider() {
  if (!cachedProvider) {
    const url = process.env.ENS_RPC_URL;
    cachedProvider = url
      ? new JsonRpcProvider(url)
      : getDefaultProvider("mainnet");
  }
  return cachedProvider;
}

/**
 * Resolves an ENS name (e.g. "vitalik.eth") to a checksummed address - null
 * if the name doesn't resolve to anything, never throws for a plain
 * "not found" case.
 */
export async function resolveEnsName(name: string): Promise<string | null> {
  return mainnetProvider().resolveName(name);
}
