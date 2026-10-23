# n8n Customer Portal prototype

[Open the prototype](https://jvanderpoll.github.io/n8n-customer-portal-v1/)

The home page opens the Overview screen. All data is synthetic; prototype personas are held in memory and reset on refresh. Contact actions only create local drafts.

## Development

Install Node.js 24 and Bun 1.4.4, then run:

```sh
bun install --frozen-lockfile
bun run dev
```

## GitHub Pages

The `pages.yml` workflow tests and builds on pull requests, and publishes `dist/client` on pushes to `main`. Repository Settings → Pages → Source must be **GitHub Actions**.

```sh
bun run test
bun run build:pages
```

The Pages build uses `/n8n-customer-portal-v1/` as its asset and router base. It prerenders every static file route into an `index.html`, so opening or refreshing section links works without a server. Screens with URL filters render their content in the browser to avoid showing an unfiltered snapshot on refresh. Only `dist/client` is uploaded. Lovable's normal `dev` and `build` commands keep their existing server configuration.

GitHub Pages previously published the raw `main` branch with Jekyll, which displayed the old README instead of building the app. The README is documentation, not an app landing screen.
