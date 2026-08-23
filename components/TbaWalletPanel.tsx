"use client";

// The main UI: a panel gated to an NFT's on-chain owner, with buttons to
// activate its ERC-6551 Token Bound Account (one-time createAccount), send
// ETH, send an ERC-20, and send an NFT the TBA holds (either one at a time,
// or all of them in one bulk action) - plus ENS name resolution for
// recipients.
//
// Gated to the token's actual current owner: anyone can render this panel,
// but only the connected wallet matching on-chain ownerOf(tokenId) can
// activate or send from it (the account contract enforces this itself via
// isValidSigner - this is just a UI-level check to avoid showing a button
// that would only revert).
import { useEffect, useMemo, useState } from "react";
import { isAddress, parseUnits } from "ethers";
import { connectWallet, sendTransaction } from "@/lib/wallet";
import { useWalletAddress } from "@/lib/useWalletAddress";
import {
  buildCreateAccountTx,
  buildSendEthTx,
  buildSendNftTx,
  buildSendTokenTx,
  isTbaActivated,
} from "@/lib/txBuilders";
import { readOwnerOf } from "@/lib/chainReads";
import { getConfig } from "@/lib/config";
import type { WalletHoldings, WalletNft } from "@/lib/holdings";
import { WalletIcon } from "@/components/icons";

interface AssetOption {
  key: string; // "eth" | an ERC-20 contract address | `nft:<contract>:<tokenId>` | ALL_NFTS_KEY
  label: string;
  kind: "native" | "erc20" | "nft";
  decimals?: number;
  balanceRaw?: string;
  nft?: WalletNft;
}

// Dedicated key for the bulk "send every NFT" option, distinct from any
// single NFT's own `nft:<contract>:<tokenId>` key.
const ALL_NFTS_KEY = "__all_nfts__";

type EnsStatus = "idle" | "loading" | "resolved" | "error";

// Only worth a resolve attempt if the value can't already be a raw address
// and looks like a dotted name (".eth" or any other TLD) - avoids firing a
// request on every keystroke of a pasted 0x address.
function looksLikeEnsName(value: string): boolean {
  const isRawAddress: boolean = Boolean(isAddress(value));
  return !isRawAddress && value.includes(".");
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function nftKey(nft: WalletNft): string {
  return `nft:${nft.contractAddress}:${nft.tokenId}`;
}

function nftLabel(nft: WalletNft): string {
  return nft.name ?? `#${nft.tokenId}`;
}

// Polls isTbaActivated after sending the createAccount tx - the RPC needs
// the transaction actually mined before the account has real code.
async function waitForActivation(tbaAddress: string): Promise<boolean> {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await isTbaActivated(tbaAddress)) return true;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return false;
}

export function TbaWalletPanel({
  tokenId,
  tbaAddress,
  initialActivated,
  ethBalanceWei,
  tokenBalances,
  nfts,
  onActivated,
}: {
  tokenId: string;
  tbaAddress: string;
  initialActivated: boolean;
  ethBalanceWei: string;
  tokenBalances: WalletHoldings["tokenBalances"];
  nfts: WalletNft[];
  /** Optional hook for your own app to react to activation (e.g. invalidate a cache). */
  onActivated?: (account: string, tokenId: string, tbaAddress: string) => void;
}) {
  const config = getConfig();
  const connectedAddress = useWalletAddress();
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  const [activated, setActivated] = useState(initialActivated);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readOwnerOf(tokenId)
      .then((owner) => {
        if (!cancelled) setOwnerAddress(owner);
      })
      .catch(() => {
        if (!cancelled) setOwnerAddress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  const assets = useMemo<AssetOption[]>(
    () => [
      {
        key: "eth",
        label: "ETH",
        kind: "native",
        decimals: 18,
        balanceRaw: ethBalanceWei,
      },
      ...tokenBalances.map((token): AssetOption => ({
        key: token.contractAddress,
        label: token.symbol ?? token.name ?? token.contractAddress,
        kind: "erc20",
        decimals: token.decimals ?? 18,
        balanceRaw: token.balance,
      })),
    ],
    [ethBalanceWei, tokenBalances],
  );

  const [assetKey, setAssetKey] = useState("eth");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  // NFTs are indivisible (always exactly one), so the amount input only
  // makes sense for ETH/ERC-20. Clearing it on switch avoids a stale value
  // lingering in state once it's hidden.
  const isNftSelection =
    assetKey === ALL_NFTS_KEY || assetKey.startsWith("nft:");
  function handleAssetKeyChange(next: string) {
    setAssetKey(next);
    if (next === ALL_NFTS_KEY || next.startsWith("nft:")) setAmount("");
  }

  // Resolution results are keyed by the exact recipient text they were
  // resolved/errored for, and ensStatus below is derived by comparing that
  // key against the live recipient text rather than stored as its own
  // state - editing the recipient automatically invalidates a stale result.
  const [ensResolvedFor, setEnsResolvedFor] = useState<string | null>(null);
  const [ensResolvedAddress, setEnsResolvedAddress] = useState<string | null>(
    null,
  );
  const [ensErrorFor, setEnsErrorFor] = useState<string | null>(null);
  const [ensError, setEnsError] = useState<string | null>(null);

  const trimmedRecipient = recipient.trim();
  const isEnsLike = looksLikeEnsName(trimmedRecipient);
  const ensStatus: EnsStatus = !isEnsLike
    ? "idle"
    : ensResolvedFor === trimmedRecipient && ensResolvedAddress
      ? "resolved"
      : ensErrorFor === trimmedRecipient && ensError
        ? "error"
        : "loading";

  // Debounced ENS resolution, always against Ethereum mainnet (see
  // app/api/ens/resolve/route.ts / lib/ens.ts).
  useEffect(() => {
    if (!isEnsLike) return;
    if (
      ensResolvedFor === trimmedRecipient ||
      ensErrorFor === trimmedRecipient
    ) {
      return; // already have a fresh result for this exact text
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/ens/resolve?name=${encodeURIComponent(trimmedRecipient)}`,
        );
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || !body.address) {
          setEnsErrorFor(trimmedRecipient);
          setEnsError("That ENS name doesn't resolve to an address.");
          return;
        }
        setEnsResolvedFor(trimmedRecipient);
        setEnsResolvedAddress(body.address);
      } catch {
        if (!cancelled) {
          setEnsErrorFor(trimmedRecipient);
          setEnsError("Unable to resolve that ENS name right now.");
        }
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedRecipient, isEnsLike, ensResolvedFor, ensErrorFor]);

  const isOwner =
    connectedAddress && ownerAddress
      ? connectedAddress.toLowerCase() === ownerAddress.toLowerCase()
      : false;

  async function handleActivate() {
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      const account = await connectWallet();
      if (account.toLowerCase() !== ownerAddress?.toLowerCase()) {
        throw new Error(
          "Connected wallet doesn't currently own this token - switch wallets and try again.",
        );
      }
      setStatus("Confirm the activation in your wallet...");
      const hash = await sendTransaction(
        account,
        buildCreateAccountTx(tokenId),
      );
      setTxHash(hash);
      setStatus("Activating - waiting for confirmation on-chain...");
      const confirmed = await waitForActivation(tbaAddress);
      if (!confirmed) {
        throw new Error(
          "Transaction sent, but activation isn't confirmed yet - check the explorer link and refresh in a bit.",
        );
      }
      setActivated(true);
      setStatus("Wallet activated - you can now send from it below.");
      onActivated?.(account, tokenId, tbaAddress);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      const account = await connectWallet();
      if (account.toLowerCase() !== ownerAddress?.toLowerCase()) {
        throw new Error(
          "Connected wallet doesn't currently own this token - switch wallets and try again.",
        );
      }
      let targetAddress: string;
      if (isAddress(trimmedRecipient)) {
        targetAddress = trimmedRecipient;
      } else if (ensStatus === "resolved" && ensResolvedAddress) {
        // Always the freshly-resolved address, never the raw ENS string -
        // ensStatus/ensResolvedAddress are derived against the live
        // recipient text, so this can't be stale from a previous name.
        targetAddress = ensResolvedAddress;
      } else if (ensStatus === "loading") {
        throw new Error(
          "Still resolving that ENS name - wait a moment and try again.",
        );
      } else {
        throw new Error("Enter a valid recipient address or ENS name.");
      }

      // Bulk NFT send. No batching primitive exists for a TBA's execute()
      // (unlike a signature-authorized claim flow, which can cover many
      // tokenIds under one signed message), so this is a sequential loop:
      // one on-chain tx, one wallet confirmation, per NFT.
      if (assetKey === ALL_NFTS_KEY) {
        if (nfts.length === 0) throw new Error("No NFTs to send.");
        let lastHash: string | null = null;
        for (let i = 0; i < nfts.length; i++) {
          const nft = nfts[i];
          setStatus(
            `Confirm sending ${i + 1} of ${nfts.length} in your wallet...`,
          );
          const tx = buildSendNftTx(
            tbaAddress,
            nft.contractAddress,
            nft.tokenId,
            targetAddress,
          );
          lastHash = await sendTransaction(account, tx);
        }
        setTxHash(lastHash);
        setStatus(
          `Sent all ${nfts.length} NFTs - waiting for confirmation on-chain.`,
        );
        setRecipient("");
        return;
      }

      // Single NFT send.
      if (assetKey.startsWith("nft:")) {
        const asset = assets.find((a) => a.key === assetKey);
        const nft = asset?.nft ?? nfts.find((n) => nftKey(n) === assetKey);
        if (!nft) throw new Error("Pick an NFT to send.");
        const tx = buildSendNftTx(
          tbaAddress,
          nft.contractAddress,
          nft.tokenId,
          targetAddress,
        );
        setStatus("Confirm the send in your wallet...");
        const hash = await sendTransaction(account, tx);
        setTxHash(hash);
        setStatus("Sent - waiting for confirmation on-chain.");
        setRecipient("");
        return;
      }

      const asset = assets.find((a) => a.key === assetKey);
      if (
        !asset ||
        asset.decimals === undefined ||
        asset.balanceRaw === undefined
      ) {
        throw new Error("Pick an asset to send.");
      }

      const amountRaw = parseUnits(amount || "0", asset.decimals);
      if (amountRaw <= BigInt(0)) {
        throw new Error("Enter an amount greater than zero.");
      }
      if (amountRaw > BigInt(asset.balanceRaw)) {
        throw new Error("Amount exceeds this wallet's balance.");
      }

      const tx =
        asset.key === "eth"
          ? buildSendEthTx(tbaAddress, targetAddress, amountRaw)
          : buildSendTokenTx(tbaAddress, asset.key, targetAddress, amountRaw);

      setStatus("Confirm the send in your wallet...");
      const hash = await sendTransaction(account, tx);
      setTxHash(hash);
      setStatus("Sent - waiting for confirmation on-chain.");
      setAmount("");
      setRecipient("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        Token Bound Wallet
      </div>

      {!connectedAddress && (
        <p className="text-sm text-neutral-400">
          Connect the wallet that owns this token to activate or send from here.
        </p>
      )}

      {connectedAddress && ownerAddress && !isOwner && (
        <p className="text-sm text-neutral-400">
          Connected wallet doesn&apos;t own token #{tokenId} right now - connect
          the wallet that does to activate or send from here.
        </p>
      )}

      {connectedAddress && isOwner && !activated && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-neutral-400">
            This wallet can already receive assets. Enabling sending (one-time,
            your gas) lets it send/spend too.
          </p>
          <button
            type="button"
            className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
            disabled={busy}
            onClick={handleActivate}
          >
            {busy ? (
              "Working..."
            ) : (
              <>
                <WalletIcon className="h-4 w-4" />
                Enable Sending
              </>
            )}
          </button>
        </div>
      )}

      {connectedAddress && isOwner && activated && (
        <form className="flex flex-col gap-2" onSubmit={handleSend}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100"
              value={assetKey}
              onChange={(e) => handleAssetKeyChange(e.target.value)}
            >
              <optgroup label="Tokens">
                {assets.map((asset) => (
                  <option key={asset.key} value={asset.key}>
                    {asset.label}
                  </option>
                ))}
              </optgroup>
              {nfts.length > 0 && (
                <optgroup label="NFTs">
                  {nfts.map((nft) => (
                    <option key={nftKey(nft)} value={nftKey(nft)}>
                      {nftLabel(nft)}
                    </option>
                  ))}
                  <option value={ALL_NFTS_KEY}>All NFTs ({nfts.length})</option>
                </optgroup>
              )}
            </select>
            {!isNftSelection && (
              <input
                className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100"
                placeholder="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
            )}
          </div>
          {assetKey === ALL_NFTS_KEY && (
            <p className="text-xs text-neutral-500">
              Sends every NFT in this wallet, one at a time - your wallet will
              ask you to confirm each one separately ({nfts.length} total).
            </p>
          )}
          <input
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100"
            placeholder="recipient address (0x...) or ENS name"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          {ensStatus === "loading" && (
            <p className="text-xs text-neutral-500">resolving ENS name...</p>
          )}
          {ensStatus === "resolved" && ensResolvedAddress && (
            <p className="font-mono text-xs text-emerald-400">
              → {truncateAddress(ensResolvedAddress)}
            </p>
          )}
          {ensStatus === "error" && ensError && (
            <p className="text-xs text-red-400">{ensError}</p>
          )}
          <button
            type="submit"
            className="inline-flex w-fit items-center rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
            disabled={busy || ensStatus === "loading"}
          >
            {busy ? "Working..." : "Send"}
          </button>
        </form>
      )}

      {status && <p className="text-xs text-emerald-400">{status}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {txHash && (
        <a
          href={`${config.blockExplorerUrl}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-mono text-xs text-blue-400 hover:underline"
        >
          view transaction
        </a>
      )}
    </div>
  );
}
