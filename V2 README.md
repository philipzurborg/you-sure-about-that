# Handoff: You Sure About That? — Visual Overhaul

## Overview
A nostalgic-but-restrained refresh of the daily trivia game. Keeps the existing
Next.js app's logic, state machine, and three-phase flow (wager → question → result)
entirely intact — this is a **visual + typographic** overhaul, not a behavioral one.

The redesign leans into early-2000s web personality (.com era — Ask Jeeves /
early Yahoo!) while staying readable and modern. The brand stays anchored on
**dark mode + Giants orange (#FD5A1E)**, with cream/parchment surfaces layered
in for the "paper" elements (inputs, the question card, beveled buttons).

## About the Design Files
The files in this bundle are **design references created in HTML** — a working
React+Babel prototype showing intended look and behavior, not production code to
copy directly. The task is to **recreate these designs inside the existing
Next.js codebase** (`app/page.js`) using its established patterns: keep the
inline-style `S` object pattern (or migrate to CSS Modules — your call) and the
existing component structure (`App`, `WagerPhase`, `QuestionPhase`,
`InterResultPhase`, `ResultPhase`, `RulesModal`, `Stat`).

**Critically: do not replace the existing game logic.** All localStorage
schemas, `/api/question` and `/api/validate` calls, day-budget tracking,
streak/missed-day handling, sharing, and onboarding flow stay exactly as they
are in `app/page.js`. Only the visual layer changes.

## Fidelity
**High-fidelity.** All colors, typography, spacing, border-radii, shadows, and
animation values are final and should be matched exactly. Hex values, font
sizes, and easing curves are all listed below.

## Stack notes
- Existing app is **Next.js (App Router)**, React client component, fonts loaded
  via `next/font/google`. Continue using `next/font` for the new typefaces — do
  not import via `<link>` or `@import url()` in production code.
- Existing styles live as **inline JS objects** (`const S = {...}`) inside
  `app/page.js`, with one big `<style>{css}</style>` block for keyframes and
  pseudo-classes. You can either continue this pattern or migrate to a
  `page.module.css` — both are fine.

---

## Design Tokens

### Colors
```css
/* Brand */
--giants:       #FD5A1E;   /* Primary orange — SF Giants */
--giants-2:     #FF8A50;   /* Lighter highlight (bevel inset, gradient stop) */
--giants-deep:  #C73E12;   /* Deep shadow, text-shadow, button outset bottom */
--giants-shadow: rgba(253,90,30,0.4);  /* Glow */

/* Dark base */
--bg:        #0d0c0a;      /* Page background */
--bg-2:      #14110d;      /* Card gradient bottom */
--surface:   #1c1813;      /* Card top */
--surface-2: #25201a;      /* Slightly raised inner panel */
--border:        rgba(247,231,201,0.10);
--border-strong: rgba(247,231,201,0.18);

/* Cream / parchment (paper surfaces) */
--cream:        #f7e7c9;   /* Primary paper fill — input bg, question card */
--cream-2:      #ebd9b6;
--cream-deep:   #d8c195;   /* Bevel outset bottom-right on cream surfaces */
--cream-ink:    #3a2a14;   /* Text on cream */
--cream-paper:  #f3e2c1;

/* Text */
--text:     #f7e7c9;
--text-dim: rgba(247,231,201,0.62);
--muted:    rgba(247,231,201,0.42);

/* Semantic */
--ink-green:  #6fb84f;     /* Correct */
--ink-red:    #e54e3a;     /* Incorrect */
--ink-amber:  #f5a523;     /* Timer warning (≤10s) */
--ink-purple: #a47fd6;     /* Time-out */
```

### Typography
Three font families, each with a **specific job**. Do not deploy Caveat (the
hand-drawn script) anywhere not listed below.

```css
--display: 'Bebas Neue', sans-serif;            /* Wordmark, category names, big numbers, banner labels */
--hand:    'Caveat', cursive;                   /* RESTRICTED USE — see below */
--body:    'DM Sans', system-ui, sans-serif;    /* Everything else */
```

**Caveat (hand) is allowed in only three places:**
1. The day-number badge in the header (`№ 247`)
2. The streak bubble (`★ 7 day streak`)
3. The timer's "seconds left!" caption beside the countdown digit

Anywhere the prototype previously used a `caveat` class for eyebrow/label text,
those have been migrated to small-caps DM Sans (uppercase, letter-spacing
0.14em-0.18em, color `--text-dim`).

### Type scale
| Use | Family | Size | Weight | Letter-spacing | Transform |
|---|---|---|---|---|---|
| Wordmark `?` (hero) | Bebas Neue | 1em (scaled by parent fontSize) | 400 | 0 | — |
| Wordmark words | Bebas Neue | 0.42em (relative) | 400 | 0.04em | — |
| Category title (Wager phase) | Bebas Neue | 44px | 400 | 0.04em | uppercase |
| Up-next category | Bebas Neue | 36px | 400 | 0.04em | uppercase |
| Question-box category | Bebas Neue | 22px | 400 | 0.06em | uppercase |
| Result breakdown category | Bebas Neue | 16px | 400 | 0.06em | uppercase |
| Banner label (CORRECT / INCORRECT / TIME EXPIRED) | Bebas Neue | 26px | 400 | 0.06em | — |
| Banner icon (✓ / ✗ / ⌛ / ★ / ◐) | Bebas Neue | 32px | 400 | — | — |
| Points value | Bebas Neue | 30px | 400 | 0.01em | — |
| Final-points (big stat) | Bebas Neue | 38px | 400 | 0.02em | — |
| Other stat values | Bebas Neue | 20px | 400 | 0.02em | — |
| Timer count | Bebas Neue | 56px | 400 | 0.02em | — |
| Day badge `№ 247` | Caveat | 18px | 700 | 0.02em | — |
| Streak bubble num | Bebas Neue | 22px | 400 | — | — |
| Streak bubble word | DM Sans | 13px | — | 0.02em | — |
| Streak bubble flame ★ | Caveat (inherited) | 16px | 700 | — | — |
| "seconds left!" caption | Caveat | 18px | 700 | — | — |
| Eyebrow labels (BUDGET / NEW TOTAL / etc.) | DM Sans | 10–11px | 600 | 0.14–0.18em | uppercase |
| Body / question text | DM Sans | 17px | 500 | normal | — |
| Phase tag (★ QUESTION 1 OF 3 ★) | Bebas Neue | 13px | 400 | 0.18em | uppercase |
| Buttons primary CTA | Bebas Neue | 22px | 400 | 0.04em | — |
| Preset button label | Bebas Neue | 18px | 400 | 0.04em | — |
| Footer | DM Sans | 11px | 500 | 0.12em | uppercase |

### Spacing & radii
- Card padding: `24px 22px`
- Card radius: `18px` (main card), `14px` (inner question box / inputs), `12px` (small panels), `10px` (presets / breakdown rows)
- Card gap (between sections): `20px`
- Container max-width: `480px`
- Outer page padding: `24px 16px 64px`

### Shadows (the bevel system)
The defining device of the redesign is **chunky beveled buttons + inputs**.
Every interactive surface uses one of two shadow stacks:

```css
/* Cream-colored beveled surface (inputs, preset buttons, info button) */
box-shadow:
  inset -3px -3px 0 var(--cream-deep),  /* dark inset bottom-right */
  inset  3px  3px 0 #fff,                /* light inset top-left */
  0 4px 0 #000;                          /* hard outset bottom */

/* Orange beveled primary CTA (Lock it in, Submit answer, etc.) */
box-shadow:
  inset -4px -4px 0 var(--giants-deep),
  inset  4px  4px 0 var(--giants-2),
  0 6px 0 #000,
  0 8px 24px rgba(253,90,30,0.25);  /* glow */
```

On `:active`, swap the inset directions and reduce the outset to 1px while
translating the element down — gives a "depressed" feel:

```css
.bevel-btn:active {
  transform: translateY(5px);
  box-shadow:
    inset 4px 4px 0 var(--giants-deep),
    inset -4px -4px 0 var(--giants-2),
    0 1px 0 #000;
}
```

### Borders
Use **dashed borders** (1px or 1.5px) for "paper-clipped"/casual containers
like the budget row, the streak bubble, the rules note, the day badge.
Use solid borders only on inputs and the dark surface borders.

---

## Screens / Views

### 1. Header (always visible)
**Layout:** Two rows, `gap: 12px`.

**Top row** — flex row, `space-between`:
- **Day badge** (left): `№ 247` in Caveat 18px/700, bg `--surface`, dashed
  border, border-radius 999px, padding `4px 12px`, **rotated `-2deg`**.
- **Wordmark** (center): see Wordmark section below. Render at `size={0.62}`
  in the header.
- **Info button** (right): 38×38 circle, cream fill, big `?` glyph in
  Bebas Neue 22px, full bevel shadow stack, `border: 2px solid var(--cream-deep)`.
  Hover: rotate 8deg + scale 1.08.

**Bottom row** — points bar:
- Container: gradient bg from `--surface` to `--bg-2`, border-radius 14px,
  padding `12px 18px`. Subtle 45° striped overlay via `::before`.
- Left: small uppercase "YOUR POINTS" label (DM Sans 10/600, letter-spacing
  0.16em) above big orange Bebas Neue 30px value. Text-shadow `1px 1px 0
  --giants-deep`.
- Right: streak bubble — `display: flex; gap: 4px`, dashed orange border,
  `rotate(2deg)`, contains: `★` (Caveat-rendered), Bebas Neue number, DM Sans
  "day streak" label.

### 2. Progress dots (between header and main card, Wager/Question/Inter only)
Three 30×30 circles, gap 14px, centered. Each contains its number (1/2/3) in
Bebas Neue 14px.
- **Future** dot: `--surface` bg, dashed border, dim text.
- **Current** dot: orange fill, cream border, +scale 1.12, animated outer
  glow ring (`dot-pulse`, 1.6s ease-in-out infinite).
- **Correct/Wrong/Timeout** dot: green/red/purple fill respectively, dark text.

### 3. Wager phase
**Phase tag** at top: `★ QUESTION 1 OF 3 — PLACE YOUR WAGER ★`, dashed
top+bottom border, Bebas Neue 13px, color `--giants` with text-shadow.

**Category reveal:**
- Eyebrow: `CATEGORY 1` in DM Sans 11/600 uppercase, letter-spacing 0.18em,
  color `--text-dim`.
- Name: in Bebas Neue 44px, color `--giants`, uppercase, no text-shadow
  (we toned it down). Animated with `pop-in`.

**Budget row** (only if questionIndex > 0): dashed-bordered row showing
`BUDGET REMAINING` (small caps) and value in Bebas Neue 20px orange.

**Wager input:** Cream-filled bevel pill, max-width 280px. Star prefix `★`
in Bebas Neue/giants-deep. Big input centered, Bebas Neue 36px in
giants-deep. Suffix `pts` smaller and dimmed.

**Slider:** 8px tall track, dark recessed (`inset 0 1px 2px rgba(0,0,0,0.4)`).
Fill is a giants-deep → giants → giants-2 gradient with a soft glow.

**Presets:** 3-column grid, gap 10px. Each is a cream beveled button stacking
label (Bebas Neue 18px in giants-deep) over value (Bebas Neue 14px in
cream-ink). The "10% / 50% / MAX" badges that used to sit at top-right have
been removed — labels alone carry the meaning.

**Primary CTA:** "Lock it in →" — orange beveled button (full shadow stack).

### 4. Question phase
**Phase tag:** `★ QUESTION 1 OF 3 — ANSWER THE QUESTION ★`. (Earlier
iterations had a side-scrolling marquee version; that has been removed.)

**Wager-locked row:** Dashed-border centered pill: `YOU WAGERED` (small
caps) + `1,250 pts` (Bebas Neue 22px orange).

**Timer block:**
- Big count (Bebas Neue 56px) + "seconds left!" caption in **Caveat 18px**
  (this is one of the only three places Caveat appears).
- 10px-tall track with width-animated fill. Color shifts at thresholds:
  `--giants` (>10s) → `--ink-amber` (≤10s) → `--ink-red` (≤5s).
- At ≤10s the digit pulses with `timer-shake` (0.5s ease-in-out infinite,
  rotating ±3deg).

**Question box:** Cream surface, 14px radius, padding `18px 20px 20px`.
**No ruled lines, no margin dot — clean cream rectangle** (we removed the
index-card skeuomorphism). Contains:
- Category in Bebas Neue 22px uppercase, color `--giants-deep`,
  letter-spacing 0.06em.
- Question text in DM Sans 17/500, color `--cream-ink`, line-height 1.55.

**Answer input:** Cream beveled wrap, "A." prefix in Bebas Neue 22px
(`--giants-deep`), then large input. Italic placeholder.

**Submit button:** Orange beveled CTA. While checking, button shows rotating
`Checking… / Normalizing… / Analyzing… / AI verifying…` text with animated
ellipsis dots.

### 5. Inter-result modal (after each question)
Modal overlay (78% black + 4px backdrop blur), bottom-anchored panel that
slides up.

**Banner** — full-width pill in green / red / purple by outcome, with hard
inset bevel + drop shadow. Contains big icon + label:
- ✓ + **CORRECT**
- ✗ + **INCORRECT**
- ⌛ + **TIME EXPIRED**

(Earlier copy used "YES, YOU WERE!" / "NOT THIS TIME" / "TIME'S UP!" —
those have been replaced with the simpler labels above.)

**Correct-answer box** (incorrect/timed-out only): dashed bordered card
showing "THE CORRECT ANSWER" eyebrow + big answer in DM Sans 20/700 cream,
plus "You said: '<their answer>'" line below.

**Up-next preview:** "UP NEXT — CATEGORY 2" eyebrow above the next category
in Bebas Neue 36px orange uppercase (animated `pop-in`).

**CTA:** "Place your wager →" (or "See the damage →" if final question).

### 6. Result phase (final)
- Top phase tag `★ TODAY'S RESULTS ★`.
- Result banner: ★ + **PERFECT DAY** (3/3), ◐ + **2 OF 3 CORRECT**,
  ✗ + **TOUGH ROUND** (0/3). Background: green / orange / red.
- Per-question breakdown: 3 rows, each with a 3px left accent (green/red/
  purple), a circular icon, category (Bebas Neue 16px uppercase), answer
  (DM Sans, "Answer:" small dim label + bold cream answer text), and a
  signed wager pill (`+1,250` green or `−800` red).
- Stats grid (2 cols, 8px gap):
  - WAGERED · CORRECT — small dashed cards
  - **NEW TOTAL** — full-width hero card: dashed orange border, orange-tinted
    bg, value in Bebas Neue 38px with text-shadow, ` pts` suffix in DM Sans.
  - STREAK · ACCURACY — small dashed cards
- Streak message: DM Sans 13px, dim, dashed top border.
- Share button (orange beveled CTA): "Share your result →" or
  "✓ Copied to clipboard!" once clicked.
- Replay link below: small DM Sans, underlined.

### 7. Rules modal
Same modal chrome as inter-result. Header has a small "WELCOME TO" or "HOW TO
PLAY" eyebrow + the wordmark (small size). Five rule rows, each with an
orange-beveled icon square + heading (Bebas Neue 16px) + body (DM Sans 13px
dim). Note about midnight PST cadence at bottom in dashed orange box.

---

## The Wordmark — heart of the redesign

Three variants — **only ship "classic"** unless you want to expose all three
behind a settings/feature flag.

### Classic variant
- Words `You` `Sure` `About` `That` in **Bebas Neue 0.42em** (relative to
  parent), letter-spacing 0.04em, gap `0.18em`.
- Color: `--cream` for "You / About / That"; `--giants` for "Sure".
- Under "Sure": a hand-drawn SVG squiggle underline using a single `<path>`
  with stroke-width 3, color `--giants-2`, positioned `bottom: -0.18em`.
- The big `?`: Bebas Neue, color `--giants`, with **two stacked text-shadows**
  (`2px 2px 0 --giants-deep, 4px 4px 0 rgba(0,0,0,0.45)`) and a
  `drop-shadow(0 4px 22px --giants-shadow)` filter.
- **Wobble animation** (`q-wobble`, 4.5s `cubic-bezier(0.36,0,0.64,1)`
  infinite): rotates between `-3deg` and `+3deg` with small Y-translate.
  Transform-origin `50% 80%`. **At whimsy=low, this animation is disabled
  and the `?` is statically rotated `-2deg`.**

The other two variants (`sparkle` adds rotating ✦ glyphs; `inkblot` puts the
`?` inside a morphing orange blob) are in the prototype source but **not
needed for production** unless you want a settings toggle.

---

## Interactions & Behavior

All existing behavior in `app/page.js` is preserved. The only NEW visual
behaviors are:

| Event | Effect |
|---|---|
| Mount of any phase card | `fade-in` slide-up (0.4s ease, **transform-only — no opacity**, see note) |
| Reveal of category name | `pop-in` scale from 0.85 → 1 (0.5s `cubic-bezier(0.34,1.56,0.64,1)`, transform-only) |
| Modal open | `modal-in` slide+scale (0.32s `cubic-bezier(0.34,1.4,0.64,1)`, transform-only) |
| Wordmark `?` idle | `q-wobble` (4.5s infinite, classic variant only — disabled at whimsy=low) |
| Current progress dot | `dot-pulse` outer glow ring (1.6s ease-in-out infinite) |
| Timer ≤10s | Digit pulses + shakes (`timer-shake`, ±3deg, 0.5s) |
| Button hover (any bevel) | `translateY(-1px)` |
| Button :active | `translateY(5px)` + bevel insets swap → "pressed" feel |
| Info button hover | `rotate(8deg) scale(1.08)` |

### ⚠️ Animation gotcha (important)
**Do not animate `opacity: 0 → 1` on initial mount.** A hidden iframe / tab
that doesn't render the first animation frame will leave the card stranded
at `opacity: 0`. We learned this the hard way. All entry animations animate
**transform only** — opacity stays at 1 throughout. If you want a fade
effect, use `animation-fill-mode: both` AND keep opacity in the keyframes
mid-range (e.g. 0.6 → 1, never start at 0).

---

## Implementation suggestions

### Recommended path: keep the inline `S` object pattern
1. **Update `app/layout.js`:**
   ```js
   import { Bebas_Neue, Caveat, DM_Sans } from "next/font/google";
   const bebas  = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--display-font" });
   const caveat = Caveat({ weight: ["500","700"], subsets: ["latin"], variable: "--hand-font" });
   const dmSans = DM_Sans({ weight: ["400","500","600","700"], subsets: ["latin"], variable: "--body-font" });
   // body className: `${bebas.variable} ${caveat.variable} ${dmSans.variable}`
   ```
   Then in CSS use `font-family: var(--display-font), sans-serif;` etc.

2. **Update CSS variables in the `<style>{css}</style>` block** in
   `app/page.js`: drop in the new color tokens from this README's "Design
   Tokens" section. Rename existing vars or alias them
   (`--gold: var(--giants);`).

3. **Update the `S` style object** with the new values for each existing key.
   Most of the structure is unchanged — header, points bar, card, wager
   section, question box, etc. — you're just changing colors, fonts, sizes,
   and adding bevel shadow stacks.

4. **Add the keyframes** (`q-wobble`, `dot-pulse`, `timer-shake`, `pop`,
   `fade-up`, `modal-in`) to the `css` template-string block. Their full
   source is in `prototype/styles.css`.

5. **Add the Wordmark component** (replace the existing `S.title` /
   `S.titleYou` / etc. inline JSX). The full classic-variant component is in
   `prototype/app.jsx` under `function Wordmark({ variant, size })`.

6. **Update copy strings** in `InterResultPhase` and `ResultPhase`:
   - `"CORRECT!"` → `"CORRECT"`
   - `"INCORRECT"` (no change)
   - `"TIME'S UP!"` → `"TIME EXPIRED"`
   - `"PERFECT DAY!"` → `"PERFECT DAY"`
   - `"TOUGH ONE"` → `"TOUGH ROUND"`
   - `${correctCount} OF 3 CORRECT` (no change)

7. **Remove the Caveat-style copy** from labels you don't want to migrate to
   small-caps DM Sans. Currently in your code, things like "QUESTION 1 OF 3"
   are already uppercase + letter-spaced — those stay. Only the body labels
   (Budget remaining, Your points, etc.) get the small-caps treatment.

### Alternative path: migrate to CSS Modules
The full `styles.css` from the prototype is structured as plain CSS (no
preprocessors). If you'd rather migrate off the inline `S` pattern entirely,
you can copy `styles.css` to `app/page.module.css`, replace `style={S.foo}`
with `className={s.foo}`, and import: `import s from "./page.module.css"`.

---

## Tweaks (not for production)
The prototype includes a `Tweaks` panel that toggles wordmark variant and
"whimsy intensity" (low/medium/high). These are exploratory — production
should ship `wordmark="classic"` + `whimsy="low"` (the user's preferred
combo, which is the default in the prototype). The relevant CSS rules are
gated by `.whimsy-low`, `.whimsy-medium`, `.whimsy-high` classes on the
root.

If you DO want to expose a "playful mode" toggle to users, the difference
between low and medium is essentially: medium adds tape-corner accents to
cards, rotates badges more, and re-enables the wordmark wobble. The high
mode is too far for production.

---

## Files in this bundle

```
design_handoff_visual_overhaul/
├── README.md                       ← this file
└── prototype/
    ├── You Sure About That.html    ← entry point (open in browser)
    ├── app.jsx                     ← React + Babel app (all phase components)
    ├── styles.css                  ← all CSS, organized by section
    └── tweaks-panel.jsx            ← (not needed for production)
```

To run the prototype locally: open `You Sure About That.html` in any
modern browser. No build step.

The prototype's mock answer-checker accepts answers containing `pacino`,
`de niro`, `bolivia`, `britney`, or `spears` — useful for testing the
correct/incorrect/timed-out states.

---

## Assets
No new image assets are introduced. All graphical elements are CSS or inline
SVG (the wordmark's underline squiggle is a single `<path>` element). The
existing `app/icon.svg`, `app/favicon.ico`, and `app/opengraph-image.js` can
remain as-is, or be updated to use the new orange + dark cream treatment if
you want consistent OG branding (out of scope for this handoff).
