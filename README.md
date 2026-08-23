# TBA Wallet UI

A pre-built, drop-in React panel for letting NFT holders **activate and use
their ERC-6551 Token Bound Accounts (TBAs)**: activate the account, send
ETH, send ERC-20 tokens, and send NFTs (one at a time or in bulk) - all
straight out of the wallet that's bound to their NFT. Includes ENS name
resolution for recipients.

This is the missing piece that makes ERC-6551 usable for end users. TBAs let
an NFT itself hold assets (other tokens, NFTs, ETH) - but "the NFT has its
own wallet" is only useful if the holder has some UI to actually move things
in and out of it. That's what this repo is: a working reference
implementation, extracted and generalized from a production app, that you
can drop into your own NFT project.

> **Screenshot:** add one here (e.g. `docs/screenshot.png`) once you have a
> deployed instance to capture - none is included in this repo yet.

## What's in here

- `components/TbaWalletPanel.tsx` - the actual UI component. Ownership
  gating (only the NFT's current on-chain owner sees activate/send
  controls), one-time `createAccount` activation, an asset picker (ETH +
  any ERC-20/NFT the TBA holds, including a bulk "send all NFTs" option),
  ENS resolution with debounced lookups and inline resolved-address
  feedback, and busy/status/error/tx-hash states throughout.
- `lib/txBuilders.ts` - transaction builders for the "spend from an
  activated TBA" side of ERC-6551 (`buildSendEthTx`, `buildSendTokenTx`,
  `buildSendNftTx`, plus `computeTbaAddress`/`isTbaActivated`/
  `buildCreateAccountTx` re-exported from `@pixelpushin/tba-kit`). All of
  these encode calls through the account's `execute()` method - the
  standard way an ERC-6551 account moves its own held assets.
- `lib/wallet.ts` / `lib/appkit.ts` - the wallet-connection layer, built on
  [Reown AppKit](https://reown.com/appkit) with its ethers adapter (both
  injected-extension and WalletConnect/QR support out of the box).
- `lib/holdings.ts`, `lib/chainReads.ts`, `lib/ens.ts` - supporting reads
  (native/token/NFT balances, `ownerOf`, ENS resolution).
- `app/wallet/[tokenId]/page.tsx` - a real, runnable Next.js page showing
  how to wire all of the above together for one token, so you can see it
  work and copy the pattern into your own app.

## Why `@pixelpushin/tba-kit`

TBA address computation (the deterministic `account()` call against the
canonical ERC-6551 registry) is intentionally kept in a separate,
zero-dependency package,
[`@pixelpushin/tba-kit`](https://github.com/Pixelpushin/tba-kit), so every
project computing an address for the same `(implementation, chainId,
tokenContract, tokenId)` gets the exact same result. This repo depends on
it as a normal package (see `package.json`) rather than vendoring its code -
`lib/txBuilders.ts` re-exports what it needs and adds the "send" side of
things, which tba-kit deliberately leaves out.

## Getting started

```bash
git clone https://github.com/Pixelpushin/tba-wallet-ui.git
cd tba-wallet-ui
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Required | What it is |
| --- | --- | --- |
| `NEXT_PUBLIC_TOKEN_CONTRACT` | yes | The ERC-721 collection address this UI is gated to |
| `NEXT_PUBLIC_RPC_URL` | yes | JSON-RPC URL for the chain that collection lives on |
| `NEXT_PUBLIC_CHAIN_ID` | yes | Decimal chain ID (e.g. `1`, `8453`, `137`) |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | yes | Free WalletConnect/Reown Cloud project ID ([cloud.reown.com](https://cloud.reown.com)) |
| `NEXT_PUBLIC_CHAIN_NAME` | no | Display name for the chain (defaults to `Chain <id>`) |
| `NEXT_PUBLIC_BLOCK_EXPLORER_URL` | no | Used for "view transaction" / address links (defaults to Etherscan) |
| `ALCHEMY_API_KEY` | no | Enables full ERC-20 + NFT holdings listing via Alchemy. Without it, the demo still works for ETH activate/send, it just has no tokens/NFTs to list |
| `ENS_RPC_URL` | no | Mainnet RPC used for ENS name resolution (defaults to a public provider) |

Then:

```bash
npm run dev
```

Open `http://localhost:3000/wallet/<tokenId>` for any token ID in your
configured collection.

## Using the component in your own app

The reusable pieces are `components/TbaWalletPanel.tsx` plus everything
under `lib/`. Copy those into your project (or keep this repo as a
reference and adapt the pattern), point `lib/config.ts`'s environment
variables at your own collection/chain, and render:

```tsx
<TbaWalletPanel
  tokenId={tokenId}
  tbaAddress={tbaAddress}
  initialActivated={activated}
  ethBalanceWei={holdings.ethBalanceWei}
  tokenBalances={holdings.tokenBalances}
  nfts={holdings.nfts}
/>
```

`tbaAddress`/`activated`/`holdings` are computed server-side in
`app/wallet/[tokenId]/page.tsx` - see that file for the exact calls
(`computeTbaAddress`, `isTbaActivated`, `fetchWalletHoldings`).

If your project already uses a different wallet-connection stack
(wagmi/viem, RainbowKit, raw EIP-1193), `lib/wallet.ts` and `lib/appkit.ts`
are the only two files that talk to Reown AppKit directly - swap those two
for your own equivalents and the panel itself doesn't need to change.

## License

MIT - see [LICENSE](LICENSE).
