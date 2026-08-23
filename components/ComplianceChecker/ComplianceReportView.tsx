"use client";

import type { ComplianceReport } from "@/lib/complianceCheck";

interface ComplianceReportViewProps {
  report: ComplianceReport;
  aiExplanation?: string;
  aiError?: string;
}

function short(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Deliberately plain, scannable markup - no icons/colors implying
// good/bad, just labeled facts in the order laid out in the design spec.
// See README.md "TBA Compliance Checker" for the full explanation of what
// each section means. Tone constraint: no "red flag"/"warning"/"scam"
// language anywhere in this file, ever - state facts, let the reader draw
// conclusions.
export function ComplianceReportView({
  report,
  aiExplanation,
  aiError,
}: ComplianceReportViewProps) {
  const {
    input,
    registry,
    discoveredOnChain,
    implementation,
    computedTbaAddress,
    claimedAddressComparison,
    bytecode,
    explorer,
  } = report;

  return (
    <div className="space-y-6 text-sm">
      {/* 1. Contract / token / chain checked */}
      <section>
        <h3 className="font-semibold text-base mb-1">What was checked</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="opacity-70">Chain</dt>
          <dd>
            {input.chainLabel} (chain ID {input.chainId})
          </dd>
          <dt className="opacity-70">NFT contract</dt>
          <dd className="font-mono break-all">{input.tokenContract}</dd>
          <dt className="opacity-70">Token ID</dt>
          <dd>{input.tokenId}</dd>
        </dl>
      </section>

      {/* 2. Canonical registry used + computed address + deployment status */}
      <section>
        <h3 className="font-semibold text-base mb-1">
          Registry &amp; computed address
        </h3>
        <p className="mb-2">
          Canonical ERC-6551 registry used: <strong>yes</strong> - TBA
          deployment for any token always goes through this single
          permissionless registry, on every EVM chain.
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="opacity-70">Registry address</dt>
          <dd className="font-mono break-all">{registry.address}</dd>
          <dt className="opacity-70">Computed TBA address</dt>
          <dd className="font-mono break-all">{computedTbaAddress}</dd>
          <dt className="opacity-70">Deployed on-chain?</dt>
          <dd>
            {discoveredOnChain.logQueryError
              ? `Could not determine (${discoveredOnChain.logQueryError})`
              : discoveredOnChain.matchingLogs.length > 0
                ? `Yes - ${discoveredOnChain.matchingLogs.length} matching AccountCreated event(s) found on-chain for this token.`
                : "No AccountCreated event found for this token yet (address above is counterfactual - not yet created)."}
          </dd>
        </dl>
        {claimedAddressComparison && (
          <p className="mt-2">
            Address the project told you is your TBA:{" "}
            <span className="font-mono">
              {claimedAddressComparison.claimedAddress}
            </span>{" "}
            -{" "}
            {claimedAddressComparison.matchesComputed
              ? "matches the computed address above."
              : "does not match the computed address above."}
          </p>
        )}
      </section>

      {/* 3. Implementation: canonical or custom, both addresses side by side */}
      <section>
        <h3 className="font-semibold text-base mb-1">
          Implementation contract
        </h3>
        <p className="mb-2">
          {implementation.isKnownCanonical
            ? `This implementation matches Tokenbound's canonical reference (${implementation.canonicalVersionLabel}).`
            : `This implementation does not match either of Tokenbound's known canonical addresses - it is a custom implementation.`}
          {implementation.source === "discovered-on-chain" &&
            " (Discovered from an on-chain AccountCreated event for this token - not user-supplied.)"}
          {implementation.source === "canonical-default" &&
            " (No on-chain deployment found yet, so this defaults to Tokenbound's canonical Account Proxy address for comparison purposes.)"}
        </p>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-1 pr-2 font-medium opacity-70">
                Address inspected
              </th>
              <th className="py-1 pr-2 font-medium opacity-70">
                Canonical Account Proxy
              </th>
              <th className="py-1 font-medium opacity-70">
                Canonical Account Implementation
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1 pr-2 font-mono break-all">
                {implementation.address}
              </td>
              <td className="py-1 pr-2 font-mono break-all">
                {implementation.canonicalAccountProxyAddress}
              </td>
              <td className="py-1 font-mono break-all">
                {implementation.canonicalAccountImplementationAddress}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 4. Bytecode match result */}
      <section>
        <h3 className="font-semibold text-base mb-1">Bytecode</h3>
        <p>
          {bytecode.matchResult === "no-code" &&
            "No bytecode found at this address on this chain (nothing deployed here yet)."}
          {bytecode.matchResult === "matches-known-reference" &&
            `Deployed bytecode (${bytecode.length} bytes) matches a known reference bytecode hash: ${bytecode.matchedReferenceLabel}.`}
          {bytecode.matchResult === "no-match" &&
            `Deployed bytecode (${bytecode.length} bytes) does not match any known reference bytecode hash on file.`}
        </p>
      </section>

      {/* 5. Verified source + extra functions */}
      <section>
        <h3 className="font-semibold text-base mb-1">
          Source verification &amp; functions
        </h3>
        {explorer.status === "unavailable" && (
          <p>
            Source not checked on {explorer.explorerLabel} -{" "}
            {explorer.unavailableReason}
          </p>
        )}
        {explorer.status === "not-verified" && (
          <p>
            Source not verified on {explorer.explorerLabel} - cannot confirm
            implementation logic.{" "}
            <a
              href={explorer.addressUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              View on {explorer.explorerLabel}
            </a>
          </p>
        )}
        {explorer.status === "verified" && (
          <>
            <p className="mb-1">
              Source verified on {explorer.explorerLabel}.{" "}
              <a
                href={explorer.addressUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                View on {explorer.explorerLabel}
              </a>
            </p>
            <p>
              Additional functions found beyond the standard ERC-6551 interface
              (execute, isValidSigner, token, state, supportsInterface):{" "}
              {explorer.extraFunctions && explorer.extraFunctions.length > 0
                ? explorer.extraFunctions.join(", ")
                : "none"}
            </p>
          </>
        )}
      </section>

      {/* 6. AI plain-English summary */}
      {(aiExplanation || aiError) && (
        <section>
          <h3 className="font-semibold text-base mb-1">
            AI-generated plain-English summary
          </h3>
          {aiExplanation && (
            <p className="whitespace-pre-wrap">{aiExplanation}</p>
          )}
          {aiError && (
            <p className="opacity-70">AI summary unavailable: {aiError}</p>
          )}
        </section>
      )}

      {/* 7. Footer disclaimer */}
      <footer className="pt-4 border-t text-xs opacity-70">
        This report is technical fact-gathering only (
        {short(input.tokenContract)}, token {input.tokenId}, {input.chainLabel})
        - not financial or legal advice. Always do your own research.
      </footer>
    </div>
  );
}
