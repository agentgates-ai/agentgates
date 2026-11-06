<p align="center"><img src="assets/icon.png" width="96" alt="Agentgates"></p>

# Agentgates

Confidential computers for AI swarms, models, phone calls, inboxes and an x402 directory, sold to AI agents for USDC over [x402](https://x402.org). No signup and no API key: the wallet that pays is the account.

[agentgates.ai](https://agentgates.ai) | [Prices, read live](https://agentgates.ai/pricing) | [llms.txt](https://agentgates.ai/llms.txt)

## What agents can buy

| Product | What it is | Contract |
| --- | --- | --- |
| Compute | Confidential computers for AI swarms: a dedicated confidential VM (Intel TDX) for each agent, for trading swarms or any other swarm, by the hour, running your Docker image or compose file, with a remote-attestation quote | [docs](https://api.agentgates.ai/api/compute/docs), [catalog](https://api.agentgates.ai/api/compute/catalog) |
| Inference | Models in the standard chat format, paid by the request: confidential models in attested hardware, and a cheaper open tier without attestation | [docs](https://api.agentgates.ai/api/inference/docs), [catalog](https://api.agentgates.ai/api/inference/catalog) |
| Phone | The payphone: one real call with no account, in your own voice over a websocket or with our operator. Or a number of your own | [docs](https://api.agentgates.ai/api/account/docs/phone) |
| Voice | Our AI operator makes the call and answers with the transcript and the outcome | [docs](https://api.agentgates.ai/api/account/docs/voice) |
| Email | Inboxes for agents: receive mail and sign-up codes, and send | [docs](https://api.agentgates.ai/api/account/docs/email) |
| x402 directory | Find, review and list x402 services | [docs](https://api.agentgates.ai/api/directory/docs) |

## Install

Skills, for any coding agent:

```bash
npx skills add agentgates-ai/agentgates
```

Claude Code:

```
/plugin marketplace add agentgates-ai/agentgates
/plugin install agentgates@agentgates
```

Gemini CLI:

```bash
gemini extensions install https://github.com/agentgates-ai/agentgates
```

MCP servers (Streamable HTTP), both in the official MCP registry:

| Server | URL | Sign-in | Registry name |
| --- | --- | --- | --- |
| Compute | `https://mcp.agentgates.ai/compute` | None: plans, quotes and docs | `ai.agentgates/compute` |
| Wallet | `https://mcp.agentgates.ai/api/mcp` | OAuth. Every money move is a proposal its owner approves | `ai.agentgates/mcp` |

CLI:

```bash
npm i -g @agentgates/cli
agentgates init
```

## OpenClaw on a confidential computer

An OpenClaw agent with [`skills/agentgates-swarm`](skills/agentgates-swarm) starts more OpenClaw agents, one confidential computer each, with our inference as their model, paid from two prepaid balances its owner set or over x402. Each machine runs [`compose.yml`](skills/agentgates-swarm/compose.yml): OpenClaw's own image, pinned by digest. From ClawHub: `openclaw skills install @agentgates/agentgates-swarm`.

## How paying works

1. Send the request with no payment header. The answer is a `402` naming the exact USDC amount on each network it accepts. Asking is free: nothing runs and nothing is charged.
2. Sign that amount with the paying wallet.
3. Send the same request again with the payment in `X-PAYMENT` (x402 v1) or `PAYMENT-SIGNATURE` (x402 v2, on compute today).

Or prepay a balance once and spend it request by request, signed by the wallet or with a bearer key.

Prices move with gas and with the providers, so they live in the `402` and the catalogs, never in this repo.

## Examples

- [`examples/quote-a-vm.sh`](examples/quote-a-vm.sh): a VM's price on every network, free.
- [`examples/buy-a-vm.mjs`](examples/buy-a-vm.mjs): rent one for an hour with the official x402 v2 client.
- [`examples/chat.sh`](examples/chat.sh): ask a confidential model with a bearer key.
- [`examples/payphone.sh`](examples/payphone.sh): the payphone's windows and the price of one call.

## Machine-readable

| What | URL |
| --- | --- |
| Index for agents | [/llms.txt](https://agentgates.ai/llms.txt) |
| Every contract in one file | [/llms-full.txt](https://agentgates.ai/llms-full.txt) |
| OpenAPI | [/openapi.json](https://agentgates.ai/openapi.json), [/openapi.yaml](https://agentgates.ai/openapi.yaml) |
| A2A agent card and JSON-RPC door | [/.well-known/agent-card.json](https://agentgates.ai/.well-known/agent-card.json), `POST https://agentgates.ai/a2a` |
| Agent skills index | [/.well-known/agent-skills/index.json](https://agentgates.ai/.well-known/agent-skills/index.json) |
| ARD catalog | [/.well-known/ard.json](https://agentgates.ai/.well-known/ard.json) |
| API catalog (RFC 9727) | [/.well-known/api-catalog](https://agentgates.ai/.well-known/api-catalog) |
| MCP server card | [/.well-known/mcp.json](https://agentgates.ai/.well-known/mcp.json) |
| How agents authenticate | [/auth.md](https://agentgates.ai/auth.md) |
| Prices | [/pricing](https://agentgates.ai/pricing) |

## Spending

Everything here costs its owner money. An agent should pay only what its owner allowed: ask first, or stay inside a budget the owner set. Every skill in [`skills/`](skills) says so.

## This repo

`skills/` holds the same `SKILL.md` files [agentgates.ai serves](https://agentgates.ai/.well-known/agent-skills/index.json), and `agentgates-swarm`, which carries its compose and a script, so it installs from here or from ClawHub. `.claude-plugin/` and `.mcp.json` make it a Claude Code plugin, `gemini-extension.json` a Gemini CLI extension, and `registry/` holds the MCP registry records. The services themselves run at agentgates.ai.

[Terms](https://agentgates.ai/terms), [Privacy](https://agentgates.ai/terms#privacy), [security.txt](https://agentgates.ai/.well-known/security.txt). Support: support@agentgates.ai.

## License

MIT
