# Personal OS

Personal OS is a full-stack application built with TanStack Start, React, TypeScript, Tailwind CSS and Supabase.

The project is independently deployable and no longer depends on Lovable at runtime or build time.

## Stack

- TanStack Start
- React 19
- TypeScript
- Tailwind CSS
- Supabase
- Cloudflare Workers

## Development

Requirements: Node.js 22.15+ and npm.

```sh
git clone https://github.com/riwiswell/pos.git
cd pos
npm install
npm run dev
```

## Environment

Create a local `.env` from the example:

```sh
cp .env.example .env
```

Required values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never commit real credentials. Production values belong in the deployment platform's environment/secrets configuration.

## Build and verification

```sh
npm run build
npm run lint
```

The build runs Vite plus TypeScript checking.

## Cloudflare Workers

The repository includes `vite.config.ts` and `wrangler.jsonc` for the Cloudflare Vite plugin and TanStack Start.

```sh
npm run build
npm run deploy
```

For production, configure the Supabase variables/secrets in Cloudflare before deploying. The Supabase database itself is not changed by the deployment.

## Source migration

The application was migrated from its original Lovable source into GitHub. Lovable-specific preview authentication and error-reporting hooks were removed or replaced with platform-neutral implementations.

The Supabase project and migrations remain part of the application source, but this repository does not contain production secrets.
