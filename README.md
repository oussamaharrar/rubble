# Rubble (Bubble Hunt)

Rubble is a Farcaster Mini App built with Next.js 15 that brings an arcade bubble tapper to Base. It ships with a dynamic Farcaster manifest, Base payment verification endpoint, and production-ready scaffolding for Vercel deployments.

## Tech stack

- [Next.js 15 App Router](https://nextjs.org/) with TypeScript
- Canvas-driven mini game with optional Phaser scene
- Base (via [`viem`](https://viem.sh/)) payment helpers and Coinbase RPC integration
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
| `NEXT_PUBLIC_WEBHOOK_URL` | ✅ | Relative or absolute URL to the payment webhook (defaults to `/api/pay/webhook`). | `/api/pay/webhook` |
| `NEXT_PUBLIC_BASE_RPC_URL` | ✅ | Coinbase Developer Platform RPC for Base (client-safe). | `https://api.developer.coinbase.com/rpc/v1/base/YOUR_KEY` |
| `NEXT_PUBLIC_MIN_PRICE_WEI` | ✅ | Minimum payment amount exposed to the client, in wei. | `1` |
| `NEXT_PUBLIC_PAY_TO_ADDRESS` | ✅ | Public recipient address used to initialise Base payments. | `0xabc123...` |
| `BASE_RPC_URL` | ✅ | Server-side Coinbase Base RPC URL. | `https://api.developer.coinbase.com/rpc/v1/base/YOUR_KEY` |
| `PAY_TO_ADDRESS` | ✅ | Recipient address that must receive the boost payment. | `0xabc123...` |
| `MIN_PRICE_WEI` | ✅ | Server-enforced minimum payment amount in wei. | `1` |
| `USD_WEI_EXCHANGE_RATE` | ➖ | Optional override for the USD→wei conversion rate (1 USD in wei). | `333333333333333` |
| `PRICE_WEI_BOOST` | ➖ | Optional explicit wei price for Boost purchases (capped at $0.02). | `6000000000000` |
| `PRICE_WEI_COMBO` | ➖ | Optional explicit wei price for Extra Combo purchases (capped at $0.01). | `3000000000000` |
| `PRICE_WEI_RETRY` | ➖ | Optional explicit wei price for Retry/Extra Life purchases (capped at $0.05). | `16000000000000` |
| `FARCASTER_ACCOUNT_HEADER` | ➖ | Optional Farcaster account association header. | `...` |
| `FARCASTER_ACCOUNT_PAYLOAD` | ➖ | Optional Farcaster account association payload. | `...` |
| `FARCASTER_ACCOUNT_SIGNATURE` | ➖ | Optional Farcaster account association signature. | `...` |
| `PAYMENTS_API_BASE` | ➖ | Coinbase Commerce/OnchainKit base URL (enables Mode B when set with credentials). | `https://api.commerce.coinbase.com` |
| `PAYMENTS_API_KEY_ID` | ➖ | Commerce/OnchainKit API key identifier. | `commerce-key-id` |
| `PAYMENTS_API_SECRET` | ➖ | Commerce/OnchainKit API secret. | `commerce-secret` |
| `PAYMENTS_WEBHOOK_SECRET` | ➖ | Secret for verifying Commerce/OnchainKit webhooks. | `webhook-secret` |
| `BASE_PAY_MOCK` | ➖ | `1` to bypass remote calls during local development. | `0` |
| `BASE_BUILDER_OWNER_ADDRESS` | ➖ | Address included in the Farcaster Base Builder manifest section. | `0xabc123...` |

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

- `POST /api/pay/session` returns either a native Base transfer intent (Mode A) or a Coinbase Commerce/OnchainKit session payload (Mode B) depending on which environment variables are configured.
- `POST /api/pay/webhook` validates Coinbase Commerce/OnchainKit webhook signatures in Mode B and marks boost sessions as granted once paid on Base Mainnet (chain `8453`).
- `GET /api/pay/status?sessionId=` polls in-memory boost grants to let the client unlock boosters without reloading.

Extend these handlers to back your own persistence layer, Farcaster identity checks, or advanced pricing logic once you connect additional infrastructure.
