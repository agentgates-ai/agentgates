#!/usr/bin/env bash
# The payphone: one real phone call with no account. Reading the windows is
# free, and so is the 402 that prices one call: nothing is dialed until it is
# paid. Needs curl and jq.
set -euo pipefail

curl -s https://agentgates.ai/api/booth | jq '.windows'

# Our operator makes the call and answers with the transcript. Use your own
# voice instead with "streamUrl": "wss://your-host/media" in place of "task".
curl -s -X POST https://agentgates.ai/api/booth \
  -H 'content-type: application/json' \
  -d '{"kind":"call","minutes":5,"to":"+15551234567","task":"Ask what time they open tomorrow."}' |
  jq -r '.accepts[] | "\(.network): \((.maxAmountRequired | tonumber) / 1000000) USDC"'
