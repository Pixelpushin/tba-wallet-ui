// Wallet layer on top of Reown AppKit (see lib/appkit.ts for the client
// config). Function names/signatures here are the whole surface
// components/TbaWalletPanel.tsx talks to - swap this file's internals for a
// different wallet stack (wagmi/viem, RainbowKit, raw EIP-1193, ...) and the
// panel doesn't need to change at all.
import { BrowserProvider, type Eip1193Provider } from "ethers";
import { getAppKit } from "@/lib/appkit";

// Opens the AppKit connect modal (lists both WalletConnect/QR for mobile and
// any detected injected extension in one screen) and resolves once an
// account is connected. Rejects if the user closes the modal without
// connecting, or if AppKit fails to open at all (e.g. a bad/missing project
// ID).
export async function connectWallet(): Promise<string> {
  const modal = getAppKit();

  const existing = modal.getAccount();
  if (existing?.isConnected && existing.address) {
    return existing.address;
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      unsubscribeAccount();
      unsubscribeState();
      run();
    };

    const unsubscribeAccount = modal.subscribeAccount((state) => {
      if (state.isConnected && state.address) {
        finish(() => resolve(state.address as string));
      }
    });

    // If the modal closes without ever reporting a connected account, the
    // user dismissed it - reject rather than leaving the caller's promise
    // hanging forever.
    const unsubscribeState = modal.subscribeState((state) => {
      if (state.open) return;
      const account = modal.getAccount();
      if (account?.isConnected && account.address) {
        finish(() => resolve(account.address as string));
      } else {
        finish(() => reject(new Error("Wallet connection cancelled.")));
      }
    });

    modal.open({ view: "Connect" }).catch((err: unknown) => {
      finish(() =>
        reject(
          err instanceof Error
            ? err
            : new Error("Unable to open the wallet connect modal."),
        ),
      );
    });
  });
}

// Sends a real on-chain transaction from the connected wallet - used for TBA
// wallet actions (activate via createAccount, send via execute()). Returns
// the tx hash immediately (not waiting for confirmation) so the caller can
// decide how to show pending state.
export async function sendTransaction(
  address: string,
  tx: { to: string; data: string; value?: string },
): Promise<string> {
  const modal = getAppKit();
  const account = modal.getAccount();
  if (!account?.isConnected) {
    throw new Error("No wallet connected - click Connect Wallet first.");
  }

  const walletProvider = modal.getWalletProvider() as
    Eip1193Provider | undefined;
  if (!walletProvider) {
    throw new Error("No wallet provider available - reconnect your wallet.");
  }

  const browserProvider = new BrowserProvider(walletProvider);
  const signer = await browserProvider.getSigner(address);
  const response = await signer.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value ?? BigInt(0),
  });
  return response.hash;
}

// Fires whenever AppKit's connected account changes - covers both a
// same-provider account switch and a full disconnect (empty array). Also
// fires once, synchronously, with whatever AppKit already knows at subscribe
// time (AppKit persists connection state across reloads).
export function onAccountsChanged(
  callback: (accounts: string[]) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const modal = getAppKit();
  const current = modal.getAccount();
  callback(current?.isConnected && current.address ? [current.address] : []);
  return modal.subscribeAccount((state) => {
    callback(state.isConnected && state.address ? [state.address] : []);
  });
}

export function disconnectWallet(): Promise<void> {
  return getAppKit().disconnect();
}
