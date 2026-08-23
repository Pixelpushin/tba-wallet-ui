// Thin adapter over @pixelpushin/tba-kit (github:Pixelpushin/tba-kit), the
// zero-dependency ERC-6551 primitives package (computeTbaAddress,
// isTbaActivated, buildCreateAccountTx, the registry/implementation
// constants). tba-kit deliberately does NOT include the "spend from an
// already-activated account" side of things - transferring ETH/ERC-20/NFTs
// back out of a Token Bound Account via execute() - so those builders live
// here instead, generalized to take a token contract as a parameter (rather
// than one project hardcoding its own collection into the package).
//
// Every export here returns a plain { to, data } transaction object; you
// send it with whatever wallet library you're using (this repo's own
// lib/wallet.ts uses Reown AppKit's ethers adapter, see that file).
import { getConfig } from "@/lib/config";
import * as tbaKit from "@pixelpushin/tba-kit";
import { Interface } from "ethers";

// Every Tokenbound V3 account exposes execute(address,uint256,bytes,uint8).
// operation 0 = plain CALL - the only operation type a regular EOA owner is
// allowed to use (1/2/3 are DELEGATECALL/CREATE/CREATE2, gated behind
// stricter permissions this UI has no need for).
const ACCOUNT_ABI = [
  "function execute(address to, uint256 value, bytes data, uint8 operation) payable returns (bytes)",
];
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
];
// safeTransferFrom, not transferFrom - the TBA is a contract calling this on
// its own behalf (from === the TBA itself), and safeTransferFrom's
// receiver-hook check protects against sending an NFT into a contract
// address that can't actually hold it. Explicit 3-arg signature only, since
// ERC-721 overloads safeTransferFrom and the exact selector needs to be
// disambiguated rather than left for ethers to guess.
const ERC721_ABI = [
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
];

const accountInterface = new Interface(ACCOUNT_ABI);
const erc20Interface = new Interface(ERC20_ABI);
const erc721Interface = new Interface(ERC721_ABI);

const OPERATION_CALL = 0;

export const REGISTRY_ADDRESS = tbaKit.REGISTRY_ADDRESS;
export const IMPLEMENTATION_ADDRESS = tbaKit.IMPLEMENTATION_ADDRESS;

/** Deterministic TBA address for a token of the configured collection. */
export async function computeTbaAddress(
  tokenId: number | string | bigint,
): Promise<string> {
  const config = getConfig();
  return tbaKit.computeTbaAddress({
    tokenContract: config.tokenContract,
    tokenId,
    chainIdHex: config.chainIdHex,
    rpcUrl: config.rpcUrl,
  });
}

/** True once createAccount() has actually been called for this token. */
export async function isTbaActivated(tbaAddress: string): Promise<boolean> {
  const config = getConfig();
  return tbaKit.isTbaActivated(tbaAddress, config.rpcUrl);
}

/**
 * {to, data} for the registry's createAccount(...) - the connected wallet
 * signs and sends this itself (one-time, per token, paid by whoever
 * activates it).
 */
export function buildCreateAccountTx(tokenId: number | string | bigint): {
  to: string;
  data: string;
} {
  const config = getConfig();
  return tbaKit.buildCreateAccountTx({
    tokenContract: config.tokenContract,
    tokenId,
    chainIdHex: config.chainIdHex,
  });
}

/**
 * {to, data} to send native ETH out of an activated TBA. The connected
 * wallet (which must be the account's authorized owner/signer) calls
 * execute() ON the TBA itself, which forwards `valueWei` of its own held
 * ETH to `to`. The outer transaction's own value stays 0 - nothing leaves
 * the caller's own wallet, only the TBA's.
 */
export function buildSendEthTx(
  tbaAddress: string,
  to: string,
  valueWei: bigint,
): { to: string; data: string } {
  return {
    to: tbaAddress,
    data: accountInterface.encodeFunctionData("execute", [
      to,
      valueWei,
      "0x",
      OPERATION_CALL,
    ]),
  };
}

/**
 * Same idea, for an ERC-20 balance the TBA holds: execute() tells the TBA
 * to call transfer() on the token contract itself, moving tokens out of the
 * TBA's own balance.
 */
export function buildSendTokenTx(
  tbaAddress: string,
  tokenContract: string,
  to: string,
  amountRaw: bigint,
): { to: string; data: string } {
  const transferData = erc20Interface.encodeFunctionData("transfer", [
    to,
    amountRaw,
  ]);
  return {
    to: tbaAddress,
    data: accountInterface.encodeFunctionData("execute", [
      tokenContract,
      BigInt(0),
      transferData,
      OPERATION_CALL,
    ]),
  };
}

/**
 * Same idea, for an NFT (ERC-721) the TBA holds. `from` is the TBA itself,
 * not the caller's own EOA - the TBA holds the NFT, the connected wallet is
 * just the one authorized to tell it to move.
 */
export function buildSendNftTx(
  tbaAddress: string,
  nftContractAddress: string,
  nftTokenId: string,
  to: string,
): { to: string; data: string } {
  const transferData = erc721Interface.encodeFunctionData("safeTransferFrom", [
    tbaAddress,
    to,
    nftTokenId,
  ]);
  return {
    to: tbaAddress,
    data: accountInterface.encodeFunctionData("execute", [
      nftContractAddress,
      BigInt(0),
      transferData,
      OPERATION_CALL,
    ]),
  };
}
