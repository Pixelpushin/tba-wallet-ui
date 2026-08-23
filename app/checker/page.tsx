import { Suspense } from "react";
import { ComplianceChecker } from "@/components/ComplianceChecker";

// Standalone route for the TBA Compliance Checker - intentionally separate
// from /wallet/[tokenId] (this repo's activate/send demo). No dependency on
// lib/config.ts's single-collection env vars: this page works for any
// contract/chain a visitor types in, out of the box.
export const metadata = {
  title: "TBA Compliance Checker",
  description:
    "Check whether an NFT collection's ERC-6551 Token Bound Account setup uses the canonical Tokenbound reference implementation or a custom one.",
};

// Forces per-request rendering instead of a build-time static shell, so a
// visitor arriving via /checker?contract=0x... (from the homepage's "Check
// a contract" quick-launch field) gets the prefilled form in the initial
// HTML response, not just after client-side hydration.
export const dynamic = "force-dynamic";

export default function CheckerPage() {
  return (
    <main className="px-6 py-12">
      {/* ComplianceChecker reads ?contract= via useSearchParams, which
          requires a Suspense boundary for prerendering to succeed. */}
      <Suspense fallback={null}>
        <ComplianceChecker />
      </Suspense>
    </main>
  );
}
