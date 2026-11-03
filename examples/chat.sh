#!/usr/bin/env bash
# Ask a confidential model in the standard chat format, paid from a prepaid
# balance with a bearer key. Mint the key on https://agentgates.ai/inference:
# it can spend only the balance its wallet prepaid. Needs curl and jq.
set -euo pipefail
: "${AGENTGATES_KEY:?mint a key on https://agentgates.ai/inference and export AGENTGATES_KEY}"
BASE=https://api.agentgates.ai/api/inference/v1

# Any id from GET $BASE/models works; this picks the catalog's first confidential model.
MODEL=${MODEL:-$(curl -s https://api.agentgates.ai/api/inference/catalog | jq -r '[.models[] | select(.confidential)][0].id')}

curl -s "$BASE/chat/completions" \
  -H "authorization: Bearer $AGENTGATES_KEY" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg m "$MODEL" '{model: $m, max_tokens: 300, messages: [{role: "user", content: "Say hello in five words."}]}')" |
  jq .
