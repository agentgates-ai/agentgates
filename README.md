# Agentgates

**Compute and inference for AI agents, paid in USDC over x402. No signup, no API key — the paying wallet is the account.**

Two things are for sale at [agentgates.ai](https://agentgates.ai), both to software, both over plain HTTP:

- **Compute** — a dedicated confidential VM (Intel TDX) by the hour, running your Docker workload, with a remote-attestation quote and a public proof page. [Agent docs](https://agentgates.ai/api/compute/docs) · [catalog (JSON)](https://agentgates.ai/api/compute/catalog)
- **Inference** — open models on attested GPUs, one request one payment, price known before the model runs. [Agent docs](https://agentgates.ai/api/inference/docs) · [catalog (JSON)](https://agentgates.ai/api/inference/catalog)

## How to pay (the x402 loop)

1. Send the request with no `X-PAYMENT` header.
2. The answer is HTTP `402` with an `accepts` array — one entry per network, each carrying the exact `maxAmountRequired` in USDC atomic units, the `asset` contract and the `payTo` address.
3. Sign that entry's amount as an EIP-3009 transfer authorization.
4. Send the SAME request again with the signature in `X-PAYMENT`. The answer carries the work and the settlement.

Quoting is free and repeatable: a request with no payment header is priced and stopped, never fulfilled and never charged.

## MCP server

`https://agentgates.ai/mcp` — Streamable HTTP, OAuth 2.0 (PKCE + dynamic client registration). Pair an Agentgates wallet under owner-approved grants: read balances, propose sends, swaps and earn moves. Every money-moving action is propose-only; the wallet owner approves.

Listed on the official MCP registry as **`ai.agentgates/mcp`**.

## Machine surfaces

| Surface | URL |
| --- | --- |
| Machine index | [/llms.txt](https://agentgates.ai/llms.txt) |
| Full contract, one file | [/llms-full.txt](https://agentgates.ai/llms-full.txt) |
| OpenAPI 3.1 | [/openapi.json](https://agentgates.ai/openapi.json) |
| Auth (anonymous / bearer / OAuth) | [/auth.md](https://agentgates.ai/auth.md) |
| MCP server card | [/.well-known/mcp.json](https://agentgates.ai/.well-known/mcp.json) |
| A2A agent card | [/.well-known/agent-card.json](https://agentgates.ai/.well-known/agent-card.json) |
| API catalog (RFC 9727) | [/.well-known/api-catalog](https://agentgates.ai/.well-known/api-catalog) |
| ARD capability manifest | [/.well-known/ai-catalog.json](https://agentgates.ai/.well-known/ai-catalog.json) |
| Agent skills | [/.well-known/agent-skills/index.json](https://agentgates.ai/.well-known/agent-skills/index.json) |
| Guides | [/docs](https://agentgates.ai/docs) |

## CLI

```bash
npm i -g @agentgates/cli
agentgates --help
```

Prices are never in these documents — money is a read. Every number comes from the live catalogs, and every `402` quotes the exact amount for your exact request.
