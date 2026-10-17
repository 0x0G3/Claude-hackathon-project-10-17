This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Design system (IHH)

The app uses the IHH design system from [`../design/`](../design/). The rules are in [`../design/HANDOFF.md`](../design/HANDOFF.md). Run `npm run dev` and open [`/styleguide`](http://localhost:3000/styleguide) to see every token and component.

- **Tokens** live in `src/app/globals.css`, with Tailwind utilities for each: `bg-yellow`, `bg-navy`, `bg-indigo`, `bg-sand`, `text-charcoal`, plus the roles `bg-accent`, `text-on-accent`, `bg-dark`, `bg-soft`, `text-muted`, and `font-display` / `font-sans`.
- **Components** live in `src/components/ui`:
  - `Button` (`variant` primary, secondary or link; `size` sm, md, lg or xl; `arrow`; `block`; `href`)
  - `TopBar` and `HelpStrip`
  - `ConfidenceMark` and `NotStated`
  - `Eyebrow` and `SectionLabel`
- **CSS classes** for markup without a component: `.btn`, `.panel`, `.panel-soft`, `.tag`, `.mark-high`, `.mark-medium`, `.mark-low`, `.eyebrow`, `.question`, `.phone-number`. Wrap navy blocks in `.on-dark` so focus rings and buttons switch to their on-navy versions.
- **Fonts** are Archivo and Playfair Display, self-hosted from `src/app/fonts/` (OFL) through `next/font/local`, so builds don't depend on Google Fonts. Only the Latin subsets are included, so Vietnamese, Korean, Chinese, Farsi, Arabic, Russian and Khmer text falls back to system fonts.
- **Rules:** one primary (yellow) button per screen. Square corners, no shadows, no gradients, no emoji. Don't use Tailwind's default palette (slate, blue, emerald) in anything that ships.

## How the architecture maps to code

Each component in [`../docs/architecture/ARCHITECTURE.md`](../docs/architecture/ARCHITECTURE.md) has one home. Plain code decides; Claude only explains and phrases.

| Component | Where | Kind |
|---|---|---|
| Intake form | `src/components/session/IntakeForm.tsx` | UI |
| Safety gate | `src/lib/safety/gate.ts` | Code |
| Prerequisite check | `src/lib/prereqs/graph.ts` | Code |
| Directory + warnings + "I called" overlay | `src/lib/resources/loader.ts`, `src/data/verifications.json` | Code / data |
| Structured eligibility (drafts, need review) | `src/data/eligibility-rules.json` | Data |
| Matcher | `src/lib/matching/engine.ts` | Code |
| Gap register + travel checklist | `src/data/gap-register.json`, `src/lib/gaps/register.ts` | Data / code |
| Planner, Writer | `src/lib/ai/planner.ts`, `src/lib/ai/writer.ts` | Claude, with a rules fallback |
| Fact checker | `src/lib/factcheck/checker.ts` | Code |
| Session runner | `src/lib/session/run.ts`, `POST /api/session` | Code |
| Review screen + take-home plan | `src/app/page.tsx`, `src/components/session/` | UI |
| Re-check a listing (Fetcher → Extractor → Verifier) | `src/lib/offline/`, `POST /api/recheck` | Code + Claude |

- **Claude is off by default.** Tick "Use Claude" on the intake form and set `ANTHROPIC_API_KEY` in `.env.local`. Without a key, the rules planner and template writer produce the plan, in English and Spanish.
- **Scenarios** C01–C12 are structured in `src/data/scenario-profiles.json`. `npm test` runs all 12 through the whole path; a scenario fails if any phone number, address or hour appears that is not in the directory.
- **Eligibility rules are drafts.** Every rule quotes its source (`basis`), and a test checks each quote is verbatim. A person must review each one before it is marked `approved`.
- **Re-check snapshots** are saved to `.snapshots/` (git-ignored). Approved changes are logged in the verification overlay; the seed file is never rewritten.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
