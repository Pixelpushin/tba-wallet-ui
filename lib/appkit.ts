// Reown AppKit (formerly WalletConnect) client-side singleton. Gives you a
// connect modal that handles both injected browser extensions AND
// WalletConnect (QR/mobile) through one unified flow.
//
// Ethers adapter, not wagmi/viem: this repo already depends on `ethers`
// (via @pixelpushin/tba-kit's consumer-side transaction encoding in
// lib/txBuilders.ts), so this avoids a second, redundant web3 stack for the
// same job. Swap this file for a wagmi/viem equivalent if that's what your
// own project already standardizes on - lib/wallet.ts is the only other
// file that touches AppKit directly, so that's the whole surface to
// replace.
"use client";

import { createAppKit, type AppKit } from "@reown/appkit";
import { defineChain } from "@reown/appkit/networks";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { getConfig } from "@/lib/config";

let appKit: AppKit | undefined;

// Lazily created, module-scoped singleton - AppKit must only be initialized
// once per page load (it injects a global `<appkit-modal>` web component)
// and must never be constructed during SSR (it touches `window`), so this
// is only ever called from client code paths (lib/wallet.ts's functions).
export function getAppKit(): AppKit {
  const config = getConfig();
  if (!config.reownProjectId) {
    throw new Error(
      "NEXT_PUBLIC_REOWN_PROJECT_ID is not set - wallet connect is unavailable. " +
        "Get a free project ID at https://cloud.reown.com and add it to .env.local.",
    );
  }

  if (!appKit) {
    const chain = defineChain({
      id: config.chainId,
      caipNetworkId: `eip155:${config.chainId}`,
      chainNamespace: "eip155",
      name: config.chainName,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: {
        default: { http: [config.rpcUrl] },
      },
      blockExplorers: {
        default: { name: "Explorer", url: config.blockExplorerUrl },
      },
    });

    appKit = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [chain],
      defaultNetwork: chain,
      projectId: config.reownProjectId,
      metadata: {
        name: "TBA Wallet UI",
        description: "Token Bound Account activate/send UI",
        url:
          typeof window !== "undefined"
            ? window.location.origin
            : "http://localhost:3000",
        icons: [],
      },
      features: {
        analytics: false,
        email: false,
        socials: false,
        swaps: false,
        onramp: false,
      },
      themeMode: "dark",
    });
  }
  return appKit;
}
