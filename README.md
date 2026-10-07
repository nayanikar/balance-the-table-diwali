# Balance the Table

A three-step Diwali potluck RSVP: **RSVP** → **balance the table** (savoury vs sweet) → **event details** with allergies and an edit link.

Built with vanilla Web Components, a Google Sheets + Apps Script backend (v2), and a local mock API for development.

## Quick start

```bash
npm install
npm run dev:all
```

Open [http://127.0.0.1:3456/index.html?_seed=empty](http://127.0.0.1:3456/index.html?_seed=empty)

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/BUILT-SOFAR.md](docs/BUILT-SOFAR.md) | What's implemented and working |
| [docs/BACKEND-PLAN.md](docs/BACKEND-PLAN.md) | API contract, scenarios, build order |
| [docs/GO-LIVE.md](docs/GO-LIVE.md) | Deploy checklist |
| [backend/README.md](backend/README.md) | Google Sheet + Apps Script setup |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev:all` | Static site (3456) + mock API (8787) |
| `npm run build` | Embed bundles in `dist/` |
| `npm run test:e2e` | Playwright smoke test |
| `npm test` | Playwright scenarios vs mock |

## License

Private / event use — adjust as needed for your deployment.
