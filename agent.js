import 'dotenv/config';
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { ethers } from 'ethers';

const agentMeta = {
  name: "approval-risk-auditor",
  version: "0.1.0",
  description: "Flag unlimited or stale ERC-20 / NFT approvals",
};

const configOverrides = {
  payments: {
    facilitatorUrl: process.env.FACILITATOR_URL || "https://facilitator.daydreams.systems",
    payTo: process.env.PAY_TO || "0xb308ed39d67D0d4BAe5BC2FAEF60c66BBb6AE429",
    network: process.env.NETWORK || "base",
    defaultPrice: process.env.DEFAULT_PRICE || "0.01",
  },
};

const { app, addEntrypoint } = createAgentApp(agentMeta, {
  config: configOverrides,
  useConfigPayments: true,
});

const ERC20_ABI = ['function approve(address spender, uint256 amount)'];
const NFT_ABI = ['function setApprovalForAll(address operator, bool approved)'];
const BASE_URL = "https://api.covalenthq.com/v1";

function generateErc20RevokeData(tokenAddress, spenderAddress) {
  try {
    const iface = new ethers.Interface(ERC20_ABI);
    const data = iface.encodeFunctionData("approve", [spenderAddress, 0]);
    return { to: tokenAddress, data: data, value: "0" };
  } catch (e) {
    return null;
  }
}

function generateNftRevokeData(nftAddress, operatorAddress) {
  try {
    const iface = new ethers.Interface(NFT_ABI);
    const data = iface.encodeFunctionData("setApprovalForAll", [operatorAddress, false]);
    return { to: nftAddress, data: data, value: "0" };
  } catch (e) {
    return null; // Will be filtered out
  }
}

async function processChain(chainName, walletAddress, apiKey) {
  const authHeader = `Bearer ${apiKey}`;
  const fetchOptions = {
    method: 'GET',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
  };

  let chainApprovals = [];
  let chainRiskFlags = [];
  let chainRevokeTxData = [];

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

addEntrypoint({
  key: "audit",
  description: "Audit a wallet for risky ERC-20 and NFT approvals.",
  input: z.object({
    wallet: z.string().describe("Wallet address (e.g., 0x... or ENS name)"),
    chains: z.array(z.string()).describe("Array of chain names (e.g., ['eth-mainnet', 'polygon-mainnet'])"),
  }),
  price: "0.01",
  output: z.object({
    approvals: z.array(z.any()),
    risk_flags: z.array(z.any()),
    revoke_tx_data: z.array(z.any()),
  }),
  async handler(ctx) {
    const { input } = ctx;
    const { wallet, chains } = input;
    const apiKey = process.env.COVALENT_API_KEY;

    if (!apiKey) {
      throw new Error("COVALENT_API_KEY is not set on the server.");
    }

    let allApprovals = [];
    let allRiskFlags = [];
    let allRevokeTxData = [];

    const promises = chains.map(chainName => processChain(chainName, wallet, apiKey));
    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allApprovals.push(...result.value.chainApprovals);
        allRiskFlags.push(...result.value.chainRiskFlags);
        allRevokeTxData.push(...result.value.chainRevokeTxData);
      } else {
        console.error("Chain processing failed:", result.reason);
      }
    }

    const cleanRevokeTxData = allRevokeTxData.filter(tx => tx !== null);

    return {
      output: {
        approvals: allApprovals,
        risk_flags: allRiskFlags,
        revoke_tx_data: cleanRevokeTxData,
      }
    };
  },
});

export default app;