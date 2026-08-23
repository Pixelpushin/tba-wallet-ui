import Link from "next/link";
import { ConfigError, getConfig } from "@/lib/config";
import { computeTbaAddress, isTbaActivated } from "@/lib/txBuilders";
import { fetchWalletHoldings } from "@/lib/holdings";
import { TbaWalletPanel } from "@/components/TbaWalletPanel";

export const dynamic = "force-dynamic";

function formatEth(wei: string): string {
  const WEI_PER_ETH = BigInt("1000000000000000000");
  const value = BigInt(wei);
  const whole = value / WEI_PER_ETH;
  const frac = value % WEI_PER_ETH;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${fracStr}`;
}

// Demo page showing how to wire TbaWalletPanel into a real route: compute
// the token's TBA address, check whether it's activated, fetch its
// holdings, and pass all of that down as props. This is the "how to use
// it" example - copy this pattern into your own app's token/profile page.
export default async function WalletPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;

  let config;
  try {
    config = getConfig();
  } catch (err) {
    return (
      <ConfigNotice
        message={
          err instanceof ConfigError
            ? err.message
            : "Configuration error - see .env.example."
        }
      />
    );
  }

  let tbaAddress: string | null = null;
  let activated = false;
  let loadError: string | null = null;
  try {
    tbaAddress = await computeTbaAddress(tokenId);
    activated = await isTbaActivated(tbaAddress);
  } catch {
    loadError =
      "Unable to compute this token's TBA address right now - check NEXT_PUBLIC_RPC_URL and try refreshing.";
  }

  const holdings =
    tbaAddress && !loadError
      ? await fetchWalletHoldings(tbaAddress).catch(() => null)
      : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-6 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ‹ back
      </Link>

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
    </main>
  );
}

function ConfigNotice({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Not configured yet</h1>
      <p className="whitespace-pre-wrap text-sm text-neutral-400">{message}</p>
    </main>
  );
}
