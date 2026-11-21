# Archive testing checklist

This is a practical walkthrough for testing the saved-response workflow in a real browser. Use sample messages, not customer data. Run it in both light and dark mode and at a narrow mobile width as well as desktop.

## Guest experience

1. Open the home page without signing in. Shared responses should load, and Private should require an account.
2. Type `#` into the draft. Confirm the shortcut menu lists available shortcuts and scrolls within its own fixed-height area.
3. Type a shortcut prefix, for example `#fol`, and check that only matching shortcut names remain. Then test a multi-word shortcut such as `#auto pricing` and a leading-underscore shortcut such as `#_OnIdle_`.
4. Press Enter or the right arrow to open a shortcut. The second level should show **all replies** saved under that shortcut.
5. Insert a reply, then press Ctrl/Cmd+Z to restore the previous shortcut search.
6. Copy the draft. The clipboard should contain the text you see, with no surprise changes.
7. Open Canned responses. Shared entries may show creator display names; the shortcut insertion popup should not.

## Signed-in experience

1. Sign in, return to the library, and confirm **All**, **Shared**, and **Private** show the right responses.
2. Create a shared reply under a new shortcut, then add a second reply under the same shortcut. Both must remain available.
3. Create a private reply using the same shortcut. It should appear only when signed in as its owner.
4. Edit the body and shortcut of a single reply. The other replies under the old shortcut must not change.
5. Delete a reply you own. A normal agent must not be able to change another agent's shared reply.
6. As administrator, verify editing/deleting shared replies works, while another user's private text stays inaccessible.
7. Open Import / Export. Export your private JSON, preview it before importing, and confirm new entries append rather than replace existing entries.
8. Try importing a malformed file or the wrong visibility. Confirm the UI rejects it. A failed batch may be partially imported, so check the library before trying again.
9. Open Settings, switch between Anime, TV series, and Movies, and browse all PFP options with **Show more**. The first tile must remain custom upload. Check images and account updates on a mobile device.
10. Collapse the sidebar and navigate among pages. Verify Settings remains usable and the desktop sidebar keeps its full-height appearance.

## Updating and performance

While the tab is visible, the app refreshes its response lists approximately every five seconds. A newly saved reply should be visible without a manual page reload. When nothing has changed, the interface should not jump or reset its draft, menu selection, or scroll position.

Scroll long libraries and galleries on a lower-powered phone if available. The background, theme switch, and glass effects should remain responsive; the first screen should not download every avatar in the catalog.

## API permission checks

Hiding a button is not enough. Confirm a non-admin receives **403** when attempting admin shared import/export and that unauthenticated requests cannot read private replies. The anonymous shared feed is intentionally public.

## Limitations

The project uses polling rather than direct push-based Realtime. Imports are append-only and not transactional across batches. Third-party PFPs may be missing or unavailable. Automated tests do not prove visual fidelity, browser-specific behavior, or secure operations in a real production environment.
