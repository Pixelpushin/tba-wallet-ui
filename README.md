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
| `NEXT_PUBLIC_TOKEN_CONTRACT` | yes | The address of your own NFT collection (an ERC-721 contract) - this is the collection the wallet UI is gated to. It is a string starting with `0x`, e.g. `0xAbC1230000000000000000000000000000dEf9` |
| `NEXT_PUBLIC_RPC_URL` | yes | The "RPC URL" for the chain your collection lives on - this is the web address the app uses to talk to the blockchain (read balances, send transactions). Get a free one from an [Alchemy](https://alchemy.com) or [Infura](https://infura.io) account, or use a free public RPC if your chain has one (see `.env.example` for a working default on Ethereum mainnet) |
| `NEXT_PUBLIC_CHAIN_ID` | yes | The chain's numeric ID as a plain decimal number (e.g. `1` for Ethereum mainnet, `8453` for Base, `137` for Polygon). If you don't know your chain's number, look it up at [chainlist.org](https://chainlist.org) |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | yes | Free WalletConnect/Reown Cloud project ID ([cloud.reown.com](https://cloud.reown.com)) |
| `NEXT_PUBLIC_CHAIN_NAME` | no | Display name for the chain (defaults to `Chain <id>`) |
| `NEXT_PUBLIC_BLOCK_EXPLORER_URL` | no | Used for "view transaction" / address links (defaults to Etherscan) |
| `ALCHEMY_API_KEY` | no | Enables full ERC-20 + NFT holdings listing via Alchemy. Without it, the demo still works for ETH activate/send, it just has no tokens/NFTs to list |
| `ENS_RPC_URL` | no | Mainnet RPC used for ENS name resolution (defaults to a public provider) |

Then start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000/wallet/<tokenId>` in your browser, replacing
`<tokenId>` with the ID number of one real NFT you already own (or want to
test) in your configured collection. For example, `<tokenId>` = `1` means
NFT #1 - that "1" is just an example, not a fixed or required value.

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

## TBA Compliance Checker (`/checker`)

A second, self-contained tool in this repo: paste an NFT contract address,
token ID, and chain, and get a factual report on whether that token's
ERC-6551 Token Bound Account setup uses Tokenbound's canonical reference
implementation or a custom one.

**Why this exists.** TBA deployment is always permissionless and free
(gas-only) through the single canonical ERC-6551 registry
(`0x000000006551c19487814612e58FE06813775758`, identical on every EVM
chain) - anyone can call `createAccount()` for any token at any time, no
project's permission required. But a project can deploy its own custom
implementation contract with extra logic in `execute()` (e.g. requiring a
payment before sends work), which is where "activate your wallet" confusion
comes from. This tool answers, mechanically and without guessing:

1. What address would the canonical setup produce for this token?
2. Has an account actually been created for it yet, and with which
   implementation (discovered directly from the registry's
   `ERC6551AccountCreated` event - no user input required to find this)?
3. Does that implementation match Tokenbound's known canonical bytecode?
4. Is its source verified on a block explorer, and if so, what functions
   does it expose beyond the standard `execute`/`isValidSigner`/`token`/
   `state`/`supportsInterface` interface?
5. Optionally, a plain-English summary of the above from an AI provider you
   bring your own key for (Anthropic, OpenAI, or any OpenAI-compatible
   endpoint) - purely factual, no "this is safe/unsafe"-style language, and
   fully optional (the report works completely without it).

Every finding is reported in neutral, factual language - no
"warning"/"red flag"/"scam" wording anywhere in the UI or generated text.
This is fact-gathering to help you DYOR, not a verdict.

**Chains supported:** Ethereum mainnet, Base (both via Etherscan's unified
V2 API), and Robinhood Chain (via its Blockscout explorer, no API key
needed).

**Setup:** works out of the box for Robinhood Chain. For verified-source
checks on Ethereum mainnet / Base, add one more variable to `.env.local`:

```bash
ETHERSCAN_API_KEY=your-etherscan-api-key
```

(Free at [etherscan.io/apis](https://etherscan.io/apis) - Etherscan's V2 API
now covers Base too, so one key works for both chains. Without it, those two
chains still work for every check except verified-source/extra-functions,
which report plainly that no explorer key is configured, rather than
guessing.)

**Module layout** (self-contained, meant to be liftable onto another
site/subdomain wholesale):

- `lib/complianceCheck.ts` - all mechanical checks: canonical address
  computation, on-chain `ERC6551AccountCreated` log discovery, bytecode
  diffing against known reference hashes, explorer source/ABI checks.
- `lib/aiProviders.ts` - the multi-provider AI abstraction (Anthropic /
  OpenAI / custom OpenAI-compatible).
- `app/api/checker/analyze/route.ts` - server route running the mechanical
  checks (keeps `ETHERSCAN_API_KEY` server-side).
- `app/api/checker/ai-explain/route.ts` - same-request passthrough for the
  optional AI call; your key is used once for that single request and is
  never logged or persisted.
- `components/ComplianceChecker/` - the form + report UI.
- `app/checker/page.tsx` - the route (`/checker`).

None of the above imports anything from `lib/config.ts`,
`components/TbaWalletPanel.tsx`, or the rest of this repo's
single-collection env config - it takes chain/contract/token as direct user
input instead.

## License

MIT - see [LICENSE](LICENSE).
