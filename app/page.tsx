import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">TBA Wallet UI</h1>
      <p className="text-neutral-400">
        A drop-in React panel for letting ERC-721 holders activate and use their
        ERC-6551 Token Bound Accounts - activate, send ETH, send ERC-20s, send
        NFTs (single + bulk), with ENS support.
      </p>
      <p className="text-sm text-neutral-500">
        Set <code className="text-neutral-300">NEXT_PUBLIC_TOKEN_CONTRACT</code>
        , <code className="text-neutral-300">NEXT_PUBLIC_RPC_URL</code>, and{" "}
        <code className="text-neutral-300">NEXT_PUBLIC_CHAIN_ID</code> in{" "}
        <code className="text-neutral-300">.env.local</code> (see{" "}
        <code className="text-neutral-300">.env.example</code>), then open a
        token&apos;s wallet page:
      </p>
      <Link
        href="/wallet/1"
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
      >
        View demo: /wallet/1 →
      </Link>
    </main>
  );
}
