// Minimal, zero-dependency on-chain reads (raw JSON-RPC eth_call) for the
// configured NFT collection - just enough for the ownership gate the panel
// needs (readOwnerOf) plus a generic ERC-20/ERC-721 balanceOf used by the
// holdings fetch fallback.
import { getConfig } from "@/lib/config";

const FETCH_TIMEOUT_MS = 8_000;

const SELECTOR_OWNER_OF = "6352211e"; // ownerOf(uint256)
const SELECTOR_BALANCE_OF = "70a08231"; // balanceOf(address)

function encodeUint256(value: number | string | bigint): string {
  return BigInt(value).toString(16).padStart(64, "0");
}

function decodeAddress(hex: string): string {
  return `0x${hex.replace(/^0x/, "").slice(-40)}`;
}

async function ethCall(
  to: string,
  data: string,
  rpcUrl: string,
): Promise<string> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message ?? "eth_call failed");
  return body.result as string;
}

/** Current on-chain owner of `tokenId` in the configured collection. */
export async function readOwnerOf(
  tokenId: number | string | bigint,
): Promise<string> {
  const config = getConfig();
  const data = `0x${SELECTOR_OWNER_OF}${encodeUint256(tokenId)}`;
  const result = await ethCall(config.tokenContract, data, config.rpcUrl);
  return decodeAddress(result);
}

/** Raw balanceOf - same ABI shape on ERC-20 and ERC-721. */
export async function readBalanceOf(
  contractAddress: string,
  ownerAddress: string,
): Promise<bigint> {
  const config = getConfig();
  const data = `0x${SELECTOR_BALANCE_OF}${"0".repeat(24)}${ownerAddress
    .replace(/^0x/, "")
    .toLowerCase()}`;
  const result = await ethCall(contractAddress, data, config.rpcUrl);
  return BigInt(result);
}

/** Native ETH (or the chain's native currency) balance, in wei. */
export async function readEthBalance(address: string): Promise<string> {
  const config = getConfig();
  const res = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = await res.json();
  if (body.error)
    throw new Error(body.error.message ?? "eth_getBalance failed");
  return BigInt(body.result as string).toString();
}
