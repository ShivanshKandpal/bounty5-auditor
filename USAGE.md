# Approval Risk Auditor - Usage Guide

This agent audits Ethereum wallets for risky ERC-20 and NFT approvals across multiple chains.

## Starting the Server

```bash
node server.js
```

The server will start on `http://localhost:8080`

## Usage Methods

### 1. Using curl (Command Line)

```bash
curl -X POST http://localhost:8080/entrypoints/audit/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "wallet": "vitalik.eth",
      "chains": ["eth-mainnet", "polygon-mainnet"]
    }
  }'
```

### 2. Using Node.js Fetch

```javascript
const response = await fetch('http://localhost:8080/entrypoints/audit/invoke', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input: {
      wallet: "0xYourWalletAddress",
      chains: ["eth-mainnet", "arbitrum-mainnet"]
    }
  })
});

const result = await response.json();
console.log(result);
```

### 3. Using the Test Script

```bash
node test-agent.js
```

## Input Schema

```json
{
  "input": {
    "wallet": "string",    // Wallet address (0x...) or ENS name
    "chains": ["string"]   // Array of chain names
  }
}
```

## Supported Chains

- `eth-mainnet` - Ethereum Mainnet
- `polygon-mainnet` - Polygon
- `arbitrum-mainnet` - Arbitrum One
- `optimism-mainnet` - Optimism
- `base-mainnet` - Base
- `bsc-mainnet` - BNB Chain
- `avalanche-mainnet` - Avalanche C-Chain
- And many more supported by Covalent API

## Response Format

```json
{
  "run_id": "unique-execution-id",
  "status": "succeeded"
}
```

## What the Agent Does

1. **Fetches Approvals**: Retrieves all ERC-20 token approvals and NFT approvals for the wallet
2. **Identifies Risks**: Flags:
   - Unlimited approvals (allowance = max uint256)
   - Stale approvals (> 365 days old)
3. **Generates Revoke Transactions**: Creates transaction data to revoke risky approvals

## Example Use Cases

### Audit a specific wallet on Ethereum
```bash
curl -X POST http://localhost:8080/entrypoints/audit/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"wallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "chains": ["eth-mainnet"]}}'
```

### Audit across multiple chains
```bash
curl -X POST http://localhost:8080/entrypoints/audit/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"wallet": "vitalik.eth", "chains": ["eth-mainnet", "polygon-mainnet", "optimism-mainnet"]}}'
```

## Environment Variables

Make sure you have a `.env` file with:
```
COVALENT_API_KEY=your_api_key_here
```

## Endpoints

- **Root**: `http://localhost:8080/` - Landing page with agent info
- **Agent Card**: `http://localhost:8080/.well-known/agent-card.json` - Agent manifest
- **Audit Endpoint**: `http://localhost:8080/entrypoints/audit/invoke` - Main audit functionality

## Files

- `server.js` - HTTP server
- `agent.js` - Agent logic and entrypoint definition
- `index.js` - Standalone script to fetch approval data
- `test-agent.js` - Example test script
- `erc20Data.json` - Cached ERC-20 approval data
- `nftData.json` - Cached NFT approval data
