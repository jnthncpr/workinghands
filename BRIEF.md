# Working Hands - Stroke Rehab Hand Exercise App — Project Brief
> Save this file as `BRIEF.md` in your project root. Claude Code will reference it for full context.

---

## Project Overview

A browser-based iPad app designed to exercise the left hand of a stroke patient recovering fine motor skills. The experience is built around delight — the user never thinks "I am doing therapy." They think "I am playing with characters."

The interaction model is multi-touch gesture-based, designed specifically for thumb and finger coordination. Mini-games are defined by the designer (Jonathan); this brief covers the technical and animation architecture.

**Target device:** iPad (Safari, browser-based — no App Store)  
**Deployment:** Netlify, custom subdomain (e.g. `workinghands.ghostcoop.com`)  
**Stack:** HTML5, Vanilla JS, GSAP, Tone.js, SVG

---

## Design Language

**Visual reference:** Dumb Ways to Die  
- Thick outlines on SVG characters  
- Bright, slightly desaturated palette  
- Rubbery proportions (big heads, small limbs)  
- Heavy squash-and-stretch on interaction  
- Elastic eases that overshoot slightly  
- Textures welcome — hybrid raster/vector aesthetic  

**Animation feel:** Bouncy, forgiving, exaggerated. Characters have personality and react to the quality of interaction — not just whether it happened.

**UX principle:** Therapy embedded in delight. The person scratches a bear's back, plays a chord, pokes a character. The fine motor exercise is the side effect, not the point.

---

## Tech Stack

| Layer | Tool | Purpose |
|---|---|---|
| Character illustration | Adobe Illustrator | SVG authoring with named groups |
| Screen composition | Figma | Layout, spacing, UI specs |
| Figma → Code handoff | Figma MCP or Dev Mode export | Positioning, measurements |
| Animation | GSAP + MotionPath plugin | Character animation, state transitions |
| Audio | Tone.js | In-browser chord synthesis |
| Gesture detection | Raw Touch Events API + Hammer.js | Custom multi-touch gesture recognizers |
| Hosting | Netlify | Auto-deploy from GitHub, custom subdomain |

---

## Character Rig Architecture

Characters are illustrated in Illustrator and exported as **single SVG files** with named groups. Each character is a puppet — all states live in one file, toggled by GSAP.

### Layer naming convention

```
[character]_[bodypart]_[state]
```

### Example: Bear

```
bear.svg
├── group: bear_body          (static)
├── group: bear_back
│   ├── layer: bear_back_rest
│   └── layer: bear_back_scratched
└── group: bear_head
    ├── layer: bear_head_rest
    ├── layer: bear_head_happy
    └── layer: bear_head_angry
```

- All state layers exist in the file simultaneously
- Default: `display: none` on all non-rest states
- GSAP toggles visibility and crossfades between states
- Head and back states are **independent** — they can change at different times
- Body parts animate as groups — raster textures, PNG shading layers, and SVG outlines all ride together

### Texture approach

Characters can use stacked raster layers inside SVG `<image>` elements:
- Outline layer (SVG paths)
- Shading layer (PNG)
- Texture/grain layer (PNG, or procedural via `feTurbulence` SVG filter)

GSAP animates the parent group; layers can be offset slightly for a gelatinous, premium feel. Keep embedded PNGs lo-res — let SVG scaling handle resolution.

---

## Gesture System

All gestures use the **Web Touch API** (`touchstart`, `touchmove`, `touchend`). Custom gesture recognizers are written per interaction — not limited to standard pinch/swipe primitives.

### Gesture recognizer pattern

Each recognizer samples touch point positions per frame, tracks direction/velocity/count, and fires a named event when the pattern matches.

### Defined gestures (initial set)

| Gesture | Fingers | Motion | Zone | Event fired |
|---|---|---|---|---|
| Chord press | 2+ | Simultaneous tap/hold | Keyboard keys | `chord:played` |
| Back scratch | 3–4 | Repeated up/down drag | Character back zone | `back:scratched` |
| Belly rub | 2 | Circular motion | Character belly zone | `belly:rubbed` |
| Pet | 1 | Slow horizontal drag | Character head zone | `head:petted` |
| Tickle | 1+ | Rapid tap sequence | Character body | `body:tickled` |

### Interaction zones

Each SVG character element has its own touch target and gesture listener. Scratching only triggers when fingers are within the `bear_back` bounding box — not anywhere on screen. This makes interactions feel precise and intentional.

---

## Audio System (Tone.js)

- Chords synthesized in-browser — no audio files required (or use samples)
- Keypress detection maps simultaneous touches → specific chord → specific animation
- Each chord can trigger a unique character animation or reaction
- Velocity/speed of gesture can modulate audio (faster scratch = higher pitch, etc.)

---

## Animation State Machine (per character)

```
IDLE
  └─► on gesture detected → REACTING
        ├─► on gesture sustained → SUSTAINED_REACTION
        └─► on gesture end → RETURNING (ease back to IDLE with bounce-out)
```

State transitions are GSAP timelines. Each timeline can be interrupted and reversed cleanly.

### GSAP plugins in use
- **GSAP Core** — all base animation
- **GSAP MotionPath** — animate elements along defined paths (bounce arcs, scratch trajectories)
- **GSAP Elastic ease** — overshoot for rubbery feel

---

## Screen / Mini-Game Structure

Each mini-game is a self-contained screen:
- One or more SVG characters positioned per Figma layout spec
- One gesture type as the primary interaction
- Audio feedback via Tone.js
- Clear visual reward state (character reacts visibly)

Mini-games are designed by Jonathan. Claude Code receives per-screen briefs describing the characters, their states, the gesture, and the expected reaction.

---

## Asset Handoff Checklist (per character)

Before handing SVG to Claude Code, confirm:
- [ ] All groups named with `[character]_[part]_[state]` convention
- [ ] Non-rest state layers set to `display: none`
- [ ] Textures embedded as `<image>` elements within correct group
- [ ] Artboard/viewBox sized consistently across characters
- [ ] Exported from Illustrator with "Preserve Illustrator Editing Capabilities" unchecked

---

## Deployment

- **Repo:** GitHub (one repo per mini-game, or monorepo — TBD)
- **Host:** Netlify with `netlify.toml` config
- **Domain:** Custom subdomain pointed via CNAME from Cargo DNS settings
- **CI:** Auto-deploy on push to `main`

---

## Designer

Jonathan — Creative Director, Detroit/Michigan. Handles all illustration, character design, screen composition, and creative direction. Claude Code handles all engineering.
