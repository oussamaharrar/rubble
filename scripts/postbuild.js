const { execSync } = require('node:child_process');
const fs = require('node:fs');

console.log('Running postbuild checks...');
execSync('node ./scripts/verify-manifest.mjs', { stdio: 'inherit' });

const expectedRoutes = [
  '.next/server/app/api/pay/session/route.js',
  '.next/server/app/api/pay/webhook/route.js',
  '.next/server/app/api/pay/status/route.js',
];

for (const route of expectedRoutes) {
  if (!fs.existsSync(route)) {
    throw new Error(`Missing built API route at ${route}`);
  }
}

console.log('postbuild checks completed');
