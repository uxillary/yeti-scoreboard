# Yeti Scoreboard

This project includes a Cloudflare Worker for managing scoreboard data.

## Configuration

Set up environment variables in `wrangler.toml`:

- `ALLOWED_ORIGIN`
- `ADMIN_SECRET`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH`

`GITHUB_TOKEN` should be stored as a secret:

```sh
npx wrangler secret put GITHUB_TOKEN
```

## Deploying

Publish the Worker to Cloudflare:

```sh
npx wrangler publish
```
