// view-results.js - View the actual agent results
import 'dotenv/config';
import { ethers } from 'ethers';

const BASE_URL = "https://api.covalenthq.com/v1";
const TEST_WALLET = "0xfC43f5f9dd45258b3AFf31bdbe6561D97e8B71dE";
const TEST_CHAIN = "eth-mainnet";
const API_KEY = process.env.COVALENT_API_KEY;

const ERC20_ABI = ['function approve(address spender, uint256 amount)'];
const NFT_ABI = ['function setApprovalForAll(address operator, bool approved)'];

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
    return null;
  }
}

async function viewAgentResults() {
  console.log(`\nFetching approvals for ${TEST_WALLET} on ${TEST_CHAIN}...\n`);

  const authHeader = `Bearer ${API_KEY}`;
  const fetchOptions = {
    method: 'GET',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
  };

  let allApprovals = [];
  let allRiskFlags = [];
  let allRevokeTxData = [];

  // Fetch ERC-20 Approvals
  const erc20Url = `${BASE_URL}/${TEST_CHAIN}/approvals/${TEST_WALLET}/`;
  const erc20Response = await fetch(erc20Url, fetchOptions);
  const erc20Data = await erc20Response.json();

  if (erc20Data.data && erc20Data.data.items) {
    for (const token of erc20Data.data.items) {
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

        allApprovals.push({ 
          type: "ERC20",
          chain: TEST_CHAIN,
          token_address: token.token_address,
          token_name: token.ticker_symbol || "Unknown",
          spender: spender.spender_address,
          allowance: spender.allowance,
          last_updated: spender.block_signed_at
        });
        
        allRiskFlags.push(risks);
        allRevokeTxData.push(generateErc20RevokeData(token.token_address, spender.spender_address));
      }
    }
  }

  // Fetch NFT Approvals
  const nftUrl = `${BASE_URL}/${TEST_CHAIN}/nft/approvals/${TEST_WALLET}/`;
  const nftResponse = await fetch(nftUrl, fetchOptions);
  const nftData = await nftResponse.json();

  if (nftData.data && nftData.data.items) {
    for (const nft of nftData.data.items) {
      for (const spender of nft.spenders) {
        if (!spender.spender_address) continue;
        if (spender.token_ids_approved === "ALL") {
          allApprovals.push({
            type: "NFT",
            chain: TEST_CHAIN,
            token_address: nft.contract_address,
            token_name: nft.contract_ticker_symbol || "Unknown",
            spender: spender.spender_address,
            approved_all: true
          });
          allRiskFlags.push(["unlimited_nft"]);
          allRevokeTxData.push(generateNftRevokeData(nft.contract_address, spender.spender_address));
        }
      }
    }
  }

  const cleanRevokeTxData = allRevokeTxData.filter(tx => tx !== null);

  // Display results
  console.log("=".repeat(80));
  console.log("AGENT RETURN VALUE");
  console.log("=".repeat(80));
  
  const result = {
    approvals: allApprovals,
    risk_flags: allRiskFlags,
    revoke_tx_data: cleanRevokeTxData,
  };

  console.log(JSON.stringify(result, null, 2));
  
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total Approvals: ${allApprovals.length}`);
  console.log(`Total Risk Flags: ${allRiskFlags.length}`);
  console.log(`Total Revoke Transactions: ${cleanRevokeTxData.length}`);
  
  console.log("\n" + "=".repeat(80));
  console.log("FIRST 3 APPROVALS (Sample)");
  console.log("=".repeat(80));
  allApprovals.slice(0, 3).forEach((approval, idx) => {
    console.log(`\n[${idx + 1}] ${approval.type} - ${approval.token_name}`);
    console.log(`    Token: ${approval.token_address}`);
    console.log(`    Spender: ${approval.spender}`);
    if (approval.allowance) console.log(`    Allowance: ${approval.allowance}`);
    if (approval.last_updated) console.log(`    Last Updated: ${approval.last_updated}`);
    console.log(`    Risks: ${allRiskFlags[idx].join(", ") || "none"}`);
    console.log(`    Revoke TX:`);
    console.log(`      to: ${cleanRevokeTxData[idx].to}`);
    console.log(`      data: ${cleanRevokeTxData[idx].data}`);
    console.log(`      value: ${cleanRevokeTxData[idx].value}`);
  });
  
  console.log("\n");
}

viewAgentResults().catch(console.error);
