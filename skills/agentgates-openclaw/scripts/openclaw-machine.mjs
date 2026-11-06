#!/usr/bin/env node
// Start, list, ask and renew OpenClaw agents on Agentgates confidential computers.
// No dependencies (Node 18 or newer). It spends only the prepaid balances behind
// the two keys its owner gave it, prints the price and the balance before every
// purchase, and refuses when the balance is short or the price is over --max-usd.
//
//   node openclaw-machine.mjs price [--plan compute.standard] [--hours 1 | --minutes 30]
//   node openclaw-machine.mjs start [--name worker-1] [--plan ...] [--hours 1] [--model glm-5-3-flash] [--max-usd 1]
//   node openclaw-machine.mjs list
//   node openclaw-machine.mjs ask <name> <message...> [--session <id>]
//   node openclaw-machine.mjs renew <name> [--hours 1 | --minutes 30] [--max-usd 1]
//   node openclaw-machine.mjs body [--name ...] [--plan ...] [--hours 1] [--model ...]   (for an x402 client)
//
// Keys (environment):
//   AGENTGATES_COMPUTE_KEY    agc_... on a prepaid compute balance: rents and renews machines, nothing else
//   AGENTGATES_INFERENCE_KEY  ag_... on a prepaid inference balance: the model key each new machine uses
//
// Each machine's gateway token is made here, sealed into that machine, and kept
// in --state (default ~/.agentgates/openclaw-machines.json, readable by you only).

import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPOSE_FILE = resolve(HERE, '..', 'compose.yml');

function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else { flags[key] = next; i++; }
    } else rest.push(a);
  }
  return { flags, rest };
}

const { flags, rest } = parseArgs(process.argv.slice(2));
const command = rest.shift();
const API = String(flags.api || 'https://api.agentgates.ai').replace(/\/+$/, '');
const STATE = resolve(String(flags.state || join(homedir(), '.agentgates', 'openclaw-machines.json')));
const PLAN = String(flags.plan || 'compute.standard');
const MODEL = String(flags.model || 'glm-5-3-flash');

function fail(message) {
  console.error('error: ' + message);
  process.exit(1);
}

function timeAsked() {
  if (flags.minutes !== undefined) {
    const m = Number(flags.minutes);
    if (![15, 30, 45].includes(m)) fail('--minutes must be 15, 30 or 45');
    return { minutes: m };
  }
  const h = flags.hours === undefined ? 1 : Number(flags.hours);
  if (!Number.isInteger(h) || h < 1 || h > 720) fail('--hours must be a whole number from 1 to 720');
  return { hours: h };
}

function computeKey() {
  const key = process.env.AGENTGATES_COMPUTE_KEY;
  if (!key || !key.startsWith('agc_')) fail('AGENTGATES_COMPUTE_KEY must hold a compute key (agc_...) your owner minted on a prepaid compute balance');
  return key;
}

function inferenceKey() {
  const key = process.env.AGENTGATES_INFERENCE_KEY;
  if (!key || !key.startsWith('ag_')) fail('AGENTGATES_INFERENCE_KEY must hold an inference key (ag_...) on a prepaid inference balance');
  return key;
}

async function call(method, path, { key, body, timeoutMs = 60_000 } = {}) {
  const headers = { accept: 'application/json' };
  if (key) headers.authorization = 'Bearer ' + key;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { status: res.status, json, text };
}

function readState() {
  if (!existsSync(STATE)) return { machines: [] };
  try { return JSON.parse(readFileSync(STATE, 'utf8')); } catch { fail('cannot read ' + STATE); }
}

function writeState(state) {
  mkdirSync(dirname(STATE), { recursive: true, mode: 0o700 });
  const tmp = STATE + '.tmp';
  writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  renameSync(tmp, STATE);
  chmodSync(STATE, 0o600);
}

function findMachine(state, ref) {
  if (!ref) fail('name the machine: its --name or its deploymentId (see "list")');
  const m = state.machines.find((x) => x.name === ref || x.deploymentId === ref);
  if (!m) fail('no machine "' + ref + '" in ' + STATE);
  return m;
}

// The catalog's price for this purchase, read now. A balance draw is charged
// what the create answers; this is the figure to compare with the owner's cap.
async function livePrice(planId, time) {
  const { status, json } = await call('GET', '/api/compute/catalog');
  if (status !== 200 || !json) fail('the catalog did not answer (' + status + ')');
  const plan = (json.plans || []).find((p) => p.id === planId);
  if (!plan) fail('no plan "' + planId + '"; plans: ' + (json.plans || []).map((p) => p.id).join(', '));
  if (time.minutes) {
    const rung = (plan.minutesPricing || []).find((r) => r.minutesPerPayment === time.minutes);
    if (!rung || rung.totalUsd == null) fail(planId + ' is not sold by the quarter-hour right now');
    return { plan, usd: Number(rung.balanceTotalUsd ?? rung.totalUsd) };
  }
  const rungs = (plan.pricing || []).filter((r) => r.hoursPerPayment <= time.hours).sort((a, b) => b.hoursPerPayment - a.hoursPerPayment);
  const rung = rungs[0];
  if (!rung) fail('no price for ' + time.hours + ' hours on ' + planId);
  if (rung.hoursPerPayment === time.hours) return { plan, usd: Number(rung.balanceTotalUsd ?? rung.totalUsd) };
  return { plan, usd: Number(rung.priceUsdPerHour) * time.hours, estimate: true };
}

async function balanceOf(path, key) {
  const { status, json } = await call('GET', path, { key });
  if (status !== 200 || !json) return null;
  const c = json.credit || json.balance || json;
  const v = c && (c.availableUsd ?? c.balanceUsd);
  return v === undefined || v === null ? 0 : Number(v);
}

function guard(usd, available) {
  if (flags['max-usd'] !== undefined) {
    const cap = Number(flags['max-usd']);
    if (!(cap > 0)) fail('--max-usd must be a positive number');
    if (usd > cap) fail('this costs $' + usd.toFixed(3) + ', over --max-usd ' + cap + '; nothing was bought');
  }
  if (available !== null && available < usd) {
    fail('the compute balance holds $' + available.toFixed(3) + ' and this costs $' + usd.toFixed(3) + '; ask your owner to top it up (POST ' + API + '/api/compute/credits); nothing was bought');
  }
}

function createBody(name, time) {
  return {
    plan: PLAN,
    ...time,
    name,
    compose: readFileSync(COMPOSE_FILE, 'utf8'),
    env: {
      OPENCLAW_GATEWAY_TOKEN: randomBytes(32).toString('hex'),
      AGENTGATES_API_KEY: inferenceKey(),
      AGENTGATES_MODEL: MODEL,
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitReady(key, machine) {
  const deadline = Date.now() + Number(flags['wait-minutes'] || 15) * 60_000;
  const said = new Set();
  const say = (line) => { if (!said.has(line)) { said.add(line); console.log(line); } };
  while (Date.now() < deadline) {
    const { status, json } = await call('GET', '/api/compute/deployments', { key });
    const row = status === 200 ? (json.deployments || []).find((d) => d.deploymentId === machine.deploymentId) : null;
    if (row) {
      say('machine ' + row.status);
      if (['failed', 'destroyed', 'grace', 'stopped'].includes(row.status)) fail('the machine is ' + row.status + '; see GET ' + API + '/api/compute/deployments');
      if (row.status === 'running' && row.endpoint) {
        machine.endpoint = row.endpoint;
        machine.expiresAt = row.expiresAt;
        const up = await fetch(row.endpoint.replace(/\/+$/, '') + '/startupz', { signal: AbortSignal.timeout(10_000) }).then((r) => r.status, () => 0);
        if (up === 200) return true;
        say('openclaw starting (it pulls its image and boots in a few minutes)');
      }
    }
    await sleep(10_000);
  }
  return false;
}

async function main() {
  if (command === 'price') {
    const time = timeAsked();
    const { usd, estimate } = await livePrice(PLAN, time);
    const key = process.env.AGENTGATES_COMPUTE_KEY;
    const available = key ? await balanceOf('/api/compute/credits', key) : null;
    console.log(PLAN + ' for ' + (time.hours ? time.hours + ' hour(s)' : time.minutes + ' minutes') + ': ' + (estimate ? 'about ' : '') + '$' + usd.toFixed(3) + ' (read now)');
    if (available !== null) console.log('compute balance available: $' + available.toFixed(3));
    return;
  }

  if (command === 'body') {
    const state = readState();
    const name = String(flags.name || 'openclaw-' + randomBytes(3).toString('hex'));
    const body = createBody(name, timeAsked());
    state.machines.push({ name, deploymentId: null, plan: PLAN, model: MODEL, token: body.env.OPENCLAW_GATEWAY_TOKEN, createdAt: new Date().toISOString(), paidWith: 'x402' });
    writeState(state);
    process.stdout.write(JSON.stringify(body) + '\n');
    console.error('POST this body to ' + API + '/api/compute/deployments with your x402 client; then run: attach ' + name + ' <deploymentId>');
    return;
  }

  if (command === 'attach') {
    const state = readState();
    const m = findMachine(state, rest[0]);
    if (!rest[1]) fail('give the deploymentId the create answered');
    m.deploymentId = rest[1];
    writeState(state);
    console.log('saved ' + m.name + ' as ' + m.deploymentId);
    return;
  }

  if (command === 'start') {
    const key = computeKey();
    inferenceKey();
    const time = timeAsked();
    const name = String(flags.name || 'openclaw-' + randomBytes(3).toString('hex'));
    const state = readState();
    if (state.machines.some((m) => m.name === name)) fail('a machine named "' + name + '" is already in ' + STATE);
    const { usd, estimate } = await livePrice(PLAN, time);
    const available = await balanceOf('/api/compute/credits', key);
    console.log(PLAN + ': ' + (estimate ? 'about ' : '') + '$' + usd.toFixed(3) + ', compute balance $' + (available ?? 0).toFixed(3));
    guard(usd, available);
    const body = createBody(name, time);
    const record = { name, deploymentId: null, plan: PLAN, model: MODEL, token: body.env.OPENCLAW_GATEWAY_TOKEN, createdAt: new Date().toISOString(), paidWith: 'balance' };
    state.machines.push(record);
    writeState(state);
    const made = await call('POST', '/api/compute/deployments', { key, body, timeoutMs: 120_000 });
    if (made.status === 402) {
      state.machines = state.machines.filter((m) => m !== record);
      writeState(state);
      fail('the balance did not cover it (402); nothing was bought');
    }
    if (made.status !== 202 && made.status !== 200) {
      state.machines = state.machines.filter((m) => m !== record);
      writeState(state);
      fail('the create answered ' + made.status + ': ' + (made.json?.error || made.text).toString().slice(0, 300));
    }
    record.deploymentId = made.json.deploymentId;
    record.chargedUsd = made.json.charged?.amountMicro ? Number(made.json.charged.amountMicro) / 1e6 : null;
    writeState(state);
    console.log('bought ' + name + ' (' + record.deploymentId + ')' + (record.chargedUsd !== null ? ' for $' + record.chargedUsd.toFixed(3) : ''));
    if (flags['no-wait']) return;
    const ok = await waitReady(key, record);
    writeState(state);
    if (!ok) fail('not ready yet; run "list" later. If it never answers, its sealed env may be missing: see SKILL.md, "If a machine never answers"');
    console.log('ready: ' + record.endpoint + ' (until ' + record.expiresAt + ')');
    console.log('ask it: node ' + join(HERE, 'openclaw-machine.mjs') + ' ask ' + name + ' "your task"');
    return;
  }

  if (command === 'list') {
    const state = readState();
    const key = process.env.AGENTGATES_COMPUTE_KEY;
    const live = key ? await call('GET', '/api/compute/deployments', { key }) : null;
    const rows = live && live.status === 200 ? live.json.deployments || [] : [];
    for (const m of state.machines) {
      // A create whose answer was lost: the machine carries the name it was bought with.
      const row = rows.find((d) => d.deploymentId === m.deploymentId) || (!m.deploymentId ? rows.find((d) => d.name === m.name) : undefined);
      if (row) { m.deploymentId = row.deploymentId; m.endpoint = row.endpoint || m.endpoint; m.expiresAt = row.expiresAt; }
      console.log([m.name, m.deploymentId || '(not bought yet)', row ? row.status : 'unknown', m.endpoint || '-', 'until ' + (m.expiresAt || '-')].join('  '));
    }
    if (key) writeState(state);
    return;
  }

  if (command === 'ask') {
    const state = readState();
    const m = findMachine(state, rest.shift());
    const message = rest.join(' ').trim();
    if (!message) fail('say what to ask');
    if (!m.endpoint) fail('no endpoint saved yet; run "list"');
    const res = await fetch(m.endpoint.replace(/\/+$/, '') + '/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + m.token, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'openclaw', user: String(flags.session || 'parent'), messages: [{ role: 'user', content: message }] }),
      signal: AbortSignal.timeout(Number(flags['timeout-minutes'] || 10) * 60_000),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    if (res.status !== 200) fail('the machine answered ' + res.status + ': ' + text.slice(0, 300));
    console.log(json?.choices?.[0]?.message?.content ?? text);
    return;
  }

  if (command === 'renew') {
    const key = computeKey();
    const state = readState();
    const m = findMachine(state, rest[0]);
    if (!m.deploymentId) fail('this machine was never bought');
    const time = timeAsked();
    const { usd, estimate } = await livePrice(m.plan || PLAN, time);
    const available = await balanceOf('/api/compute/credits', key);
    console.log('renewal: ' + (estimate ? 'about ' : '') + '$' + usd.toFixed(3) + ' or less, compute balance $' + (available ?? 0).toFixed(3));
    guard(usd, available);
    const r = await call('POST', '/api/compute/deployments/' + encodeURIComponent(m.deploymentId) + '/renew', { key, body: time });
    if (r.status === 402) fail('the balance did not cover the renewal (402); nothing was bought');
    if (r.status !== 200 && r.status !== 202) fail('the renewal answered ' + r.status + ': ' + (r.json?.error || r.text).toString().slice(0, 300));
    m.expiresAt = r.json.expiresAt || m.expiresAt;
    writeState(state);
    console.log('renewed ' + m.name + ' until ' + m.expiresAt);
    return;
  }

  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 20).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  if (command && command !== 'help') process.exit(1);
}

main().catch((err) => fail(err && err.message ? err.message : String(err)));
