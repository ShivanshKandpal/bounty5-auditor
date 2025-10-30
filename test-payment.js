import fetch from 'node-fetch';
import { createSigner, decodeXPaymentResponse } from 'x402-fetch';
import { createPaymentHeader, selectPaymentRequirements } from 'x402/client';
import { PaymentRequirementsSchema } from 'x402/types';
import 'dotenv/config';

const AGENT_URL = process.env.AGENT_URL || 'https://bounty5-auditor-production.up.railway.app';
const ENDPOINT = '/entrypoints/audit/invoke';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NETWORK = process.env.NETWORK || 'base-sepolia';

// Test wallet and chains
const TEST_WALLET = process.env.TEST_WALLET || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // vitalik.eth
const TEST_CHAINS = (process.env.TEST_CHAINS || 'eth-mainnet').split(',');

async function main() {
  console.log('🚀 Testing Approval Risk Auditor with x402 Payment\n');
  console.log('═══════════════════════════════════════════════════\n');

  if (!PRIVATE_KEY) {
    console.error('❌ Error: PRIVATE_KEY not set in .env file');
    console.log('\nPlease add your private key to .env:');
    console.log('PRIVATE_KEY=your_private_key_here');
    process.exit(1);
  }

  // Step 1: Create signer for the payment network
  console.log('📝 Step 1: Creating payment signer...');
  console.log(`   Network: ${NETWORK}`);
  const signer = await createSigner(NETWORK, PRIVATE_KEY);
  console.log(`   Wallet: ${signer.address}`);
  console.log('   ✅ Signer created\n');

  // Step 2: Make first request (will get 402)
  console.log('💳 Step 2: Making initial request (expect 402)...');
  const url = `${AGENT_URL}${ENDPOINT}`;
  const requestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: {
        wallet: TEST_WALLET,
        chains: TEST_CHAINS
      }
    })
  };

  const firstResponse = await fetch(url, requestInit);
  const firstBody = await firstResponse.json();

  if (firstResponse.status !== 402) {
    console.log(`   ❌ Expected 402, got ${firstResponse.status}`);
    console.log(`   Response:`, firstBody);
    process.exit(1);
  }

  console.log(`   ✅ Got 402 Payment Required\n`);

  // Step 3: Parse payment requirements
  console.log('🔍 Step 3: Parsing payment requirements...');
  const { x402Version, accepts } = firstBody;
  const requirements = accepts.map((entry) => PaymentRequirementsSchema.parse(entry));
  const selected = selectPaymentRequirements(requirements, NETWORK, "exact");
  
  console.log(`   Pay to: ${selected.payTo}`);
  console.log(`   Amount: ${selected.maxAmountRequired} base units (${parseInt(selected.maxAmountRequired) / 1000000} USDC)`);
  console.log(`   Network: ${selected.network}`);
  console.log('   ✅ Requirements parsed\n');

  // Step 4: Create payment header and make second request
  console.log('💰 Step 4: Creating payment and making request...');
  const paymentHeader = await createPaymentHeader(signer, x402Version, selected);
  
  const secondResponse = await fetch(url, {
    ...requestInit,
    headers: {
      ...requestInit.headers,
      'X-PAYMENT': paymentHeader,
    },
  });

  const responseText = await secondResponse.text();
  console.log(`   Response status: ${secondResponse.status}\n`);

  // Step 5: Check payment receipt
  console.log('� Step 5: Checking payment receipt...');
  const paymentResponseHeader = secondResponse.headers.get('x-payment-response');
  if (paymentResponseHeader) {
    const paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
    console.log('   ✅ Payment successful!');
    console.log(`   Transaction: ${paymentResponse.tx || 'N/A'}`);
    console.log(`   Network: ${paymentResponse.network || NETWORK}`);
  } else {
    console.log('   ⚠️  No payment response header');
  }

  const paymentError = secondResponse.headers.get('x-payment-error');
  if (paymentError) {
    console.log(`   ❌ Payment error: ${paymentError}`);
  }
  console.log('');

  // Step 6: Parse and display results
  console.log('📊 Step 6: Audit Results...');
  try {
    const data = JSON.parse(responseText);
    
    if (secondResponse.ok) {
      console.log('   ✅ Request successful!\n');
      console.log('═══════════════════════════════════════════════════\n');
      console.log('📋 AUDIT REPORT\n');
      
      if (data.approvals && Array.isArray(data.approvals)) {
        console.log(`   Total Approvals Found: ${data.approvals.length}`);
        console.log(`   Risk Flags: ${data.risk_flags?.length || 0}`);
        console.log(`   Revoke Transactions Generated: ${data.revoke_tx_data?.length || 0}\n`);
      
        if (data.approvals.length > 0) {
          console.log('   Sample Risky Approvals:\n');
          data.approvals.slice(0, 3).forEach((approval, i) => {
            console.log(`   ${i + 1}. ${approval.type || 'Token'} - ${approval.token_name || 'Unknown'}`);
            console.log(`      Address: ${approval.token_address || 'N/A'}`);
            console.log(`      Spender: ${approval.spender || 'N/A'}`);
            console.log(`      Risk: ${data.risk_flags[i] ? JSON.stringify(data.risk_flags[i]) : 'N/A'}`);
            console.log('');
          });
          
          if (data.approvals.length > 3) {
            console.log(`   ... and ${data.approvals.length - 3} more approvals\n`);
          }
        } else {
          console.log('   ✅ No risky approvals found!\n');
        }
      }
      
      console.log('═══════════════════════════════════════════════════\n');
      console.log('📄 Full Response:\n');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`   ❌ Request failed with status: ${secondResponse.status}`);
      console.log('   Response:', JSON.stringify(data, null, 2));
    }
  } catch (parseError) {
    console.log(`   ❌ Failed to parse response: ${parseError.message}`);
    console.log(`   Raw response: ${responseText.substring(0, 500)}`);
  }
  
  console.log('\n✨ Demo completed successfully!\n');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
