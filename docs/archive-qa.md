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
8. Try importing a malformed file or the wrong visibility. Confirm the UI rejects it. Each batch is an atomic transaction: the failing batch saves all or none. Network failures can occur after the server commits, so reupload the same file to skip matching shortcut/text records. The whole multi-batch file is not one transaction. Confirm only one visible **Choose JSON file** button appears, that its label shows the selected filename, and that it can be reached by keyboard.
9. Open Settings, switch between Anime, TV series, and Movies, and browse all PFP options with **Show more**. The first tile must remain custom upload. Anime includes 470 source-pinned Crunchyroll pictures; search for a franchise and character. Thumbnails should use a CDN first and fall back to the original GitHub image when it fails. On slow connections, verify the first row loads promptly and later rows load on demand. Check image failures, account updates and selection on a mobile device.
10. Collapse the sidebar and navigate among pages. Verify Settings remains usable and the desktop sidebar keeps its full-height appearance.

## Updating and performance

While the tab is visible, the app refreshes its response lists approximately every five seconds. A newly saved reply should be visible without a manual page reload. When nothing has changed, the interface should not jump or reset its draft, menu selection, or scroll position.

Scroll long libraries (including 200+ responses) and galleries on a lower-powered phone if available. In both themes, verify no large coloured/refraction artifacts appear when scrolling very far down, row actions remain aligned, the sidebar stays anchored, and the response list still looks translucent. The background, theme switch, and bounded glass effects should remain responsive. The first screen should not download every avatar in the catalog. Test keyboard focus on the hidden-native file picker and a long selected filename.

## API permission checks

Hiding a button is not enough. Confirm a non-admin receives **403** when attempting admin shared import/export and that unauthenticated requests cannot read private replies. The anonymous shared feed is intentionally public.

## Limitations

The project uses polling rather than direct push-based Realtime. Silent polls skip if another response refresh is still in flight; imports are atomic only within individual batches, not across the whole file. Third-party PFP CDNs may be missing, slow or unavailable and original GitHub sources provide a fallback. Automated tests do not prove visual fidelity, browser-specific behavior, or secure operations in a real production environment.
