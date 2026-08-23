import Link from "next/link";
import { getConfig } from "@/lib/config";
import { WalletDemo } from "@/components/WalletDemo";
import { QuickLinks } from "@/components/QuickLinks";
import { SetupGuide } from "@/components/SetupGuide";

export const dynamic = "force-dynamic";

// Default token ID shown as the live wallet example on this homepage - not
// special, just a starting point. Visitors can use the "Open a wallet"
// field in QuickLinks to jump to any other token ID in the collection.
const DEMO_TOKEN_ID = "1";

export default function Home() {
  let config;
  try {
    config = getConfig();
  } catch {
    config = null;
  }

  // Configured deployment (e.g. tools.hoodchan.org): this instance already
  // points at a real NFT collection, so show the real, usable tools right
  // here instead of instructions for setting up something that's already
  // set up. Un-configured template clones (someone ran `git clone` and
  // hasn't filled in .env.local yet) fall through to the setup guide below.
  if (config) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">TBA Wallet UI</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Live tools for {config.chainName} Token Bound Accounts: open any
              wallet in this collection, or check any contract&apos;s TBA setup.
            </p>
          </div>
          <Link
            href="/setup"
            className="shrink-0 text-xs text-neutral-500 hover:underline"
          >
            How to use this in your own project →
          </Link>
        </div>

        <QuickLinks defaultTokenId={DEMO_TOKEN_ID} />

        <div className="flex flex-col gap-4 border-t border-neutral-800 pt-6">
          <h2 className="text-sm font-semibold text-neutral-200">
            Live example: token #{DEMO_TOKEN_ID}
          </h2>
          <WalletDemo tokenId={DEMO_TOKEN_ID} config={config} />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center gap-8 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-semibold">TBA Wallet UI</h1>
        <p className="text-neutral-400">
          A ready-to-use panel for NFT projects. It lets someone who owns an NFT
          turn on a special wallet linked to that NFT (this is called a Token
          Bound Account, or TBA). From that wallet they can send ETH, send other
          tokens, and send NFTs - one at a time or many at once. It also
          supports ENS names (like &quot;alice.eth&quot;) instead of long wallet
          addresses.
        </p>
      </div>

      <SetupGuide />

      <Link
        href="/wallet/1"
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
      >
        View demo: /wallet/1 →
      </Link>
    </main>
  );
}
