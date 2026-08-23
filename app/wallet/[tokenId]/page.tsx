import Link from "next/link";
import { ConfigError, getConfig } from "@/lib/config";
import { WalletDemo } from "@/components/WalletDemo";
import { SetupGuide } from "@/components/SetupGuide";

export const dynamic = "force-dynamic";

// Demo page showing how to wire TbaWalletPanel into a real route: resolve
// config, then hand off to WalletDemo (shared with the homepage) to compute
// the token's TBA address, fetch its holdings, and render the panel. This
// is the "how to use it" example - copy this pattern into your own app's
// token/profile page.
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

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-6 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ‹ back
      </Link>
      <WalletDemo tokenId={tokenId} config={config} />
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

      <SetupGuide heading="How to fix this: 5 steps" />
    </main>
  );
}
