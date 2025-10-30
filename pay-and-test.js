import fetch from 'node-fetch';
import { createSigner } from 'x402-fetch';
import { createPaymentHeader, selectPaymentRequirements } from 'x402/client';
import { PaymentRequirementsSchema } from 'x402/types';
import 'dotenv/config';

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8080';
const ENDPOINT = '/entrypoints/audit/invoke';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NETWORK = process.env.NETWORK || 'base';

const TEST_WALLET = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const TEST_CHAINS = ['eth-mainnet'];

console.log('Creating payment and making request...\n');

const url = `${AGENT_URL}${ENDPOINT}`;
const requestBody = JSON.stringify({
  input: {
    wallet: TEST_WALLET,
    chains: TEST_CHAINS
  }
});

// Step 1: Get payment requirements
console.log('Step 1: Getting payment requirements...');
const firstResponse = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: requestBody
});

const firstBody = await firstResponse.json();
console.log('Got 402 Payment Required\n');

// Step 2: Create payment header
console.log('Step 2: Creating payment...');
const { x402Version, accepts } = firstBody;
const requirements = accepts.map((entry) => PaymentRequirementsSchema.parse(entry));
const selected = selectPaymentRequirements(requirements, NETWORK, "exact");

console.log(`  Pay to: ${selected.payTo}`);
console.log(`  Amount: ${selected.maxAmountRequired} (0.01 USDC)`);
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

const secondBody = await secondResponse.text();

console.log(`Status: ${secondResponse.status} ${secondResponse.statusText}\n`);

if (secondResponse.ok) {
  console.log('✓ Payment accepted! Audit processing...\n');
  
  try {
    const data = JSON.parse(secondBody);
    
    // Check if it's an async response with run_id
    if (data.run_id && data.status) {
      console.log(`Run ID: ${data.run_id}`);
      console.log(`Status: ${data.status}\n`);
      
      // Poll for results
      console.log('Fetching audit results...\n');
      const resultsUrl = `${AGENT_URL}/runs/${data.run_id}`;
      
      let attempts = 0;
      let results = null;
      
      while (attempts < 10 && !results) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        try {
          const resultsResponse = await fetch(resultsUrl);
          const resultsText = await resultsResponse.text();
          
          // Try to parse the response
          const resultsData = JSON.parse(resultsText);
          
          if (resultsData.status === 'succeeded' && resultsData.output) {
            results = resultsData.output;
            break;
          }
        } catch (pollError) {
          console.log(`Poll attempt ${attempts + 1}: ${pollError.message}`);
        }
        
        attempts++;
      }
      
      if (results && (results.approvals || results.revoke_tx_data)) {
        console.log('=== AUDIT RESULTS ===\n');
        console.log(`Total Approvals: ${results.approvals?.length || 0}`);
        console.log(`Risk Flags: ${results.risk_flags?.length || 0}`);
        console.log(`Revoke Transactions: ${results.revoke_tx_data?.length || 0}\n`);
        
        if (results.revoke_tx_data && results.revoke_tx_data.length > 0) {
          console.log('Top 2 Revoke Transactions:\n');
          results.revoke_tx_data.slice(0, 2).forEach((tx, i) => {
            console.log(`${i + 1}. To: ${tx.to}`);
            console.log(`   Data: ${tx.data}`);
            console.log(`   Value: ${tx.value}\n`);
          });
        } else {
          console.log('No revoke transactions generated (wallet may be clean!)');
        }
      } else {
        console.log('Note: Agent is processing asynchronously. Results may take longer.');
      }
    }
    
    // Check if we got direct results
    if (data.approvals || data.risk_flags || data.revoke_tx_data) {
      console.log('\n=== AUDIT RESULTS ===\n');
      console.log(`Total Approvals: ${data.approvals?.length || 0}`);
      console.log(`Risk Flags: ${data.risk_flags?.length || 0}`);
      console.log(`Revoke Transactions: ${data.revoke_tx_data?.length || 0}\n`);
      
      if (data.revoke_tx_data && data.revoke_tx_data.length > 0) {
        console.log('Top 2 Revoke Transactions:\n');
        data.revoke_tx_data.slice(0, 2).forEach((tx, i) => {
          console.log(`${i + 1}. To: ${tx.to}`);
          console.log(`   Data: ${tx.data}`);
          console.log(`   Value: ${tx.value}\n`);
        });
      }
    }
    
  } catch (e) {
    console.log(`Response: ${secondBody}`);
    console.error(`Parse error: ${e.message}`);
  }
  
  console.log('\nRun "node check-balance.js" to verify payment was deducted.');
} else {
  console.log('✗ Request failed');
  console.log(`Response: ${secondBody}`);
}
