import fetch from 'node-fetch';
import { createSigner } from 'x402-fetch';
import { createPaymentHeader, selectPaymentRequirements } from 'x402/client';
import { PaymentRequirementsSchema } from 'x402/types';
import 'dotenv/config';

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8080';
const ENDPOINT = '/entrypoints/audit/invoke';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NETWORK = process.env.NETWORK || 'base';
const TEST_WALLET = process.env.TEST_WALLET || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const TEST_CHAINS = (process.env.TEST_CHAINS || 'eth-mainnet').split(',');

console.log('Creating payment and making request...\n');

const url = `${AGENT_URL}${ENDPOINT}`;
const requestBody = JSON.stringify({
  input: { wallet: TEST_WALLET, chains: TEST_CHAINS }
});

// Step 1: Get payment requirements
console.log('Step 1: Getting payment requirements...');
const firstResponse = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: requestBody
});

const firstBody = await firstResponse.json();
console.log(`Status: ${firstResponse.status} - Payment Required\n`);
console.log('Response received:');
console.log(JSON.stringify(firstBody, null, 2));
console.log('');

// Step 2: Create payment header
console.log('Step 2: Creating payment...');
const { x402Version, accepts } = firstBody;
const requirements = accepts.map((entry) => PaymentRequirementsSchema.parse(entry));
const selected = selectPaymentRequirements(requirements, NETWORK, "exact");

console.log(`  Amount: ${parseInt(selected.maxAmountRequired) / 1000000} USDC`);
console.log(`  Network: ${selected.network}\n`);

const signer = await createSigner(NETWORK, PRIVATE_KEY);
const paymentHeader = await createPaymentHeader(signer, x402Version, selected);
console.log('Payment header created!\n');

// Step 3: Make request with payment
console.log('Step 3: Making request WITH payment...\n');
const secondResponse = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-PAYMENT': paymentHeader
  },
  body: requestBody
});

const secondBody = await secondResponse.json();

console.log(`Status: ${secondResponse.status} ${secondResponse.statusText}\n`);

if (secondResponse.ok) {
  console.log('✓ Payment accepted! Audit completed\n');
  
  console.log('Full Response:');
  console.log(JSON.stringify(secondBody, null, 2));
  console.log('');
  
  if (secondBody.output) {
    const { approvals, risk_flags, revoke_tx_data } = secondBody.output;
    console.log('📊 Audit Results:');
    console.log(`  - Approvals found: ${approvals.length}`);
    console.log(`  - Risk flags: ${risk_flags.length}`);
    console.log(`  - Revoke transactions: ${revoke_tx_data.length}`);
    console.log('');
    
    if (approvals.length > 0) {
      console.log('Example approval:');
      console.log(JSON.stringify(approvals[0], null, 2));
    }
  }
  
  console.log('\n✓ Check balance: node check-balance.js');
} else {
  console.log('✗ Request failed');
  console.log(`Response: ${JSON.stringify(secondBody, null, 2)}`);
}
