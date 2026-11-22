# Design principles

The archive should feel like a focused writing tool, not a dashboard that demands attention. Search, response text, and account actions remain visually clear; the atmosphere around them can feel softer and more tactile.

## Light and dark

Both themes keep the finalized violet/blue **original WebGL shader** as the preferred decorative background, using WebGL2 or WebGL1 when available. The approved component styles, glass optics, switch proportions and spring timing are shared throughout the app.

## Exactly two visual backgrounds

**Original (always attempted first):** run the approved shader via WebGL2 or WebGL1. On low-end devices, only the internal render resolution or frame cadence may be reduced; the buttons, glass controls, selection pills, theme switch and their motion do not change.

**Fallback (only if WebGL fails or the script cannot execute):** use the previous black/white **lined CSS backdrop**, themed appropriately for dark or light mode. It is the *only* alternative background. All other UI styling and interactions remain the same. There is no alternate Canvas 2D UI or third gradient theme. A matched ambient CSS field is shown temporarily *during* GPU initialization, before the first valid shader frame, to prevent a blank flash.

Respect reduced-motion settings by rendering the original shader at a stationary time when graphics work, and disabling ambient movement in the lined CSS fallback. Never override the user's explicit motion preference. The browser can block WebGL; no website can force a disabled graphics API.

## The glass treatment

Navigation, buttons, and selected controls use a refractive liquid-glass lens. This effect comes from [`@samasante/liquid-glass`](https://github.com/samasante/liquid-glass) and its SVG displacement maps, not from blur alone.

Text entry and response bodies remain legible on steadier surfaces. Decorative refraction sits behind text, never between a user and a control. These are web effects inspired by Apple's visual language, not Apple's native SwiftUI components, and appearance will differ between browsers.

## Motion and performance

Small interactions should respond promptly. Sliding navigation, the theme switch, and subtle moving light are secondary to typing, copying, and choosing a response.

Keep animation on composited properties where possible, avoid making whole lists repaint, and never create a fresh expensive glass shader for every response row. Off-screen rows may use browser rendering containment; hidden or unused avatar images should not monopolize bandwidth.

The reduced-motion preference disables ambient movement. Reduced-transparency preferences use less translucent surfaces. On constrained connections, avatar loading should favor visible images. When both WebGL APIs cannot initialize, use the stationary or gently composited lined CSS backdrop. Do not spin a Canvas 2D rendering loop on the main thread. Brief GPU context losses get one bounded retry and a second WebGL API attempt before settling on the fallback. Keep the background theme transition aligned to the 580ms switch.

## Accessibility

Controls use native buttons and inputs where possible. Keyboard shortcut search supports arrows, Enter, Escape, and undo. Focus and selected states must remain visible in both themes. Important instructions are text, not light or color alone.

## Visual regression checklist

Before merging interface changes, check both themes at desktop and narrow mobile widths, in **WebGL-enabled and WebGL-disabled browsers**, checking the original shader and lined fallback separately. Test a collapsed sidebar, long responses, Settings with many avatars, OTP forms, keyboard navigation, and light/dark transitions while entering a draft. Automated builds cannot measure touch latency or verify the optical appearance.

The archive should remain recognizable and fluid even when a browser has to simplify how it renders the decorative effects.


## Rendering very long lists

Large lists use a translucent panel and optical edge rather than extending one SVG displacement filter across hundreds of responses. The full-height refraction texture can exceed device GPU limits and cause severe distortion deep into the page. Keep liquid-glass effects on bounded interactive controls and smaller cards; do not add a full-list filter back. Import file pickers should show one styled control while keeping the native file input keyboard accessible. Test the result in both themes and at high zoom.

## Response management and motion

The library filter has four equally sized tab targets (**All / Shared / Private / By me**). Its sliding glass lens uses a short transform-only transition; do not animate layout or recreate four expensive optical filters. Selection checkboxes are native form controls, not new liquid-glass SVGs for every row. A bulk action bar wraps instead of overflowing on narrow screens. Confirm destructive operations and show progress for batched deletes. Respect reduced-motion mode and do not promise a particular refresh rate: measure performance on the target hardware at full list length.

## Shortcut search modes

Show a single compact draft composer rather than adding an extra dashboard-style search pane. A typed `#` opens the shortcut menu from any draft position. A plain typed prefix should open that same menu only when it matches a known shortcut at the start of a draft; avoid interrupting ordinary messages. Preserve two-level shortcut/reply navigation, keyboard arrows/Enter/Escape, and Ctrl/Cmd+Z undo in both modes. The saved label is unchanged: `#` is a search convenience, not a mutation of the shortcut itself.
