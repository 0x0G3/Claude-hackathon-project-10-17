# Next Door · design package

Design for Challenge 2, “Finding the right resource”, at the OC Claude Impact Lab with Illumination Health + Home (IHH), Oct 17, 2026. Design lead: Freddie Jiang.

**Start with [HANDOFF.md](HANDOFF.md).** It covers what we're building, why it looks this way, every screen, the design rules, the behavior specs, the build checklist and the open questions for IHH.

## What's in this folder

| Path | What it is | How to view it |
|---|---|---|
| [`HANDOFF.md`](HANDOFF.md) | The team handoff: rationale, specs, checklist | Read on GitHub, or open the [live doc](https://claude.ai/code/artifact/049a41ec-61d5-467d-8e23-bf30e8efee21) |
| [`canvases/client/`](canvases/client/) | Client screens: phone (1–8), desktop (D0–D5), accessible phone (A0–A5) | Clickable in the [client canvas](https://claude.ai/artifact/D12oCwqgqXQFxBLFng1HB6) |
| [`canvases/case-manager/`](canvases/case-manager/) | Staff screens: Today dashboard, Review a plan, Safety steps, Framework, Leadership gaps report | Clickable in the [case manager canvas](https://claude.ai/artifact/FedmJPdtSPrqV7yHjRmuK8) (private until shared) |
| [`prototype/`](prototype/) | Working single-file prototype with matching logic over the seed data, in an older layout | Open `prototype/index.html` in a browser, or the [hosted copy](https://claude.ai/artifact/6e9rmaygmHsUphwsFwhLWG) |
| [`design-system/`](design-system/) | IHH tokens, component CSS and style-free logos | Source: [IHH design system](https://claude.ai/artifact/3Cumbrc9HGPghRQJECv1HX) |
| [`img/`](img/) | Client flow diagram and screenshots of the prototype | Any image viewer |

## Notes for developers

- **The canvas files are source, not standalone pages.** Each `*.dc.html` loads `./support.js` from the canvas runtime and uses `{{holes}}`, `<sc-for>` and `<sc-if>`, with logic in `class Component extends DCLogic { renderVals() }`. Opened directly from disk, they render unstyled and without data. Use them for exact copy, colors, sizes and layout, and click through them in the canvases.
- **Board order and titles** are in each folder's `canvas.json` (`boards`, `pages`, `order`).
- **Logos.** The `/_blob/…` image paths in the canvases point to IHH logos uploaded to the canvas. Use `design-system/logos/` in the app: `ihh-logo-full.svg` on navy, `ihh-logo-light.svg` on white, `ihh-mark.svg` for small spaces.
- **Fonts.** Playfair Display 700/900 and Archivo 400–700, from Google Fonts.
- **Data.** Screens use the seed listings in [`../2-finding-the-right-resource/data/`](../2-finding-the-right-resource/data/) and the 12 made-up scenarios in [`../2-finding-the-right-resource/scenarios/`](../2-finding-the-right-resource/scenarios/). No real client data.
- **Known prototype bug.** The older prototype ranks WISEPlace (women only) as Ray's backup. The canvases use 211 OC and Coordinated Entry instead. The fit rules in HANDOFF.md (service area, city ties, age, population) are the ones to build in `web/src/lib/matching/engine.ts`.
