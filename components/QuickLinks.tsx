"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// The homepage's two real, usable entry points into this site's tools:
// open a wallet for any token ID in the configured collection, or check
// any contract's TBA compliance. Both just navigate to the same routes a
// visitor could type in by hand (/wallet/<id> and /checker?contract=<addr>)
// - no separate/parallel input mechanism, this just saves the typing.
export function QuickLinks({ defaultTokenId }: { defaultTokenId: string }) {
  const router = useRouter();
  const [tokenId, setTokenId] = useState(defaultTokenId);
  const [contract, setContract] = useState("");

  function openWallet(e: FormEvent) {
    e.preventDefault();
    const id = tokenId.trim();
    if (id) router.push(`/wallet/${encodeURIComponent(id)}`);
  }

  function openChecker(e: FormEvent) {
    e.preventDefault();
    const addr = contract.trim();
    router.push(
      addr ? `/checker?contract=${encodeURIComponent(addr)}` : "/checker",
    );
  }

  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      <form
        onSubmit={openWallet}
        className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-left"
      >
        <label
          htmlFor="quick-token-id"
          className="text-sm font-semibold text-neutral-200"
        >
          Open a wallet
        </label>
        <p className="text-xs text-neutral-500">
          Type the ID number of one NFT from this collection to see its Token
          Bound Account wallet.
        </p>
        <div className="flex gap-2">
          <input
            id="quick-token-id"
            className="min-w-0 flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            placeholder="1"
            inputMode="numeric"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-neutral-200"
          >
            Go →
          </button>
        </div>
      </form>

      <form
        onSubmit={openChecker}
        className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-left"
      >
        <label
          htmlFor="quick-contract"
          className="text-sm font-semibold text-neutral-200"
        >
          Check a contract
        </label>
        <p className="text-xs text-neutral-500">
          Paste any NFT contract address to check whether its Token Bound
          Account setup is the canonical Tokenbound implementation.
        </p>
        <div className="flex gap-2">
          <input
            id="quick-contract"
            className="min-w-0 flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-sm text-neutral-100"
            placeholder="0x..."
            value={contract}
            onChange={(e) => setContract(e.target.value)}
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-neutral-200"
          >
            Go →
          </button>
        </div>
      </form>
    </div>
  );
}
