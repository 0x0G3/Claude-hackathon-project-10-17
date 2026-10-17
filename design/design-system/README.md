Illumination Health + Home (IHH) is an Orange County nonprofit that builds the bridge between survival and stability: recuperative care, emergency and supportive housing, family programs, and integrated healthcare. This system extends illuminationhealthhome.org into tools for people looking for help. **Clarity and calm come before flourish.** Keep GET HELP one tap away on every screen.

## Brand essence

- Core idea: *We build the bridge between survival and stability.*
- Personality: warm, hopeful, grounded, dignified, plain-spoken. Human-first, never institutional. Confident without being clinical. It never pities.
- Keywords: full-circle care · survival → stability · meet people where they are · walk with them · healing · light · home · dignity.

## Voice and copy

- Write short, declarative sentences. Fragments are fine: “Real people. Real recovery. Lasting change.”
- Use contrast pairs: survival → stability, crisis → stability, symptoms → the whole person, “lift people up—not push them through.”
- Say “we” and “people” in headlines, not “clients” or “beneficiaries.” Em dashes are part of the voice.
- CTAs are verbs in caps: GET HELP, GIVE NOW, VOLUNTEER, DONATE, LEARN MORE, MORE STORIES, SEE THE REPORT, JOIN.
- The help path is always visible: the `UtilityBar` carries crisis info and a link to OC 2-1-1 at the top of every page.
- Quotes use curly quotes (“ ”) and an uppercase NAME | ROLE attribution.
- No emoji. No exclamation-point urgency. No pity framing (“the less fortunate,” “victims”).

## Color

| Token | Use it for |
|---|---|
| `yellow` (`accent`) | CTA fills, the utility bar, Housing card, story-card footers, newsletter band. Text on it is always `navy` (`on-accent`). |
| `indigo` (`primary`) | Healthcare card, ticker band, outline buttons on indigo. Text on it is `white` (`on-primary`). |
| `navy` (`text`, `dark`) | All text and headings on light grounds; the header bar; GET HELP. |
| `sand` (`bg-soft`) | Rest areas: testimonial sections, alternating sections. |
| `white` (`bg`) | Page background; text on navy, indigo and scrimmed photos. |
| `charcoal` (`text-muted`) | Secondary copy on white or sand. |

- **Proportion:** mostly `white` and `navy`; `yellow` used boldly but in blocks; `indigo` as the second block; `sand` for rest.
- **Contrast pairs that pass:** navy/white 15.3 · navy/yellow 9.95 · navy/sand 12.3 · white/indigo 13.0 · yellow/navy 9.95 · yellow/indigo 8.5.
- **Never** set `yellow` text on `white` (1.53:1). The live site does this in its footer column headings and social icons; this system sets those in `navy` instead.
- **Never** set white text on `yellow`.
- `yellow` as text appears only on `navy`, `indigo` or a `scrim`med photo, as `highlight-on-dark`.
- `logo-indigo` exists only inside the light-ground logo file. Do not use it in UI.
- No gradients anywhere.

## Typography

- **Display** (`display`, `h2`, `h3`, `stat`) is IvyPresto Display 700 on the live site, an Adobe Fonts face that needs a license. This system ships **Playfair Display 700** as the stand-in; the `--font-display` stack picks up IvyPresto automatically where the Typekit kit is loaded.
- **Quote** (`quote`, `quote-sm`) is Playfair Display 900, navy on sand.
- **Text** (`body`, `body-strong`, `card-title`, `label-lg`, `eyebrow`, `button`, `nav`) is Archivo. `eyebrow`, `button`, `nav` and `label-lg` are uppercase; `eyebrow` adds 1px tracking.
- Pairing: an editorial serif for emotion (headlines, quotes, numbers), a sturdy grotesque for everything functional.
- **Signature headline move:** a serif headline with **one** highlighted phrase (1–2 words) in `highlight-on-dark`, e.g. “between *survival* and *stability*.” Only on navy, indigo or a scrimmed photo. On light grounds the headline stays all navy.
- Body copy runs at `body` 16px/1.8; keep measure near 65 characters, centered intro copy capped at `text-max`.

## Shape, space, elevation

- `radius` is 0 for every button, card, image and input. The one source exception is the round outline arrow buttons on carousels.
- `shadow` is none. Depth comes from color blocks and photo scrims.
- Borders are `border-thin` or `border-thick`, solid, in navy or white.
- Layout: `content-max` 1200px with a `gutter` of 20px; centered intro copy at `text-max` 800px.
- Sections breathe: `section-y` 70px, the hero up to `hero-top` 190px. Alternate white and sand sections, with full-bleed photo sections between.
- Cards pad `card-pad-y` × `card-pad-x` (40 × 30px).
- Focus: a 2px solid outline offset 2px, `focus-ring` (navy) on light and yellow grounds, `focus-ring-on-dark` (yellow) on navy, indigo and photos. This is an addition; the live site shows no designed focus state.

## Imagery

- Authentic photography of real clients, families, staff and caregivers. No stock setups.
- Warm, natural Southern California daylight; people smiling, embracing, being cared for.
- Photos are full-bleed and square-cornered. Any photo with text on it gets the `scrim` (50% black).
- Component previews use a labelled photo slot in place of real photography; swap in IHH's own images.

## Iconography

- Line-weight, simple glyphs: left/right arrows, social glyphs. The arrow is a thin stroked → in `yellow` on dark grounds and `navy` on yellow.
- The sun mark (`IHH-Logo-Yellow.svg`) is the only decorative motif: section ornament above quotes, and the ☀ in the `TickerBand`.
- The arrow glyph in the previews is a plain redraw (two strokes); IHH's own icon files and social glyphs were not in the packet. Social links are set as text until the brand's icon files are added.

## Logos

- `IHH-Logo-Full.svg`: yellow mark, white wordmark. Dark and photo grounds (header).
- `IHH-Logo-Variant-2.svg`: yellow mark, indigo wordmark. Light grounds (footer).
- `IHH-Logo-Yellow.svg`: the mark alone; ornament and ticker.
- `IHH-Logo-Yellow-Squared.svg`: the mark on a square canvas; favicon and app icon.
- Never recolor, outline or redraw the mark.

## Components

Components are plain HTML + CSS: load `components/bundle.css` after `tokens.css` and use the `ihh-` classes shown in each component's preview. No JavaScript bundle.

- Actions: `Button`
- Navigation: `UtilityBar`, `Header`, `Footer`
- Sections: `Hero`, `Testimonial`, `TickerBand`, `ImpactStats`
- Cards: `ServiceCard`, `StoryCard`
- Forms: `TextInput`, `NewsletterBand`

## Do / Don't

**Do:** keep corners square · put navy text on yellow · highlight 1–2 words per headline in yellow on dark · use real photos with a scrim · keep GET HELP one tap away.

**Don't:** rounded pill buttons · drop shadows · gradients · yellow text on white · white text on yellow · more than one highlighted phrase per headline · a clinical blue-and-white “hospital” look.
