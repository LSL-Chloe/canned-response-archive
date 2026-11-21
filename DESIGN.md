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
