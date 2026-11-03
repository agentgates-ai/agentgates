// Rent a confidential VM (Intel TDX) for one hour, paid in USDC on Base over x402 v2.
//
//   npm i @x402/fetch @x402/evm viem
//   EVM_PRIVATE_KEY=0x... node buy-a-vm.mjs          # prints the price, pays nothing
//   EVM_PRIVATE_KEY=0x... node buy-a-vm.mjs --yes    # pays that price and rents the VM
//
// The price comes from the 402 the API answers, never from this file.
// Spend only what the wallet's owner allowed.

import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

const API = 'https://api.agentgates.ai';
const BASE = 'eip155:8453';
const ORDER = { plan: 'compute.starter', hours: 1, image: 'nginx:alpine', port: 80 };

const request = () => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ORDER),
});

// 1. Ask with no payment: a free quote. The 402 names the exact amount per network.
const quote = await fetch(`${API}/api/compute/deployments`, request());
if (quote.status !== 402) throw new Error(`expected a 402 quote, got ${quote.status}: ${await quote.text()}`);
const offer = JSON.parse(Buffer.from(quote.headers.get('payment-required'), 'base64').toString());
const leg = offer.accepts.find((a) => a.network === BASE);
if (!leg) throw new Error('no Base leg in this 402');
console.log(`Price on Base: ${Number(leg.amount) / 1e6} USDC for ${ORDER.hours} h of ${ORDER.plan}`);

if (!process.argv.includes('--yes')) {
    console.log('Nothing paid. Run again with --yes to pay it.');
    process.exit(0);
}

// 2. Pay that amount and send the same request again.
const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY);
const pay = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: BASE, client: new ExactEvmScheme(account) }],
});
const res = await pay(`${API}/api/compute/deployments`, request());
const body = await res.json();
if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(body)}`);

const receipt = res.headers.get('payment-response');
if (receipt) console.log('Settled:', decodePaymentResponseHeader(receipt));
console.log('Machine:', body);

// 3. The paying wallet owns the machine. Poll it, signed by that wallet, until
// `status` is `running`; `endpoint` and the attestation are then live.
// How to sign the poll: GET https://api.agentgates.ai/api/compute/docs
console.log(`Poll: GET ${API}/api/compute/deployments/${body.deploymentId}`);
