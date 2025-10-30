# Demo: x402 Payment Flow

This demo shows the complete payment flow using the test script.

## What the demo proves:

1. Without payment: Agent returns 402 Payment Required
2. With payment: Agent processes request and returns audit data
3. Payment is deducted from wallet (verified via balance check)

## Demo Commands:

### Step 1: Check balance before payment
```bash
node check-balance.js
```

### Step 2: Run payment test (handles 402 → payment → data automatically)
```bash
npm run pay:test
```

This script will:
- Make initial request → get 402
- Create payment header automatically
- Retry request with payment → get 200 with audit data
- Show payment receipt

### Step 3: Check balance after payment
```bash
node check-balance.js
```

You'll see 0.01 USDC was deducted.

## What you get:

The audit returns three arrays:
- `approvals[]` - All token approvals found
- `risk_flags[]` - Risk indicators (unlimited/stale) for each approval
- `revoke_tx_data[]` - Ready-to-sign transactions to revoke each approval
