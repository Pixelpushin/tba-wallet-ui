// Wallet holdings for a TBA address: native balance (always available, via
// plain RPC) plus ERC-20 + NFT balances (only available when ALCHEMY_API_KEY
// is configured - Alchemy's getNFTsForOwner / getTokenBalances endpoints do
// the heavy lifting there since there's no cheap on-chain way to enumerate
// "everything an address holds" otherwise). Without a key, the panel still
// works for activating and sending ETH; it just has nothing to list for
// ERC-20s/NFTs. This mirrors the real production app this UI was extracted
// from, which is Alchemy-backed for the same reason.
import { readEthBalance } from "@/lib/chainReads";
import { getConfig } from "@/lib/config";

export interface WalletNft {
  contractAddress: string;
  tokenId: string;
  name: string | null;
  imageUrl: string | null;
}

export interface WalletTokenBalance {
  contractAddress: string;
  balance: string; // raw uint256, decimal string
  symbol: string | null;
  name: string | null;
  decimals: number | null;
}

export interface WalletHoldings {
  address: string;
  ethBalanceWei: string;
  nfts: WalletNft[];
  tokenBalances: WalletTokenBalance[];
}

interface AlchemyNftItem {
  contract?: { address?: string };
  tokenId?: string;
  name?: string;
  image?: { cachedUrl?: string; originalUrl?: string };
}

interface AlchemyTokenBalanceItem {
  contractAddress?: string;
  tokenBalance?: string;
}

interface AlchemyTokenMetadata {
  name?: string;
  symbol?: string;
  decimals?: number;
}

function alchemyNftBase(): string | null {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) return null;
  const config = getConfig();
  return `https://${networkSlug(config.chainId)}.g.alchemy.com/nft/v3/${key}`;
}

function alchemyRpcUrl(): string | null {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) return null;
  const config = getConfig();
  return `https://${networkSlug(config.chainId)}.g.alchemy.com/v2/${key}`;
}

// Only the handful of chains Alchemy actually serves need a real slug -
// anything else falls back to "eth-mainnet" so this doesn't crash, though
// in practice the holdings fetch below just no-ops (empty tokenBalances/
// nfts) for chains Alchemy doesn't support at all.
function networkSlug(chainId: number): string {
  switch (chainId) {
    case 1:
      return "eth-mainnet";
    case 8453:
      return "base-mainnet";
    case 137:
      return "polygon-mainnet";
    case 10:
      return "opt-mainnet";
    case 42161:
      return "arb-mainnet";
    default:
      return "eth-mainnet";
  }
}

async function alchemyRpc<T>(method: string, params: unknown[]): Promise<T> {
  const url = alchemyRpcUrl();
  if (!url) throw new Error("ALCHEMY_API_KEY not configured");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message ?? `${method} failed`);
  return body.result as T;
}

async function fetchTokenMetadata(
  contractAddress: string,
): Promise<{
  symbol: string | null;
  name: string | null;
  decimals: number | null;
}> {
  try {
    const result = await alchemyRpc<AlchemyTokenMetadata>(
      "alchemy_getTokenMetadata",
      [contractAddress],
    );
    return {
      symbol: result.symbol ?? null,
      name: result.name ?? null,
      decimals: typeof result.decimals === "number" ? result.decimals : null,
    };
  } catch {
    return { symbol: null, name: null, decimals: null };
  }
}

/**
 * Full wallet holdings for a TBA address. ETH balance always comes from
 * plain RPC; ERC-20/NFT balances come from Alchemy when ALCHEMY_API_KEY is
 * set, and are empty arrays otherwise (never throws just because the
 * optional key is missing).
 */
export async function fetchWalletHoldings(
  address: string,
): Promise<WalletHoldings> {
  const ethBalanceWei = await readEthBalance(address);

  const nftBase = alchemyNftBase();
  if (!nftBase) {
    return { address, ethBalanceWei, nfts: [], tokenBalances: [] };
  }

  const [nftResult, tokenResult] = await Promise.all([
    fetch(`${nftBase}/getNFTsForOwner?owner=${address}&withMetadata=true`, {
      signal: AbortSignal.timeout(10_000),
    })
      .then((r) => r.json())
      .catch(() => ({ ownedNfts: [] as AlchemyNftItem[] })),
    alchemyRpc<{ tokenBalances?: AlchemyTokenBalanceItem[] }>(
      "alchemy_getTokenBalances",
      [address],
    ).catch(() => ({ tokenBalances: [] })),
  ]);

  const nfts: WalletNft[] = (
    (nftResult.ownedNfts ?? []) as AlchemyNftItem[]
  ).map((item) => ({
    contractAddress: item.contract?.address ?? "",
    tokenId: item.tokenId ?? "",
    name: item.name ?? null,
    imageUrl: item.image?.cachedUrl ?? item.image?.originalUrl ?? null,
  }));

  const rawTokenBalances = (tokenResult.tokenBalances ?? []).filter(
    (item) =>
      item.contractAddress &&
      item.tokenBalance &&
      BigInt(item.tokenBalance) > BigInt(0),
  );

  const tokenBalances: WalletTokenBalance[] = await Promise.all(
    rawTokenBalances.map(async (item) => {
      const meta = await fetchTokenMetadata(item.contractAddress as string);
      return {
        contractAddress: item.contractAddress as string,
        balance: BigInt(item.tokenBalance as string).toString(),
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
      };
    }),
  );

  return { address, ethBalanceWei, nfts, tokenBalances };
}
