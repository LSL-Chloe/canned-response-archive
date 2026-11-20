# DESIGN — Response Archive / Frosted Instrument

**Status:** Phase 4 development visual system, code-led.
**Mode:** Operate — agents need to find and paste a reply in seconds, not navigate decorative motion.

## Product truth

A workplace tool with a centered `#` composer, a shared/private archive, shortcut management, account security and an admin team view. Guests may read Shared; signed-in agents can manage their own responses; only admins import/export Shared and manage other agents' Shared responses. The server, not the frontend, enforces these rights.

## Direction

**Frosted Instrument** — the clarity and precision of a macOS utility, not a glassmorphic poster. Material hierarchy:
1. Matte, high-contrast reading and editing surfaces for response text.
2. Carefully bounded, physically suggestive glass on sidebar, top bar, account controls and selected navigation.
3. A single more expressive glass hero for six-digit OTP verification: a progress ring that changes to a confirmation lens.

Avoid full-page blur, decorative charts, neon gradients, bouncing page entrances, fake testimonials, or stock art. Nothing external is necessary to complete a real work task.

## Evidence / references

- https://liquidglassdesign.com/ — resource gallery of glass lenses, specular rims and translucency.
- https://www.uilora.com/ — dark component vocabulary and restrained high-quality controls.
- https://uiverse.io/ — microinteraction reference library; adapt patterns, do not copy third-party snippets.
- https://developer.apple.com/design/human-interface-guidelines/materials — glass as a control/navigation material with legibility and accessibility adaptations.
- https://github.com/samasante/liquid-glass — MIT, `@samasante/liquid-glass@0.1.1`; actual SVG-displacement lens used **only for the appearance toggle**, with CSS refraction/frost fallback. React is its only peer dependency.

These sites are **inspiration**, not sources for brand assets or lifted animations. The custom visuals use authored CSS and SVG; system fonts are used and no remote font is fetched.

## Tokens (authored choices, not extracted measurements)

| Role | Dark | Light |
|---|---|---|
| Canvas | `#0b0f15` | `#e9eff3` |
| Reading surface | `#141b24` | `#ffffff` |
| Content text | `#e9eef5` | `#1c2934` |
| Muted text | `#a0adbd` | `#536777` |
| Action accent | `#a3cafa` | `#235e89` |
| Glass tint | `rgba(25,33,44,.68)` | `rgba(250,253,255,.65)` |
| Highlight | directional white rim | brighter white rim |
| Success | soft emerald | deep jade |

- Font: platform system sans, tabular numerals for counters and OTPs.
- Radius vocabulary: 10–13px controls, 16–19px cards, ~30px authentication lens.
- Layers: directional edge highlights, tinted translucent substrate, a restrained lower shadow; backdrop blur only on overlay/navigation layers.
- Main `#` suggestion menu remains legible; no creator attribution in composer suggestions.
- Keyboard input and caret behavior are first-class, including Ctrl/Cmd+Z restore.

## Motion thesis

- **Focal:** OTP verification. Entering six digits draws a circular progress trace; verified result settles into a green outlined glass lens. It must be tied to actual verification response, never simulated.
- **Continuity:** 180–250ms tab, hover and overlay transitions. No animated initial page reveal.
- **Feedback:** pressed buttons, focus outlines, error/success notifications, selected shortcut.
- **Budget:** opacity and transform for motion, one bounded glowing OTP ring, no background animation, no perpetual loops.

## Accessibility / fallback

- Dark and light appearance toggles persist **only a theme string** in local storage; PIN, OTP and sessions never go there.
- `prefers-reduced-motion` removes scale and reveal motion; verification state still appears.
- `prefers-reduced-transparency` uses opaque surfaces.
- `prefers-contrast: more` strengthens borders; keyboard focus remains visible.
- Keep single, numeric, six-digit form field accessible to screen readers even when rendered as six visual cells.
- App works without the glass shader in browsers that do not expose live backdrop refraction.

## Viewport behavior

Desktop: permanent collapsible sidebar and sticky glass header. Phone: icon rail with labels available as tooltips, responsive authoring forms; auth converts to one column and keeps focus on the form.

## Future design QA

Validate `/` as a guest and as admin, `/auth?mode=login|signup|recover`, email-change OTP in settings, `/dev/auth-test`, and all empty/error states. Capture light and dark at desktop and 390px. Run the actual multi-user CRUD/permission tests before the production launch.
