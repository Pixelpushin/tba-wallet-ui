import type { TbaWalletConfig } from "@/lib/config";
import { computeTbaAddress, isTbaActivated } from "@/lib/txBuilders";
import { fetchWalletHoldings } from "@/lib/holdings";
import { TbaWalletPanel } from "@/components/TbaWalletPanel";

function formatEth(wei: string): string {
  const WEI_PER_ETH = BigInt("1000000000000000000");
  const value = BigInt(wei);
  const whole = value / WEI_PER_ETH;
  const frac = value % WEI_PER_ETH;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${fracStr}`;
}

// The actual live wallet demo: computes the token's TBA address, checks
// whether it's activated, fetches its holdings, and renders the panel.
// Shared by app/wallet/[tokenId]/page.tsx (the canonical "how to use it in
// your own app" example route) and app/page.tsx (which renders this same
// content directly at "/" once this deployment is configured, so a visitor
// lands on real working content with zero extra clicks). Callers are
// expected to have already resolved config via getConfig() - this component
// only handles failures further down the chain (RPC/holdings lookups).
export async function WalletDemo({
  tokenId,
  config,
}: {
  tokenId: string;
  config: TbaWalletConfig;
}) {
  let tbaAddress: string | null = null;
  let activated = false;
  let loadError: string | null = null;
  try {
    tbaAddress = await computeTbaAddress(tokenId);
    activated = await isTbaActivated(tbaAddress);
  } catch {
    loadError =
      "Unable to compute this token's TBA address right now - check RPC_URL and try refreshing.";
  }

  const holdings =
    tbaAddress && !loadError
      ? await fetchWalletHoldings(tbaAddress).catch(() => null)
      : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          {config.chainName} token #{tokenId}
        </h1>
        {tbaAddress ? (
          <a
            href={`${config.blockExplorerUrl}/address/${tbaAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-mono text-xs text-blue-400 hover:underline"
          >
            {tbaAddress}
          </a>
        ) : (
          <p className="text-sm text-red-400">{loadError}</p>
        )}
      </div>

      {holdings && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="mb-1 text-xs text-neutral-500">Native balance</div>
          <div className="text-lg font-medium">
            {formatEth(holdings.ethBalanceWei)} ETH
          </div>
        </div>
      )}

      {tbaAddress && holdings && (
        <TbaWalletPanel
          tokenId={tokenId}
          tbaAddress={tbaAddress}
          initialActivated={activated}
          ethBalanceWei={holdings.ethBalanceWei}
          tokenBalances={holdings.tokenBalances}
          nfts={holdings.nfts}
        />
      )}

      {!process.env.ALCHEMY_API_KEY && (
        <p className="text-xs text-neutral-600">
          Set ALCHEMY_API_KEY to also list ERC-20 and NFT balances here -
          without it this demo only shows the native balance and lets you
          activate/send ETH.
        </p>
      )}
    </>
  );
}
