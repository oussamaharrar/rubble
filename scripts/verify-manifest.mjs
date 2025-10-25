import fs from 'node:fs';
import assert from 'node:assert';

const manifestModulePath = '.next/server/app/.well-known/farcaster.json/route.js';
if (!fs.existsSync(manifestModulePath)) {
  throw new Error(`Manifest module not found at ${manifestModulePath}`);
}

const source = fs.readFileSync(manifestModulePath, 'utf8');

const requiredSnippets = [
  'miniapp:{name:"Rubble (Bubble Hunt)"',
  'miniapp:{name:"Rubble (Bubble Hunt)",description:"Tap bubbles, chain combos, and trigger Base-powered boosts."',
  'requestedCapabilities:["wallet","base-pay"]',
  'accountAssociation:{header:',
  'baseBuilder:{ownerAddress:',
  'recipientAddress:E.K.PAY_TO_ADDRESS',
];

for (const snippet of requiredSnippets) {
  assert.ok(
    source.includes(snippet),
    `Manifest bundle missing snippet: ${snippet}`,
  );
}

console.log('manifest ok');
