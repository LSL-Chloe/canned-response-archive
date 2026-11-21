# Design principles

The archive should feel like a focused writing tool, not a dashboard that demands attention. Search, response text, and account actions remain visually clear; the atmosphere around them can feel softer and more tactile.

## Light and dark

Both themes use subdued neutral colors, a finely woven background, and restrained highlights. The UI is meant to feel familiar on a desktop and natural on a phone. The dark theme is deep graphite rather than pitch black; the light theme is a gentle pearl gray.

## The glass treatment

Navigation, buttons, and selected controls use a refractive liquid-glass lens. This effect comes from [`@samasante/liquid-glass`](https://github.com/samasante/liquid-glass) and its SVG displacement maps, not from blur alone.

Text entry and response bodies remain legible on steadier surfaces. Decorative refraction sits behind text, never between a user and a control. These are web effects inspired by Apple's visual language, not Apple's native SwiftUI components, and appearance will differ between browsers.

## Motion and performance

Small interactions should respond promptly. Sliding navigation, the theme switch, and subtle moving light are secondary to typing, copying, and choosing a response.

Keep animation on composited properties where possible, avoid making whole lists repaint, and never create a fresh expensive glass shader for every response row. Off-screen rows may use browser rendering containment; hidden or unused avatar images should not monopolize bandwidth.

The reduced-motion preference disables the ambient movement. Reduced-transparency preferences use less translucent surfaces. On constrained connections, avatar loading should favor visible images.

## Accessibility

Controls use native buttons and inputs where possible. Keyboard shortcut search supports arrows, Enter, Escape, and undo. Focus and selected states must remain visible in both themes. Important instructions are text, not light or color alone.

## Visual regression checklist

Before merging interface changes, check both themes at desktop and narrow mobile widths. Test a collapsed sidebar, long responses, Settings with many avatars, OTP forms, and keyboard navigation. Automated builds cannot measure touch latency or verify the optical appearance.

The archive should remain recognizable and fluid even when a browser has to simplify how it renders the decorative effects.


## Rendering very long lists

Large lists use a translucent panel and optical edge rather than extending one SVG displacement filter across hundreds of responses. The full-height refraction texture can exceed device GPU limits and cause severe distortion deep into the page. Keep liquid-glass effects on bounded interactive controls and smaller cards; do not add a full-list filter back. Import file pickers should show one styled control while keeping the native file input keyboard accessible. Test the result in both themes and at high zoom.

## Response management and motion

The library filter has four equally sized tab targets (**All / Shared / Private / By me**). Its sliding glass lens uses a short transform-only transition; do not animate layout or recreate four expensive optical filters. Selection checkboxes are native form controls, not new liquid-glass SVGs for every row. A bulk action bar wraps instead of overflowing on narrow screens. Confirm destructive operations and show progress for batched deletes. Respect reduced-motion mode and do not promise a particular refresh rate: measure performance on the target hardware at full list length.
