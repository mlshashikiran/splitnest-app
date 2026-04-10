# SplitNest

SplitNest is a local-first Android-friendly household expense splitter built as a React + Vite PWA. It covers the first MVP slice from the PRD:

- Create a house group with tenants and owner
- Add shared expenses
- Auto-split equally among current members
- Track net balances
- Record settlements
- Review expense history and monthly summaries

## Why this stack

- Works well as an installable Android web app
- Hosts for free on Cloudflare Pages
- Runs offline with local storage and a lightweight service worker
- Leaves room to add sync later with Cloudflare D1, Firebase, or Supabase

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Free hosting on Cloudflare Pages

1. Push `splitnest-app` to GitHub.
2. In Cloudflare Pages, create a new project from that repo.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Deploy.

## Suggested next steps

- Add authentication and sync for multi-device households
- Add custom split ratios and exclude/include toggles per expense
- Export monthly summaries as PDF or shareable links
- Add reminders and payment status tracking
