// The "how to point this repo at your own NFT collection" instructions.
// Shown in three places: the homepage when this deployment has no env vars
// set yet, /setup (reachable from the live homepage via a small link), and
// the wallet page's "Not configured yet" notice. Keeping it in one place
// means the copy never drifts between those three spots.
export function SetupGuide({
  heading = "Setup: 5 steps",
}: {
  heading?: string;
}) {
  return (
    <div className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-left">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">{heading}</h2>
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
            <code className="text-neutral-300">NEXT_PUBLIC_TOKEN_CONTRACT</code>
            .
          </span>{" "}
          This is the address of your own NFT collection (an ERC-721 contract) -
          the one you want this wallet UI to work with. It is a long string of
          letters and numbers starting with{" "}
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
          one before the app will work. To get one for free, make a free account
          at Alchemy (alchemy.com) or Infura (infura.io), then copy the RPC URL
          they give you for your chain. Some chains also have a free public RPC
          URL that needs no signup. This one is deliberately NOT prefixed with{" "}
          <code className="text-neutral-300">NEXT_PUBLIC_</code> - real RPC URLs
          usually bake in a billable API key, and the app keeps it server-side
          only (see{" "}
          <code className="text-neutral-300">app/api/rpc/route.ts</code>) so it
          never ships to the browser.
        </li>
        <li>
          <span className="text-neutral-300">
            Set <code className="text-neutral-300">NEXT_PUBLIC_CHAIN_ID</code>.
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
          <code className="text-neutral-300">Ctrl+C</code> in the terminal) and
          start it again:
          <pre className="mt-1 overflow-x-auto rounded-md bg-neutral-900 px-3 py-2 text-xs text-neutral-300">
            npm run dev
          </pre>
          Then, in your browser, go to{" "}
          <code className="text-neutral-300">/wallet/&lt;tokenId&gt;</code>.
          Replace <code className="text-neutral-300">&lt;tokenId&gt;</code> with
          the ID number of one real NFT from your collection. For example, if
          you own NFT #1, go to{" "}
          <code className="text-neutral-300">/wallet/1</code>. The{" "}
          <code className="text-neutral-300">1</code> here is just an example
          number, not a fixed or special value - use whatever token ID your own
          NFT has.
        </li>
      </ol>
    </div>
  );
}
