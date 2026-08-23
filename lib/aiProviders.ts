// TBA Compliance Checker - optional AI explanation layer.
//
// Multi-provider, BYOK (bring your own key). Fully optional - every mechanical
// finding in lib/complianceCheck.ts is already useful on its own; this file
// only turns those findings into a plain-English paragraph if the user
// supplies a key. Self-contained (no imports from the rest of this repo) so
// this module lifts out cleanly with the rest of ComplianceChecker.
//
// Key handling: the key is read from the request body of a single POST to
// app/api/checker/ai-explain/route.ts, used exactly once to call the chosen
// provider, and then discarded when that request's handler returns. It is
// never logged (see the route handler - no console.log of the request body
// or the key), never written to a database, and never included in the
// response payload sent back to the browser.

export type AiProviderKind = "anthropic" | "openai" | "custom";

export interface AiProviderConfig {
  kind: AiProviderKind;
  apiKey: string;
  /** Only used for kind "custom" - base URL of an OpenAI-compatible endpoint. */
  baseUrl?: string;
  /** Optional model override; each provider has a sane default. */
  model?: string;
}

const DEFAULT_MODELS: Record<AiProviderKind, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
  // Sensible default for a generic OpenAI-compatible endpoint; most
  // providers accept an arbitrary model string here and ignore/validate it
  // server-side, so this is just a starting point users can override.
  custom: "gpt-4o-mini",
};

/**
 * Best-effort guess at provider from key shape. Returns null when the key
 * doesn't match a known pattern - callers should fall back to an explicit
 * provider selector (dropdown) in that case rather than guessing wrong.
 */
export function detectProviderKind(apiKey: string): AiProviderKind | null {
  const trimmed = apiKey.trim();
  if (trimmed.startsWith("sk-ant-")) return "anthropic";
  if (trimmed.startsWith("sk-proj-") || /^sk-[A-Za-z0-9]/.test(trimmed)) {
    return "openai";
  }
  return null;
}

// Strict, neutral system prompt: translate mechanical findings into plain
// English, forbid speculation about intent or value judgments. This is a
// deliberate tone/legal decision (see README) - do not soften this by
// adding "red flag"/"warning"/"scam"-style language, and do not let the
// model add it either.
export const SYSTEM_PROMPT = `You are explaining the results of a mechanical, on-chain compliance check for an ERC-6551 Token Bound Account (TBA) setup. You will be given a JSON object of factual findings (registry address, computed vs. claimed TBA address, which implementation contract was used, whether it matches Tokenbound's canonical reference implementation, bytecode match result, verified-source status, and a list of additional function names found in the contract's ABI beyond the standard ERC-6551 interface).

Your only job: translate these facts into a short, plain-English paragraph explaining what the code mechanically does, in neutral technical language.

Strict rules:
- State only what is directly supported by the given findings. Do not speculate about the deploying project's intent, motives, or future behavior.
- Never use the words "scam", "red flag", "warning", "suspicious", "predatory", "dangerous", or similar loaded/alarmist language, even if some additional functions have names that suggest gating (e.g. "activate", "requiresPayment"). Describe what such a function's name suggests it does, factually, without editorializing about whether that's good or bad.
- Do not give financial, legal, or investment advice, and do not tell the reader what to do.
- Do not add caveats like "be careful" or "you should verify" - the report itself already has a disclaimer; you only explain the facts.
- Keep it to one short paragraph (roughly 80-150 words).`;

export interface ExplainFindingsResult {
  explanation: string;
  providerUsed: AiProviderKind;
  modelUsed: string;
}

export async function explainFindings(
  config: AiProviderConfig,
  findingsJson: unknown,
): Promise<ExplainFindingsResult> {
  const model = config.model?.trim() || DEFAULT_MODELS[config.kind];
  const userPrompt = `Mechanical findings (JSON):\n${JSON.stringify(findingsJson, null, 2)}\n\nExplain what this code mechanically does, following the rules above.`;

  switch (config.kind) {
    case "anthropic": {
      const text = await callAnthropic(config.apiKey, model, userPrompt);
      return { explanation: text, providerUsed: "anthropic", modelUsed: model };
    }
    case "openai": {
      const text = await callOpenAiCompatible(
        "https://api.openai.com/v1",
        config.apiKey,
        model,
        userPrompt,
      );
      return { explanation: text, providerUsed: "openai", modelUsed: model };
    }
    case "custom": {
      const baseUrl = config.baseUrl?.trim().replace(/\/+$/, "");
      if (!baseUrl) {
        throw new Error("Custom provider requires a base URL.");
      }
      const text = await callOpenAiCompatible(
        baseUrl,
        config.apiKey,
        model,
        userPrompt,
      );
      return { explanation: text, providerUsed: "custom", modelUsed: model };
    }
    default:
      throw new Error(`Unknown provider: ${config.kind}`);
  }
}

const FETCH_TIMEOUT_MS = 30_000;

async function callAnthropic(
  apiKey: string,
  model: string,
  userPrompt: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await safeErrorText(res);
    throw new Error(`Anthropic API error (${res.status}): ${detail}`);
  }
  const body = await res.json();
  const text = body?.content
    ?.filter((block: { type: string }) => block.type === "text")
    ?.map((block: { text: string }) => block.text)
    ?.join("\n");
  if (!text) throw new Error("Anthropic response had no text content.");
  return text;
}

async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  userPrompt: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 400,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await safeErrorText(res);
    throw new Error(`Provider API error (${res.status}): ${detail}`);
  }
  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Provider response had no message content.");
  return text;
}

async function safeErrorText(res: Response): Promise<string> {
  try {
    const body = await res.text();
    return body.slice(0, 500);
  } catch {
    return res.statusText;
  }
}
