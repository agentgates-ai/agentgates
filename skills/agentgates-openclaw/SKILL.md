---
name: agentgates-openclaw
description: "Start another OpenClaw agent on its own confidential computer (a sealed Intel TDX VM), one machine per agent, paid in USDC from a prepaid Agentgates balance. Its default model is Agentgates inference, paid from a second prepaid balance."
metadata:
  openclaw:
    requires:
      bins:
        - node
      env:
        - AGENTGATES_COMPUTE_KEY
        - AGENTGATES_INFERENCE_KEY
    primaryEnv: AGENTGATES_COMPUTE_KEY
    envVars:
      - name: AGENTGATES_COMPUTE_KEY
        required: true
        description: "A compute key (agc_...) your owner minted on their prepaid Agentgates compute balance. It rents and renews machines from that balance and can do nothing else: it signs no payment, touches no wallet and destroys no machine."
      - name: AGENTGATES_INFERENCE_KEY
        required: true
        description: "An inference key (ag_...) on your owner's prepaid Agentgates inference balance. Every machine you start uses it as its model key."
    homepage: https://github.com/agentgates-ai/agentgates
---

# OpenClaw on a confidential computer

Start a new OpenClaw agent on a machine of its own: a confidential VM (Intel
TDX) rented by the hour from Agentgates, with a remote-attestation quote. One
machine per agent. You give it work over HTTPS, it answers, and its sessions
and memory stay on that machine's encrypted disk. Use it for a swarm: trading
agents that keep their keys and strategies sealed from the host, research or
data workers, or any agent that should run apart from you.

The new agent runs OpenClaw's own release image (`compose.yml` in this skill,
pinned by digest; OpenClaw is https://github.com/openclaw/openclaw). Its model
is Agentgates inference in the standard chat format, default `glm-5-3-flash`,
a confidential model in attested hardware.

## What your owner sets up once

1. A prepaid compute balance and a compute key on it:
   `POST https://api.agentgates.ai/api/compute/credits` with `{"amountUsd": 5}`
   (1, 5, 25 or 100), paid over x402 by their wallet, then
   `POST https://api.agentgates.ai/api/compute/keys` with `{"name": "my-agent"}`,
   signed by that wallet. Contract: `GET https://api.agentgates.ai/api/compute/docs`.
2. A prepaid inference balance and a key on it: the same two calls under
   `/api/inference/credits` and `/api/inference/keys`. Contract:
   `GET https://api.agentgates.ai/api/inference/docs`.
3. The two secrets in your environment: `AGENTGATES_COMPUTE_KEY` (agc_...) and
   `AGENTGATES_INFERENCE_KEY` (ag_...).

## Start a machine

```bash
node {baseDir}/scripts/openclaw-machine.mjs price
node {baseDir}/scripts/openclaw-machine.mjs start --name worker-1 --max-usd 1
```

`start` reads the live price and your compute balance, refuses if the balance
is short or the price is over `--max-usd`, then buys the machine (default
`compute.standard`, 1 hour; `--hours N` or `--minutes 15|30|45`, `--model <id>`
from `GET https://api.agentgates.ai/api/inference/catalog`). It makes a fresh
gateway token, seals it into the machine with the inference key, keeps it in
`~/.agentgates/openclaw-machines.json` (readable by you only) and waits until
the new OpenClaw answers, about 3 minutes after the purchase (we measured
2 minutes 28 seconds and 2 minutes 42 seconds). The machine's clock starts
when it runs.

`compute.standard` (2 vCPU, 4 GB) is the smallest plan OpenClaw runs well on.
Measured with OpenClaw 2026.11.1: on 1 vCPU it gave no answer in 5 minutes,
and given room its memory peaked at 2.07 GB, more than a 2 GB machine holds.
On a Standard machine with `glm-5-3-flash` its answers took 8 to 58 seconds.

`compose.yml` reads `OPENCLAW_GATEWAY_TOKEN`, `AGENTGATES_API_KEY` and
`AGENTGATES_MODEL` from the new machine's sealed env, which `start` fills. Your
own environment needs only the two keys above.

## Give it work

```bash
node {baseDir}/scripts/openclaw-machine.mjs ask worker-1 "Write a pre-trade checklist for a BTC perpetuals strategy and keep it in your notes"
node {baseDir}/scripts/openclaw-machine.mjs list
node {baseDir}/scripts/openclaw-machine.mjs renew worker-1 --hours 1 --max-usd 1
```

`ask` posts to the machine's own `POST /v1/chat/completions` (model
`openclaw`) with its token; `--session <id>` keeps a conversation apart.
Anyone holding that token is the machine's operator: never share it.

A new OpenClaw's first answer may end by asking what to call it. That is its
first-run greeting: name it in your next message or go on with the work. Its
sessions live on the machine's disk, so after a restart the same `--session`
carries on where it was.

A machine stops when its paid time ends and its disk is kept a while after
(`GET https://api.agentgates.ai/api/compute/docs`, "Lifecycle"). Renew before
`expiresAt` to keep it. Your compute key cannot destroy a machine; your owner's
wallet can.

## Paying with x402 instead

If your agent pays its own way over x402 and your owner set a per-payment cap,
`node {baseDir}/scripts/openclaw-machine.mjs body --name worker-2 --minutes 15`
prints the create body (this compose, a fresh token, the inference key) and
saves the token. The body holds both secrets: send it only to
`https://api.agentgates.ai/api/compute/deployments`, with your x402 client. The
`402` names the exact price on each network, and asking it is free. Then run
`attach worker-2 <deploymentId>` and `list` until it shows `running`.

A machine belongs to the wallet that paid for it. `list` finds it when that
wallet is your owner's, the one behind your compute key. If another wallet
paid, read the machine with that wallet (`GET /api/compute/deployments/{id}`
signed with `X-Wallet-Auth`, in the compute docs) and pass its endpoint:
`attach worker-2 <deploymentId> <endpoint>`. Any wallet may pay a renewal
(`POST /api/compute/deployments/{id}/renew`) over x402 the same way.

## If a machine never answers

If `start` reports the machine running but OpenClaw does not answer within 15
minutes, its sealed env may have been lost: the docs say a provision retry runs
without env values. Your owner can send them again with
`POST /api/compute/deployments/{id}/update` signed by their wallet, or you can
start another machine.

## Spending

This skill spends your owner's money, and only from the two prepaid balances
behind the keys they gave you. Each machine is drawn from the compute balance
at the price `start` prints first; every model call a machine makes is drawn
from the inference balance. The template starts OpenClaw with no scheduled
jobs: a machine calls its model only when you ask it something, or on a
schedule you asked it to keep. Neither key can spend more than its balance
holds, and your owner can revoke either at once. Start or renew a machine only
when your owner asked you to or set a budget for it, and pass `--max-usd` with
that budget. Asking the price is free and never charges.
