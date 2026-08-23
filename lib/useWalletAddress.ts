"use client";

// Shared "is a wallet connected, and to what address" hook. AppKit is a
// single module-scoped singleton (see lib/appkit.ts), so multiple
// independent subscribers correctly see the same live state with no shared
// React context or prop drilling required.
import { useEffect, useState } from "react";
import { onAccountsChanged } from "@/lib/wallet";

export function useWalletAddress(): string | null {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    return onAccountsChanged((accounts) => {
      setAddress(accounts?.length ? accounts[0] : null);
    });
  }, []);

  return address;
}
