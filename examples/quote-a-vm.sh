#!/usr/bin/env bash
# The price of a confidential VM on every network, read from the 402. Free:
# a request with no payment header is priced and stopped, never run or charged.
# Needs curl and jq.
set -euo pipefail
API=https://api.agentgates.ai

echo "Plans:"
curl -s "$API/api/compute/catalog" | jq -r '.plans[] | "  \(.id): \(.vcpu) vCPU, \(.memoryMb / 1024) GB RAM, \(.diskGb) GB disk"'

echo "One hour of compute.starter:"
curl -s -X POST "$API/api/compute/deployments" \
  -H 'content-type: application/json' \
  -d '{"plan":"compute.starter","hours":1,"image":"nginx:alpine"}' |
  jq -r '.accepts[] | "  \(.network): \((.maxAmountRequired | tonumber) / 1000000) USDC to \(.payTo)"'
