// TBA Compliance Checker - core mechanical (non-AI) checks.
//
// Self-contained on purpose: this file does not import anything from the
// rest of tba-wallet-ui (lib/config.ts, lib/chainReads.ts, etc.) so the
// whole ComplianceChecker module (this file + lib/aiProviders.ts +
// components/ComplianceChecker/* + app/checker + the two app/api/checker
// routes) can be copy-pasted onto a different site/subdomain wholesale,
// with no dependency on this repo's env-driven single-collection config.
//
// Everything in here answers one question at a time, mechanically, from
// on-chain data or a block explorer API - no guessing, no AI, no
// editorializing. See README.md "TBA Compliance Checker" section for the
// user-facing explanation of what each field means.

import { keccak256 as ethersKeccak256 } from "ethers";

const FETCH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Canonical addresses
// ---------------------------------------------------------------------------

// The ERC-6551 registry - permissionless, immutable, deployed at the exact
// same address on every EVM chain. Source: the ERC-6551 spec itself
// (https://eips.ethereum.org/EIPS/eip-6551) and
// https://docs.tokenbound.org/contracts/deployments (checked 2026-08-22).
export const REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";

// Tokenbound's official reference implementation, per
// https://docs.tokenbound.org/contracts/deployments (checked 2026-08-22):
//   - "Account Proxy" is the address you pass as the `implementation`
//     parameter to the registry's createAccount()/account() - it's a
//     minimal, constant proxy. This is what actually determines the
//     canonical computed TBA address for a given token.
//   - "Account Implementation" is the real logic contract (Tokenbound
//     AccountV3 / AccountV3Upgradable) the proxy delegates to via its own
//     initialize() call. This is what actually executes when you call
//     execute()/isValidSigner()/etc on a deployed TBA.
// Both are documented as deployed identically across all of Tokenbound's
// supported chains (Ethereum, Polygon, Optimism, Base, Linea, Klaytn, +
// testnets).
export const ACCOUNT_PROXY_ADDRESS =
  "0x55266d75D1a14E4572138116aF39863Ed6596E7F";
export const ACCOUNT_IMPLEMENTATION_ADDRESS =
  "0x41C8f39463A868d3A88af00cd0fe7102F30E44eC";
export const CANONICAL_VERSION_LABEL =
  "Tokenbound V3 (AccountV3 / AccountV3Upgradable)";

// Known-official reference bytecode hashes (keccak256 of the deployed
// runtime bytecode, i.e. what eth_getCode returns). Independently fetched
// via eth_getCode against both Ethereum mainnet (chainId 1) and Base
// (chainId 8453) public RPCs on 2026-08-22 - identical bytecode on both
// chains for all three addresses below, which is itself a data point (same
// code, same address, every chain, as ERC-6551/Tokenbound promise).
//
//   eth_getCode(1,    REGISTRY_ADDRESS)                 -> 571 bytes
//   eth_getCode(8453, REGISTRY_ADDRESS)                 -> 571 bytes (same hash)
//   eth_getCode(1,    ACCOUNT_PROXY_ADDRESS)             -> 902 bytes
//   eth_getCode(8453, ACCOUNT_PROXY_ADDRESS)             -> 902 bytes (same hash)
//   eth_getCode(1,    ACCOUNT_IMPLEMENTATION_ADDRESS)    -> 14,924 bytes
//   eth_getCode(8453, ACCOUNT_IMPLEMENTATION_ADDRESS)    -> 14,924 bytes (same hash)
export const KNOWN_REFERENCE_BYTECODE = [
  {
    label: "ERC-6551 Registry",
    address: REGISTRY_ADDRESS,
    bytecodeHash:
      "0xda1d5b06e579f9e42e59b00fbc22939896ecb38dc8830d40de0a2508fecd6735",
  },
  {
    label: "Tokenbound Account Proxy",
    address: ACCOUNT_PROXY_ADDRESS,
    bytecodeHash:
      "0x7f2b4bea519ba5fe0e8e3cf054654f18480c4416fc71370b31f37848688afdb0",
  },
  {
    label: "Tokenbound Account Implementation (V3 logic)",
    address: ACCOUNT_IMPLEMENTATION_ADDRESS,
    bytecodeHash:
      "0xdf5eeb80b53e48dfd667fff5264976de4004fdd27eef4f6b954d182109f0f85b",
  },
] as const;

// ---------------------------------------------------------------------------
// Chains
// ---------------------------------------------------------------------------

export type ChainKey = "ethereum" | "base" | "robinhood";

interface ExplorerConfigEtherscanV2 {
  kind: "etherscan-v2";
  label: string;
  apiBaseUrl: string; // https://api.etherscan.io/v2/api - needs ?chainid=
  siteBaseUrl: string;
  requiresServerApiKey: true;
}

interface ExplorerConfigBlockscout {
  kind: "blockscout";
  label: string;
  apiBaseUrl: string; // e.g. https://robinhoodchain.blockscout.com/api/v2
  siteBaseUrl: string;
  requiresServerApiKey: false;
}

type ExplorerConfig = ExplorerConfigEtherscanV2 | ExplorerConfigBlockscout;

export interface ChainConfig {
  key: ChainKey;
  label: string;
  chainId: number;
  rpcUrl: string;
  explorer: ExplorerConfig;
}

export const CHAINS: Record<ChainKey, ChainConfig> = {
  ethereum: {
    key: "ethereum",
    label: "Ethereum mainnet",
    chainId: 1,
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    explorer: {
      kind: "etherscan-v2",
      label: "Etherscan",
      apiBaseUrl: "https://api.etherscan.io/v2/api",
      siteBaseUrl: "https://etherscan.io",
      requiresServerApiKey: true,
    },
  },
  base: {
    key: "base",
    label: "Base",
    chainId: 8453,
    rpcUrl: "https://base-rpc.publicnode.com",
    explorer: {
      kind: "etherscan-v2",
      label: "Basescan (via Etherscan V2 API)",
      apiBaseUrl: "https://api.etherscan.io/v2/api",
      siteBaseUrl: "https://basescan.org",
      requiresServerApiKey: true,
    },
  },
  robinhood: {
    key: "robinhood",
    label: "Robinhood Chain",
    chainId: 4663,
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    explorer: {
      kind: "blockscout",
      label: "Blockscout",
      apiBaseUrl: "https://robinhoodchain.blockscout.com/api/v2",
      siteBaseUrl: "https://robinhoodchain.blockscout.com",
      requiresServerApiKey: false,
    },
  },
};

// ---------------------------------------------------------------------------
// Standard ERC-6551 interface (what does NOT count as "extra")
// ---------------------------------------------------------------------------

// Exactly the functions named in IERC6551Account / IERC6551Executable
// (https://eips.ethereum.org/EIPS/eip-6551), by name only (arity/selector
// not required to match - any function using one of these names is treated
// as "the standard one", everything else is reported as additional).
export const STANDARD_INTERFACE_FUNCTION_NAMES = new Set([
  "execute",
  "isValidSigner",
  "token",
  "state",
  "supportsInterface",
]);

// ---------------------------------------------------------------------------
// Low-level RPC helpers
// ---------------------------------------------------------------------------

async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = await res.json();
  if (body.error) {
    throw new Error(body.error.message ?? `${method} failed`);
  }
  return body.result as T;
}

function encodeUint256(value: number | string | bigint): string {
  return BigInt(value).toString(16).padStart(64, "0");
}

function encodeAddress(address: string): string {
  return address.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

function decodeAddress(hex: string): string {
  return `0x${hex.replace(/^0x/, "").slice(-40)}`;
}

const SELECTOR_ACCOUNT = "246a0021"; // account(address,bytes32,uint256,address,uint256)
const ZERO_SALT = "0".repeat(64);

// keccak256("ERC6551AccountCreated(address,address,bytes32,uint256,address,uint256)")
// per the ERC-6551 spec's IERC6551Registry interface. Independently computed
// with ethers' `id()` (not copy-pasted from a random source) - see git
// history/PR description for the exact command.
const EVENT_TOPIC_ACCOUNT_CREATED =
  "0x79f19b3655ee38b1ce526556b7731a20c8f218fbda4a3990b6cc4172fdf88722";

export async function computeCanonicalAddress(
  rpcUrl: string,
  implementation: string,
  chainId: number,
  tokenContract: string,
  tokenId: string | number | bigint,
): Promise<string> {
  const data =
    `0x${SELECTOR_ACCOUNT}` +
    encodeAddress(implementation) +
    ZERO_SALT +
    encodeUint256(chainId) +
    encodeAddress(tokenContract) +
    encodeUint256(tokenId);
  const result = await rpcCall<string>(rpcUrl, "eth_call", [
    { to: REGISTRY_ADDRESS, data },
    "latest",
  ]);
  return decodeAddress(result);
}

export interface AccountCreatedLog {
  account: string;
  implementation: string;
  blockNumber: number;
  transactionHash: string;
}

// Broad search: any AccountCreated event for this exact (tokenContract,
// tokenId) pair, regardless of which implementation address was used to
// create it. This is what lets the tool discover "what implementation did
// this project actually deploy with" without the user having to already
// know/paste it - topics[1] (implementation) is left as a wildcard while
// topics[2]/topics[3] (tokenContract/tokenId) are pinned.
export async function findAccountCreatedLogs(
  rpcUrl: string,
  tokenContract: string,
  tokenId: string | number | bigint,
): Promise<
  { ok: true; logs: AccountCreatedLog[] } | { ok: false; error: string }
> {
  try {
    const topics = [
      EVENT_TOPIC_ACCOUNT_CREATED,
      null,
      `0x${encodeAddress(tokenContract)}`,
      `0x${encodeUint256(tokenId)}`,
    ];
    const rawLogs = await rpcCall<
      Array<{
        data: string;
        topics: string[];
        blockNumber: string;
        transactionHash: string;
      }>
    >(rpcUrl, "eth_getLogs", [
      {
        address: REGISTRY_ADDRESS,
        // "earliest" is technically valid per the JSON-RPC spec, but at
        // least one RPC this tool talks to (Robinhood Chain's) rejects the
        // string tag and requires an explicit hex block number - "0x0"
        // works everywhere and means the same thing.
        fromBlock: "0x0",
        toBlock: "latest",
        topics,
      },
    ]);
    const logs: AccountCreatedLog[] = rawLogs.map((log) => ({
      implementation: decodeAddress(log.topics[1]),
      // `data` is the non-indexed ABI-encoded (account, salt, chainId) -
      // account is the first 32-byte word.
      account: decodeAddress(log.data.slice(2, 66)),
      blockNumber: parseInt(log.blockNumber, 16),
      transactionHash: log.transactionHash,
    }));
    return { ok: true, logs };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "eth_getLogs failed",
    };
  }
}

export async function getBytecode(
  rpcUrl: string,
  address: string,
): Promise<string> {
  return rpcCall<string>(rpcUrl, "eth_getCode", [address, "latest"]);
}

// ---------------------------------------------------------------------------
// keccak256 (used to hash fetched bytecode for the reference-bytecode diff).
// Delegates to ethers' `keccak256` (already a dependency of this repo, see
// package.json) rather than a hand-rolled implementation. Only ever called
// on public, already-on-chain bytecode - never on secrets.
// ---------------------------------------------------------------------------

/** keccak256 of a `0x`-prefixed hex string, returned as a `0x`-prefixed hex string. */
export function keccak256Hex(hex: string): string {
  return ethersKeccak256(hex);
}

// ---------------------------------------------------------------------------
// Explorer checks (verified source, ABI, extra functions)
// ---------------------------------------------------------------------------

export interface ExplorerResult {
  explorerLabel: string;
  addressUrl: string;
  status: "verified" | "not-verified" | "unavailable";
  unavailableReason?: string;
  extraFunctions?: string[];
}

interface ExplorerCheckOptions {
  etherscanApiKey?: string;
}

export async function checkExplorer(
  chain: ChainConfig,
  address: string,
  options: ExplorerCheckOptions,
): Promise<ExplorerResult> {
  const addressUrl = `${chain.explorer.siteBaseUrl}/address/${address}`;

  if (chain.explorer.kind === "blockscout") {
    try {
      const res = await fetch(
        `${chain.explorer.apiBaseUrl}/smart-contracts/${address}`,
        { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      );
      if (res.status === 404) {
        return {
          explorerLabel: chain.explorer.label,
          addressUrl,
          status: "not-verified",
        };
      }
      if (!res.ok) {
        return {
          explorerLabel: chain.explorer.label,
          addressUrl,
          status: "unavailable",
          unavailableReason: `${chain.explorer.label} returned HTTP ${res.status}.`,
        };
      }
      const body = await res.json();
      if (!body.is_verified) {
        return {
          explorerLabel: chain.explorer.label,
          addressUrl,
          status: "not-verified",
        };
      }
      const abi = Array.isArray(body.abi) ? body.abi : [];
      return {
        explorerLabel: chain.explorer.label,
        addressUrl,
        status: "verified",
        extraFunctions: extractExtraFunctions(abi),
      };
    } catch (error) {
      return {
        explorerLabel: chain.explorer.label,
        addressUrl,
        status: "unavailable",
        unavailableReason:
          error instanceof Error
            ? error.message
            : `Could not reach ${chain.explorer.label}.`,
      };
    }
  }

  // etherscan-v2
  if (!options.etherscanApiKey) {
    return {
      explorerLabel: chain.explorer.label,
      addressUrl,
      status: "unavailable",
      unavailableReason:
        "No ETHERSCAN_API_KEY configured on this server - Etherscan's V2 API requires a key even at the free tier, so verified-source status could not be checked for this chain.",
    };
  }
  try {
    const url = `${chain.explorer.apiBaseUrl}?chainid=${chain.chainId}&module=contract&action=getsourcecode&address=${address}&apikey=${options.etherscanApiKey}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = await res.json();
    const entry = body?.result?.[0];
    if (!entry || entry.SourceCode === "" || body.status === "0") {
      return {
        explorerLabel: chain.explorer.label,
        addressUrl,
        status: "not-verified",
      };
    }
    let abi: unknown[] = [];
    try {
      abi = JSON.parse(entry.ABI);
    } catch {
      abi = [];
    }
    return {
      explorerLabel: chain.explorer.label,
      addressUrl,
      status: "verified",
      extraFunctions: extractExtraFunctions(abi),
    };
  } catch (error) {
    return {
      explorerLabel: chain.explorer.label,
      addressUrl,
      status: "unavailable",
      unavailableReason:
        error instanceof Error
          ? error.message
          : `Could not reach ${chain.explorer.label}.`,
    };
  }
}

interface AbiFunctionEntry {
  type?: string;
  name?: string;
  stateMutability?: string;
}

function extractExtraFunctions(abi: unknown[]): string[] {
  const names = new Set<string>();
  for (const raw of abi) {
    const entry = raw as AbiFunctionEntry;
    if (entry?.type !== "function" || !entry.name) continue;
    if (STANDARD_INTERFACE_FUNCTION_NAMES.has(entry.name)) continue;
    names.add(entry.name);
  }
  return Array.from(names).sort();
}

// ---------------------------------------------------------------------------
// Full report
// ---------------------------------------------------------------------------

export interface ComplianceCheckInput {
  chainKey: ChainKey;
  tokenContract: string;
  tokenId: string;
  claimedTbaAddress?: string;
  implementationOverride?: string;
}

export interface ComplianceReport {
  input: {
    chainKey: ChainKey;
    chainLabel: string;
    chainId: number;
    tokenContract: string;
    tokenId: string;
  };
  registry: {
    address: string;
    note: string;
  };
  discoveredOnChain: {
    matchingLogs: AccountCreatedLog[];
    logQueryError?: string;
  };
  implementation: {
    address: string;
    source: "discovered-on-chain" | "user-override" | "canonical-default";
    isKnownCanonical: boolean;
    canonicalAccountProxyAddress: string;
    canonicalAccountImplementationAddress: string;
    canonicalVersionLabel: string;
  };
  computedTbaAddress: string;
  claimedAddressComparison?: {
    claimedAddress: string;
    matchesComputed: boolean;
  };
  bytecode: {
    length: number;
    hasCode: boolean;
    matchResult: "matches-known-reference" | "no-match" | "no-code";
    matchedReferenceLabel?: string;
  };
  explorer: ExplorerResult;
  generatedAt: string;
}

export async function runComplianceCheck(
  input: ComplianceCheckInput,
  options: ExplorerCheckOptions,
): Promise<ComplianceReport> {
  const chain = CHAINS[input.chainKey];
  if (!chain) throw new Error(`Unsupported chain: ${input.chainKey}`);

  const tokenContract = input.tokenContract.trim();
  const tokenId = input.tokenId.trim();

  const logResult = await findAccountCreatedLogs(
    chain.rpcUrl,
    tokenContract,
    tokenId,
  );
  const matchingLogs = logResult.ok ? logResult.logs : [];

  let implementationAddress: string;
  let implementationSource: ComplianceReport["implementation"]["source"];
  if (input.implementationOverride?.trim()) {
    implementationAddress = input.implementationOverride.trim();
    implementationSource = "user-override";
  } else if (matchingLogs.length > 0) {
    implementationAddress = matchingLogs[0].implementation;
    implementationSource = "discovered-on-chain";
  } else {
    implementationAddress = ACCOUNT_PROXY_ADDRESS;
    implementationSource = "canonical-default";
  }

  const isKnownCanonical =
    implementationAddress.toLowerCase() ===
      ACCOUNT_PROXY_ADDRESS.toLowerCase() ||
    implementationAddress.toLowerCase() ===
      ACCOUNT_IMPLEMENTATION_ADDRESS.toLowerCase();

  const computedTbaAddress = await computeCanonicalAddress(
    chain.rpcUrl,
    implementationAddress,
    chain.chainId,
    tokenContract,
    tokenId,
  );

  const claimedAddressComparison = input.claimedTbaAddress?.trim()
    ? {
        claimedAddress: input.claimedTbaAddress.trim(),
        matchesComputed:
          input.claimedTbaAddress.trim().toLowerCase() ===
          computedTbaAddress.toLowerCase(),
      }
    : undefined;

  const code = await getBytecode(chain.rpcUrl, implementationAddress);
  const hasCode = typeof code === "string" && code.length > 2;
  const length = hasCode ? (code.length - 2) / 2 : 0;
  let matchResult: ComplianceReport["bytecode"]["matchResult"] = "no-code";
  let matchedReferenceLabel: string | undefined;
  if (hasCode) {
    const hash = keccak256Hex(code);
    const match = KNOWN_REFERENCE_BYTECODE.find(
      (ref) => ref.bytecodeHash.toLowerCase() === hash.toLowerCase(),
    );
    matchResult = match ? "matches-known-reference" : "no-match";
    matchedReferenceLabel = match?.label;
  }

  const explorer = await checkExplorer(chain, implementationAddress, options);

  return {
    input: {
      chainKey: chain.key,
      chainLabel: chain.label,
      chainId: chain.chainId,
      tokenContract,
      tokenId,
    },
    registry: {
      address: REGISTRY_ADDRESS,
      note: "TBA deployment is always permissionless and free (gas-only) through this single canonical registry, on every EVM chain. There is no separate 'project registry' - anyone can call createAccount() for any token at any time.",
    },
    discoveredOnChain: {
      matchingLogs,
      logQueryError: logResult.ok ? undefined : logResult.error,
    },
    implementation: {
      address: implementationAddress,
      source: implementationSource,
      isKnownCanonical,
      canonicalAccountProxyAddress: ACCOUNT_PROXY_ADDRESS,
      canonicalAccountImplementationAddress: ACCOUNT_IMPLEMENTATION_ADDRESS,
      canonicalVersionLabel: CANONICAL_VERSION_LABEL,
    },
    computedTbaAddress,
    claimedAddressComparison,
    bytecode: { length, hasCode, matchResult, matchedReferenceLabel },
    explorer,
    generatedAt: new Date().toISOString(),
  };
}
