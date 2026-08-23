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
      "Unable to compute this token's TBA address right now - check RPC_URL and try refreshing.";
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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center gap-6 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-xl font-semibold">Not configured yet</h1>
        <p className="text-sm text-neutral-500">
          This app needs a few settings before it can show a wallet page.
        </p>
      </div>

      <div className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-left">
        <p className="mb-1 text-xs font-semibold text-neutral-300">
          What the app found wrong:
        </p>
        <p className="whitespace-pre-wrap text-sm text-neutral-400">
          {message}
        </p>
      </div>

      <div className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-left">
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">
          How to fix this: 5 steps
        </h2>
        <ol className="list-decimal space-y-4 pl-5 text-sm text-neutral-400">
          <li>
            <span className="text-neutral-300">
              Copy the example settings file.
            </span>{" "}
            Open a terminal in this project folder and run this command:
            <pre className="mt-1 overflow-x-auto rounded-md bg-neutral-900 px-3 py-2 text-xs text-neutral-300">
              cp .env.example .env.local
            </pre>
            This creates a new file,{" "}
            <code className="text-neutral-300">.env.local</code>, for your own
            settings. It is not shared with anyone else.
          </li>
          <li>
            <span className="text-neutral-300">
              Set{" "}
              <code className="text-neutral-300">
                NEXT_PUBLIC_TOKEN_CONTRACT
              </code>
              .
            </span>{" "}
            This is the address of your own NFT collection (an ERC-721 contract)
            - the one you want this wallet UI to work with. It is a long string
            of letters and numbers starting with{" "}
            <code className="text-neutral-300">0x</code>, for example:{" "}
            <code className="text-neutral-300">
              0xAbC1230000000000000000000000000000dEf9
            </code>
          </li>
          <li>
            <span className="text-neutral-300">
              Set <code className="text-neutral-300">RPC_URL</code>.
            </span>{" "}
            An &quot;RPC URL&quot; is a web address this app uses to talk to the
            blockchain, so it can read balances and send transactions. You need
            one before the app will work. To get one for free, make a free
            account at Alchemy (alchemy.com) or Infura (infura.io), then copy
            the RPC URL they give you for your chain. Some chains also have a
            free public RPC URL that needs no signup. This one is deliberately
            NOT prefixed with{" "}
            <code className="text-neutral-300">NEXT_PUBLIC_</code> - real RPC
            URLs usually bake in a billable API key, and the app keeps it
            server-side only so it never ships to the browser.
          </li>
          <li>
            <span className="text-neutral-300">
              Set <code className="text-neutral-300">NEXT_PUBLIC_CHAIN_ID</code>
              .
            </span>{" "}
            This is a number that tells the app which blockchain to use. For
            example, <code className="text-neutral-300">1</code> means Ethereum
            mainnet, and <code className="text-neutral-300">8453</code> means
            Base. If you do not know the number for your chain, look it up at
            chainlist.org.
          </li>
          <li>
            <span className="text-neutral-300">
              Restart the app, then open a wallet page.
            </span>{" "}
            Save the file. Stop the running server (press{" "}
            <code className="text-neutral-300">Ctrl+C</code> in the terminal)
            and start it again:
            <pre className="mt-1 overflow-x-auto rounded-md bg-neutral-900 px-3 py-2 text-xs text-neutral-300">
              npm run dev
            </pre>
            Then, in your browser, go to{" "}
            <code className="text-neutral-300">/wallet/&lt;tokenId&gt;</code>.
            Replace <code className="text-neutral-300">&lt;tokenId&gt;</code>{" "}
            with the ID number of one real NFT from your collection. For
            example, if you own NFT #1, go to{" "}
            <code className="text-neutral-300">/wallet/1</code>. The{" "}
            <code className="text-neutral-300">1</code> here is just an example
            number, not a fixed or special value - use whatever token ID your
            own NFT has.
          </li>
        </ol>
      </div>
    </main>
  );
}
