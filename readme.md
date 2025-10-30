# Approval Risk Auditor Agent

An AI agent that audits Ethereum wallets for risky ERC-20 and NFT approvals across multiple blockchains. Built with [@lucid-dreams/agent-kit](https://github.com/daydreamsai/lucid-fullstack).

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

# Optional: Configure x402 payments
# Add to .env:
# ADDRESS=your_payment_wallet_address
# NETWORK=base-sepolia
# DEFAULT_PRICE=1000
```

### Usage

**Start the server:**
```bash
node server.js
```

**Make a request:**
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

This agent supports the x402 payment protocol. When enabled:

- Each audit request costs a small fee (configurable via `DEFAULT_PRICE`)
- Payments are handled automatically by the agent-kit framework
- Set `ADDRESS` in .env to your payment wallet address
- Supports multiple networks (Base Sepolia, Ethereum, etc.)

**Environment Variables:**
```env
ADDRESS=0xYourPaymentWallet
NETWORK=base-sepolia
DEFAULT_PRICE=1000
FACILITATOR_URL=https://facilitator.daydreams.systems
```

Payment is optional - leave these variables unset for free access.

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

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
