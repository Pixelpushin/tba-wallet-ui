"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ChainKey, ComplianceReport } from "@/lib/complianceCheck";
import {
  explainFindingsAnthropicDirect,
  type AiProviderKind,
} from "@/lib/aiProviders";
import { ComplianceReportView } from "./ComplianceReportView";

// Self-contained "TBA Compliance Checker" tool. Deliberately NOT wired into
// TbaWalletPanel/lib/config.ts's single-collection env config - this form
// takes chain/contract/token as direct user input so the whole module can
// later be lifted onto a different site/subdomain unmodified. See
// README.md for the full explanation.

const CHAIN_OPTIONS: { key: ChainKey; label: string }[] = [
  { key: "ethereum", label: "Ethereum mainnet" },
  { key: "base", label: "Base" },
  { key: "robinhood", label: "Robinhood Chain" },
];

const AI_PROVIDER_OPTIONS: { key: AiProviderKind; label: string }[] = [
  { key: "anthropic", label: "Anthropic" },
  { key: "openai", label: "OpenAI" },
  { key: "custom", label: "Custom (OpenAI-compatible)" },
];

type Status = "idle" | "checking" | "done" | "error";

export function ComplianceChecker() {
  // Homepage's "Check a contract" quick-launch field links here as
  // /checker?contract=0x... to prefill this same form field - no separate
  // input mechanism, just a shortcut into the one this page already has.
  const searchParams = useSearchParams();
  const [chainKey, setChainKey] = useState<ChainKey>("ethereum");
  const [tokenContract, setTokenContract] = useState(
    () => searchParams.get("contract") ?? "",
  );
  const [tokenId, setTokenId] = useState("");
  const [claimedTbaAddress, setClaimedTbaAddress] = useState("");
  const [implementationOverride, setImplementationOverride] = useState("");

  const [aiProvider, setAiProvider] = useState<AiProviderKind>("anthropic");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | undefined>();
  const [aiError, setAiError] = useState<string | undefined>();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("checking");
    setError(null);
    setReport(null);
    setAiExplanation(undefined);
    setAiError(undefined);

    try {
      const res = await fetch("/api/checker/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chainKey,
          tokenContract,
          tokenId,
          claimedTbaAddress: claimedTbaAddress || undefined,
          implementationOverride: implementationOverride || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Compliance check failed.");
      }
      const nextReport = body.report as ComplianceReport;
      setReport(nextReport);
      setStatus("done");

      if (aiApiKey.trim()) {
        try {
          if (aiProvider === "anthropic") {
            // Called directly from the browser - api.anthropic.com only,
            // this app's server is never involved for this provider. See
            // lib/aiProviders.ts for why Anthropic and OpenAI/custom take
            // different paths.
            const result = await explainFindingsAnthropicDirect(
              aiApiKey,
              nextReport,
            );
            setAiExplanation(result.explanation);
          } else {
            // OpenAI and custom endpoints don't support direct browser
            // requests, so this one request is relayed through this app's
            // server (never logged or stored - see the route handler).
            const aiRes = await fetch("/api/checker/ai-explain", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                provider: aiProvider,
                apiKey: aiApiKey,
                baseUrl: aiBaseUrl || undefined,
                findings: nextReport,
              }),
            });
            const aiBody = await aiRes.json();
            if (!aiRes.ok) {
              throw new Error(aiBody.error ?? "AI explanation failed.");
            }
            setAiExplanation(aiBody.explanation);
          }
        } catch (aiErr) {
          setAiError(
            aiErr instanceof Error ? aiErr.message : "AI explanation failed.",
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compliance check failed.");
      setStatus("error");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-1">TBA Compliance Checker</h1>
        <p className="text-sm opacity-80">
          Paste an NFT contract address, token ID, and chain to get a factual,
          mechanically-verified report on whether its ERC-6551 Token Bound
          Account setup uses Tokenbound&apos;s canonical reference
          implementation or a custom one. Deployment through the canonical
          registry is always free and permissionless - this tool checks and
          reports the facts so you can draw your own conclusions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="chain">
            Chain
          </label>
          <select
            id="chain"
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={chainKey}
            onChange={(e) => setChainKey(e.target.value as ChainKey)}
          >
            {CHAIN_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="tokenContract"
          >
            NFT contract address
          </label>
          <input
            id="tokenContract"
            className="w-full border rounded px-3 py-2 bg-transparent font-mono"
            placeholder="0x..."
            value={tokenContract}
            onChange={(e) => setTokenContract(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="tokenId">
            Token ID
          </label>
          <input
            id="tokenId"
            className="w-full border rounded px-3 py-2 bg-transparent"
            placeholder="1"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            required
          />
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer opacity-80">
            Optional: check a specific mismatch claim
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="claimedTba"
              >
                Address the project told you is your TBA
              </label>
              <input
                id="claimedTba"
                className="w-full border rounded px-3 py-2 bg-transparent font-mono"
                placeholder="0x... (optional)"
                value={claimedTbaAddress}
                onChange={(e) => setClaimedTbaAddress(e.target.value)}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="implementationOverride"
              >
                Implementation contract address to inspect
              </label>
              <input
                id="implementationOverride"
                className="w-full border rounded px-3 py-2 bg-transparent font-mono"
                placeholder="0x... (optional - defaults to what was actually deployed on-chain, or Tokenbound's canonical address)"
                value={implementationOverride}
                onChange={(e) => setImplementationOverride(e.target.value)}
              />
            </div>
          </div>
        </details>

        <details className="text-sm">
          <summary className="cursor-pointer opacity-80">
            Optional: AI plain-English summary (BYOK)
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs opacity-70">
              Leave this blank and the report still works fully - you just get
              the raw mechanical findings above without the plain-English
              paragraph.
            </p>
            <p className="text-xs opacity-70">
              We built the most private path each provider actually allows.
            </p>
            {aiProvider === "anthropic" ? (
              <p className="text-xs opacity-70">
                Your key and request go directly from your browser to Anthropic
                - this app&apos;s servers never see them.
              </p>
            ) : aiProvider === "openai" ? (
              <p className="text-xs opacity-70">
                OpenAI&apos;s API doesn&apos;t allow direct browser requests (a
                limitation on their end, not ours), so this one request passes
                through our server to relay it - it&apos;s never logged or
                stored, and discarded immediately after the response.
              </p>
            ) : (
              <p className="text-xs opacity-70">
                We don&apos;t know whether this endpoint supports direct browser
                requests, so this one request passes through our server to relay
                it - it&apos;s never logged or stored, and discarded immediately
                after the response.
              </p>
            )}
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="aiProvider"
              >
                Provider
              </label>
              <select
                id="aiProvider"
                className="w-full border rounded px-3 py-2 bg-transparent"
                value={aiProvider}
                onChange={(e) =>
                  setAiProvider(e.target.value as AiProviderKind)
                }
              >
                {AI_PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="aiApiKey"
              >
                API key
              </label>
              <input
                id="aiApiKey"
                type="password"
                className="w-full border rounded px-3 py-2 bg-transparent font-mono"
                placeholder="sk-..."
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                autoComplete="off"
              />
            </div>
            {aiProvider === "custom" && (
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  htmlFor="aiBaseUrl"
                >
                  Base URL (OpenAI-compatible)
                </label>
                <input
                  id="aiBaseUrl"
                  className="w-full border rounded px-3 py-2 bg-transparent font-mono"
                  placeholder="https://your-endpoint.example.com/v1"
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                />
              </div>
            )}
          </div>
        </details>

        <button
          type="submit"
          className="w-full border rounded px-4 py-2 font-medium disabled:opacity-50"
          disabled={status === "checking"}
        >
          {status === "checking" ? "Checking..." : "Run compliance check"}
        </button>
      </form>

      {error && (
        <p className="text-sm border rounded px-3 py-2">Error: {error}</p>
      )}

      {report && (
        <div className="border rounded px-4 py-4">
          <ComplianceReportView
            report={report}
            aiExplanation={aiExplanation}
            aiError={aiError}
          />
        </div>
      )}
    </div>
  );
}
