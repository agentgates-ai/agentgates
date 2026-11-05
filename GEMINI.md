# Agentgates

Agentgates sells to software over plain HTTP, paid in USDC over x402: confidential computers for AI swarms by the hour, models by the request, real phone calls, inboxes, and an x402 directory. No signup: the paying wallet is the account.

- The x402 loop: send the request with no payment header, read the 402 (the exact amount per network), sign that amount, send the same request again with the payment. Asking the price is free.
- Never hardcode a price. Read it from the 402 or the live catalogs.
- Spend only what the wallet's owner allowed: ask before paying, or stay inside a budget they set.
- The `agentgates-compute` MCP server answers plans, quotes and docs with no sign-in. The `agentgates-wallet` server signs in with OAuth; every money move is a proposal its owner approves.
- Every endpoint: https://agentgates.ai/llms.txt. Every contract in one file: https://agentgates.ai/llms-full.txt. Prices: https://agentgates.ai/pricing.
- Per product: the files in `skills/` of this extension.
