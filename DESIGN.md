# DESIGN — Response Archive / Liquid Controls

**Status:** November 2026, development app. **Mode:** Operate.

The visual brief is based on the user's **Liquid Glass Switch**, **Dark Light Button UI Animation**, and rounded-rectangle tab navigation screenshots. The old “Frosted Instrument” visual system was rejected.

## Primary interaction language
- **Dark:** graphite-black work surfaces, black navigation track, bright glass lips; no blue gradients, neon, full-page blur or fogged panels.
- **Light:** neutral soft-grey work surface, polished translucent-white lenses and a pearly toggle, black readable text.
- The large light/dark switch is a horizontal capsule with a **larger round refractive puck** that slides across the track, just like the supplied example.
- Sidebar navigation uses a **single persistent glass selection** moving smoothly from tab to tab instead of mounting a new lens for each tab.
- Sidebar collapse/expand animates width (420ms) and text opacity/width together. Mobile uses an icon rail and an accessible close backdrop when expanded.
- Action buttons with high visual priority use the same SVG-displacement lens. Reading/editor surfaces stay opaque.

## Real material technique
`@samasante/liquid-glass` (MIT), already in the project, provides SVG-generated distortion maps: rim bending, curvature, chromatic dispersion, directional specular lighting and optional frost. Our lenses set `frost:0` and deliberately expose these optical properties; mere `backdrop-filter: blur` is **not** the design.

**Important limitation:** these are Apple-style controls for the web, **not Apple's native proprietary SwiftUI Liquid Glass components**. Browser rendering differences mean no cross-browser pixel-perfect clone of the Apple OS compositor is promised.

## Functionality and accessibility
- Keep the existing server-side auth and permission gates, response CRUD, keyboard `#` insertion and undo, ownership-based editing, private/shared scopes, import/export, and six-digit email OTP.
- Refraction is decorative, not an action layer: underlying native buttons and keyboard focus remain functional.
- Use the `role="switch"` control with `aria-checked` for theme; store only the light/dark preference.
- `prefers-reduced-motion` disables the spring movement and `prefers-reduced-transparency` allows an opaque fallback.
- Use legible text outside glass, with restrained scale and a single symbol/icon vocabulary.

## Reference evidence
- User-supplied tab navigation and light/dark switch screenshots
- https://liquidglassdesign.com/gallery/liquid-glass-switch
- https://liquidglassdesign.com/gallery/dark-light-button-ui-animation
- https://github.com/samasante/liquid-glass/blob/main/examples/GlassSwitch.tsx
- https://www.uilora.com/
- https://uiverse.io/

## Verification before production rollout
Capture desktop + 390px mobile in both modes; exercise sidebar toggling and selection, theme toggle, library tabs, primary buttons, live OTP, and permission regressions. GitHub build and unit tests alone cannot prove optical fidelity or touch smoothness.
