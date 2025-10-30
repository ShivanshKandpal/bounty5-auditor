import 'dotenv/config';
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { ethers } from 'ethers';

// --- Agent Server Setup ---
const { app, addEntrypoint } = createAgentApp({
  name: "approval-risk-auditor",
  version: "0.1.0",
  description: "Flag unlimited or stale ERC-20 / NFT approvals",
});

// --- ABIs, Constants, and API Logic ---
const ERC20_ABI = ['function approve(address spender, uint256 amount)'];
const NFT_ABI = ['function setApprovalForAll(address operator, bool approved)'];
const BASE_URL = "https://api.covalenthq.com/v1";

/**
 * Generates the `data` payload for an ERC-20 `approve(spender, 0)` transaction.
 */
function generateErc20RevokeData(tokenAddress, spenderAddress) {
  try {
    const iface = new ethers.Interface(ERC20_ABI);
    const data = iface.encodeFunctionData("approve", [spenderAddress, 0]);
    return { to: tokenAddress, data: data, value: "0" };
  } catch (e) {
    return null; // Will be filtered out
  }
}

/**
 * Generates the `data` payload for an NFT `setApprovalForAll(operator, false)` transaction.
 */
function generateNftRevokeData(nftAddress, operatorAddress) {
  try {
    const iface = new ethers.Interface(NFT_ABI);
    const data = iface.encodeFunctionData("setApprovalForAll", [operatorAddress, false]);
    return { to: nftAddress, data: data, value: "0" };
  } catch (e) {
    return null; // Will be filtered out
  }
}

/**
 * Fetches and processes approvals for a *single* chain.
 */
async function processChain(chainName, walletAddress, apiKey) {
  const authHeader = `Bearer ${apiKey}`;
  const fetchOptions = {
    method: 'GET',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
  };

  let chainApprovals = [];
  let chainRiskFlags = [];
  let chainRevokeTxData = [];

  // 1. Fetch ERC-20 Approvals
  const erc20Url = `${BASE_URL}/${chainName}/approvals/${walletAddress}/`;
  const erc20Response = await (await fetch(erc20Url, fetchOptions)).json();

  if (erc20Response.data && erc20Response.data.items) {
    for (const token of erc20Response.data.items) {
      for (const spender of token.spenders) {
        if (!spender.spender_address) continue;

        let risks = [];
        if (spender.allowance === "UNLIMITED") {
          risks.push("unlimited");
        }
        if (spender.block_signed_at) {
           const oneYearAgo = new Date();
           oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
           if (new Date(spender.block_signed_at) < oneYearAgo) {
              risks.push("stale");
           }
        }

        chainApprovals.push({ 
          type: "ERC20",
          chain: chainName,
          token_address: token.token_address,
          token_name: token.ticker_symbol || "Unknown",
          spender: spender.spender_address,
          allowance: spender.allowance,
          last_updated: spender.block_signed_at
        });
        
        chainRiskFlags.push(risks);
        chainRevokeTxData.push(generateErc20RevokeData(token.token_address, spender.spender_address));
      }
    }
  }

  // 2. Fetch NFT Approvals
  const nftUrl = `${BASE_URL}/${chainName}/nft/approvals/${walletAddress}/`;
  const nftResponse = await (await fetch(nftUrl, fetchOptions)).json();

  if (nftResponse.data && nftResponse.data.items) {
    for (const nft of nftResponse.data.items) {
      for (const spender of nft.spenders) {
        if (!spender.spender_address) continue;
        if (spender.token_ids_approved === "ALL") {
          chainApprovals.push({
            type: "NFT",
            chain: chainName,
            token_address: nft.contract_address,
            token_name: nft.contract_ticker_symbol || "Unknown",
            spender: spender.spender_address,
            approved_all: true
          });
          chainRiskFlags.push(["unlimited_nft"]);
          chainRevokeTxData.push(generateNftRevokeData(nft.contract_address, spender.spender_address));
        }
      }
    }
  }
  
  return { chainApprovals, chainRiskFlags, chainRevokeTxData };
}

// --- Agent Entrypoint Definition ---
addEntrypoint({
  key: "audit", // This is the function name the user will call
  description: "Audit a wallet for risky ERC-20 and NFT approvals.",
  input: z.object({
    wallet: z.string().describe("Wallet address (e.g., 0x... or ENS name)"),
    chains: z.array(z.string()).describe("Array of chain names (e.g., ['eth-mainnet', 'polygon-mainnet'])"),
  }),
  async handler({ input }) {
    const { wallet, chains } = input;
    const apiKey = process.env.COVALENT_API_KEY;

    if (!apiKey) {
      throw new Error("COVALENT_API_KEY is not set on the server.");
    }

    // Final arrays to aggregate all results
    let allApprovals = [];
    let allRiskFlags = [];
    let allRevokeTxData = [];

    // Run the audit for each chain in parallel
    const promises = chains.map(chainName => processChain(chainName, wallet, apiKey));
    const results = await Promise.allSettled(promises);

    // Collect results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allApprovals.push(...result.value.chainApprovals);
        allRiskFlags.push(...result.value.chainRiskFlags);
        allRevokeTxData.push(...result.value.chainRevokeTxData);
      } else {
        // In a real app, you'd log which chain failed
        console.error("Chain processing failed:", result.reason);
      }
    }

    // Filter out any nulls from failed revoke generations
    const cleanRevokeTxData = allRevokeTxData.filter(tx => tx !== null);

    // Return the final object in the format the bounty requires
    return {
      approvals: allApprovals,
      risk_flags: allRiskFlags,
      revoke_tx_data: cleanRevokeTxData,
    };
  },
});

export default app;