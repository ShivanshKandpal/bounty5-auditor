# Approval Risk Auditor Agent

> **Live Deployment:** https://bounty5-auditor-production.up.railway.app

An AI agent that audits Ethereum wallets for risky ERC-20 and NFT approvals across multiple blockchains. Built with [@lucid-dreams/agent-kit](https://github.com/daydreamsai/lucid-fullstack) and deployed with x402 payment protocol.

**Bounty Submission:** This agent was built for the [Daydreams AI Agent Bounties](https://github.com/daydreamsai/agent-bounties/issues/5) program.

## Features

- **Multi-chain Support** - Audit wallets across Ethereum, Polygon, Arbitrum, Optimism, Base, and more
- **Risk Detection** - Automatically flags unlimited and stale (>365 days) approvals
- **Revoke Transactions** - Generates ready-to-sign transaction data to revoke risky approvals
- **HTTP API** - RESTful endpoint for easy integration
- **x402 Payments** - Built-in payment support via x402 protocol

## Quick Start

### Prerequisites

- Node.js v18+
- Covalent API key ([Get one free](https://www.covalenthq.com/platform/))

### Installation

```bash
# Install dependencies
npm install

# Create .env file with your API key
echo "COVALENT_API_KEY=your_api_key_here" > .env
```

### Running Locally

```bash
# Start the server
npm start
```

Server runs on `http://localhost:8080`

### Testing Payment Flow

To test the complete x402 payment flow:

```bash
# Add to .env:
PRIVATE_KEY=your_test_wallet_private_key
NETWORK=base
AGENT_URL=http://localhost:8080

# Run payment test
node pay-and-test.js
```

This demonstrates:
1. Request without payment returns 402 Payment Required
2. Payment is created and sent (0.01 USDC on Base)
3. Request with payment returns 200 OK with audit results

## API Documentation

### Endpoint: `/entrypoints/audit/invoke`

**Method:** `POST`

**Request Body:**
```json
{
  "input": {
    "wallet": "string",    // Wallet address (0x...) or ENS name
    "chains": ["string"]   // Array of chain names
  }
}
```

**Response:**
```json
{
  "run_id": "uuid",
  "status": "succeeded"
}
```

**Supported Chains:**
- `eth-mainnet` - Ethereum
- `polygon-mainnet` - Polygon
- `arbitrum-mainnet` - Arbitrum One
- `optimism-mainnet` - Optimism
- `base-mainnet` - Base
- `bsc-mainnet` - BNB Chain
- `avalanche-mainnet` - Avalanche C-Chain

## Project Structure

```
bounty5-auditor/
├── agent.js       # Main agent logic and entrypoint definition
├── server.js      # HTTP server wrapper
├── package.json   # Dependencies and metadata
└── .env          # Environment variables (not committed)
```

## How It Works

1. **Fetches Approvals** - Queries Covalent API for ERC-20 token approvals and NFT approvals
2. **Analyzes Risks** - Checks each approval for:
   - Unlimited allowances (max uint256)
   - Stale approvals (>365 days old)
3. **Generates Revoke Data** - Creates transaction payloads:
   - ERC-20: `approve(spender, 0)`
   - NFT: `setApprovalForAll(operator, false)`

## x402 Payments

This agent supports the x402 payment protocol on Base mainnet.

**Payment Configuration:**
- Network: Base (mainnet)
- Price: 0.01 USDC per audit request
- Token: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- Facilitator: https://facilitator.daydreams.systems

**Environment Variables:**
```env
PAY_TO=0xYourPaymentWallet
NETWORK=base
DEFAULT_PRICE=0.01
FACILITATOR_URL=https://facilitator.daydreams.systems
```

**Testing Payments Locally:**

```bash
# Add your test wallet private key to .env
PRIVATE_KEY=your_private_key_here
NETWORK=base

# Run the payment test script
node pay-and-test.js
```

This script:
1. Makes a request without payment (gets 402)
2. Creates payment authorization
3. Makes request with payment header (gets 200)
4. Shows the exact responses received

Check your balance after to verify payment was deducted:
```bash
node check-balance.js
```

## Response Format

The agent returns three parallel arrays:

**Approvals:**
```json
{
  "type": "ERC20",
  "chain": "eth-mainnet",
  "token_address": "0x...",
  "token_name": "USDT",
  "spender": "0x...",
  "allowance": "UNLIMITED",
  "last_updated": "2022-06-20T01:58:52Z"
}
```

**Risk Flags:**
```json
["unlimited", "stale"]
```

**Revoke Transaction:**
```json
{
  "to": "0x...",
  "data": "0x095ea7b3...",
  "value": "0"
}
```

## Development

**Dependencies:**
- `@lucid-dreams/agent-kit` v0.2.22 - Agent framework
- `@hono/node-server` v1.19.5 - HTTP server adapter
- `ethers` v6.15.0 - Blockchain library for transaction encoding
- `@covalenthq/client-sdk` v2.3.4 - Blockchain data API

**Running locally:**
```bash
npm install
npm start
```

Server runs on `http://localhost:8080`

## Deployment

This agent is deployed on Railway:
- **URL:** https://bounty5-auditor-production.up.railway.app
- **Environment:** Node.js 22

**Required Environment Variables:**
```env
COVALENT_API_KEY=your_covalent_api_key
PAY_TO=0xYourPaymentWallet
NETWORK=base
DEFAULT_PRICE=0.01
FACILITATOR_URL=https://facilitator.daydreams.systems
```

**Note:** `PRIVATE_KEY` is NOT needed on Railway. It's only for local testing to pay yourself.

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Acknowledgments

Built for the [Daydreams AI Agent Bounties](https://github.com/daydreamsai/agent-bounties) program - Issue #5
