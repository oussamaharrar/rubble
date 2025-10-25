# Rubble (Bubble Hunt)

Rubble is a Farcaster Mini App built with Next.js 15 that brings an arcade bubble tapper to Base. It ships with a dynamic Farcaster manifest, Base payment verification endpoint, and production-ready scaffolding for Vercel deployments.

## Tech stack

- [Next.js 15 App Router](https://nextjs.org/) with TypeScript
- Canvas-driven mini game with optional Phaser scene
- Base (via [`viem`](https://viem.sh/)) payment verification
- Farcaster Mini App metadata and manifest endpoints
- pnpm + Node.js 20 (required by Vercel build)

## Getting started

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` to load the mini app shell. Touch/click the bubbles to rack up combos and use the Boost button to simulate Base payments.

### Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server. |
| `pnpm build` | Create a production build. Runs `scripts/postbuild.js` after compilation. |
| `pnpm start` | Serve the production build. |
| `pnpm verify:manifest` | Verify the built Farcaster manifest in `.next`. |

## Environment variables

Create a `.env.local` (and mirror it to `.env.example`) with the following values:

| Name | Required | Description | Example |
| --- | :---: | --- | --- |
| `NEXT_PUBLIC_URL` | ✅ | Public base URL for the deployed mini app. | `https://rubble.example.com` |
| `NEXT_PUBLIC_WEBHOOK_URL` | ✅ | Public URL that the client calls for payment verification (usually `/api/pay/verify`). | `https://rubble.example.com/api/pay/verify` |
| `BASE_RPC_URL` | ✅ | Base RPC endpoint used for verifying transactions. | `https://mainnet.base.org` |
| `PAY_TO_ADDRESS` | ✅ | Recipient address that must receive the payment. | `0xabc123...` |
| `MIN_PRICE_WEI` | ✅ | Minimum accepted payment amount in wei. | `1000000000000` |
| `NEXT_PUBLIC_PAY_TO_ADDRESS` | ➖ | Optional. Overrides the client-exposed payment address (defaults to `PAY_TO_ADDRESS`). | `0xabc123...` |
| `NEXT_PUBLIC_MIN_PRICE_WEI` | ➖ | Optional. Overrides the client-exposed minimum amount (defaults to `MIN_PRICE_WEI`). | `1000000000000` |

After updating `.env.local`, run `pnpm dev` or restart the dev server to propagate changes.

## Vercel deployment

1. Push this repository to your own GitHub project and import it into Vercel.
2. In Vercel project settings, set **Node.js Version** to `20.x` (also enforced via `package.json` > `engines`).
3. Add the environment variables above to the **Production** and **Preview** environments.
4. Deploy. Once `next build` finishes, the postbuild script runs and the manifest becomes available at `https://your-domain/.well-known/farcaster.json`.
5. Run `pnpm verify:manifest` locally or in CI to validate the generated manifest before publishing the deployment URL to Farcaster.

## Manifest + Farcaster checks

- `/.well-known/farcaster.json` is generated using validated environment variables.
- `app/page.tsx` includes Farcaster embed metadata for the primary CTA.
- Placeholder icons live in `public/game-icons/` and are referenced by the manifest and Open Graph tags.
- `scripts/verify-manifest.mjs` provides a quick sanity check after builds.

## Base payments

The `POST /api/pay/verify` endpoint confirms the transaction succeeded on Base, the recipient matches `PAY_TO_ADDRESS`, and the paid amount meets or exceeds `MIN_PRICE_WEI`. Extend this handler to associate transactions with sessions, Farcaster identities, or Base Pay receipts as you integrate wallets.
