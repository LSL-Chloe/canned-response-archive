# Archive testing checklist

This is a practical walkthrough for testing the saved-response workflow in a real browser. Use sample messages, not customer data. Run it in both light and dark mode and at a narrow mobile width as well as desktop.

## Guest experience

1. Open the home page without signing in. Shared responses should load, and Private should require an account.
2. Type `#` into the draft. Confirm the shortcut menu lists available shortcuts and scrolls within its own fixed-height area. Then clear the draft and type a matching shortcut prefix **without #**, e.g. `app`: the same shortcut should appear. Ordinary unrelated sentences should not open the menu.
3. Type a shortcut prefix, for example `#fol`, and check that only matching shortcut names remain. Repeat without the hash, and test multi-word shortcuts such as `auto pricing` / `#auto pricing`, and leading-underscore shortcuts `_OnIdle_` / `#_OnIdle_`. In Canned responses, search for both `#follow_up` and `follow_up`: the results must match.
4. Press Enter or the right arrow to open a shortcut. The second level should show **all replies** saved under that shortcut.
5. Insert a reply with `#`, then press Ctrl/Cmd+Z to restore the previous shortcut search. Repeat without `#`, confirming the original text, selection and cursor position are restored and unrelated draft text is not overwritten.
6. Copy the draft via the existing **Copy draft** button and, with the editor focused and no selected text, via Ctrl/Cmd+C. Both should copy the complete draft. With some text highlighted, Ctrl/Cmd+C must copy **only** that selection.
7. Open Canned responses. Shared entries may show creator display names; the shortcut insertion popup should not.

## Signed-in experience

1. Sign in, return to the library, and confirm **All**, **Shared**, **Private**, and **By me** show the right responses. By me must include only the signed-in account's Shared and Private replies. A guest clicking Private or By me should be asked to sign in.
2. Create a shared reply under a new shortcut, then add a second reply under the same shortcut. Both must remain available.
3. Create a private reply using the same shortcut. It should appear only when signed in as its owner.
4. Edit the body and shortcut of a single reply. The other replies under the old shortcut must not change. Switch the reply between Shared and Private using the edit form. Confirm Shared → Private disappears from the guest feed; Private → Shared appears there. Verify the original shortcut name, response text, and author remain correct.
5. Delete a reply you own. A normal agent must not be able to change another agent's shared reply.
6. As administrator, verify editing/deleting shared replies works, while another user's private text stays inaccessible. Change another user's Shared response to Private: it should become private **to that original user**, not to the administrator. The admin should no longer be able to view or edit it. Verify all permissions server-side with attempted forbidden API requests.
7. Open Import / Export. Export your private JSON, preview it before importing, and confirm new entries append rather than replace existing entries.
8. Try importing a malformed file or the wrong visibility. Confirm the UI rejects it. Each batch is an atomic transaction: the failing batch saves all or none. Network failures can occur after the server commits, so reupload the same file to skip matching shortcut/text records. The whole multi-batch file is not one transaction. Confirm only one visible **Choose JSON file** button appears, that its label shows the selected filename, and that it can be reached by keyboard.
9. Open Settings, switch between Anime, TV series, and Movies, and browse all PFP options with **Show more**. The first tile must remain custom upload. Anime includes 470 source-pinned Crunchyroll pictures; search for a franchise and character. Thumbnails should use a CDN first and fall back to the original GitHub image when it fails. On slow connections, verify the first row loads promptly and later rows load on demand. Check image failures, account updates and selection on a mobile device.
10. Click **Select** in Shared and By me, choose individual checkboxes, **Select all**, **Deselect all** and **Clear**. Confirm Select all targets only the current search/filter and only records the user can delete. Cancel a destructive confirmation to ensure no rows change. Delete several test replies as an agent; verify someone else's shared replies remain. Repeat as admin on multiple shared entries. Test 101+ selected test entries to exercise the atomic 100-row batching; if a batch fails, the count and warning must explain previous confirmations.
11. Collapse the sidebar and navigate among pages. Verify Settings remains usable, the sidebar and top bar meet cleanly, and the desktop sidebar keeps its full-height appearance. Test all four library tabs, their animated **selected** lens positions (without a second hover pill), and bulk selection at mobile widths and 200% zoom.

## Updating and performance

While the tab is visible, the app refreshes its response lists approximately every five seconds. A newly saved reply should be visible without a manual page reload. When nothing has changed, the interface should not jump or reset its draft, menu selection, or scroll position.

Scroll long libraries (including 200+ responses), larger Team tables, and galleries on a lower-powered phone if available. Repeatedly toggle among all four library scopes and open/close the sidebar; transitions should remain responsive without content jumping. Confirm there is no additional animated filter on each checkbox and reduced-motion mode eliminates decorative transitions. In both themes, verify no large coloured/refraction artifacts appear when scrolling very far down, row actions remain aligned, the sidebar stays anchored, and the response list still looks translucent. The background, theme switch, and bounded glass effects should remain responsive. The first screen should not download every avatar in the catalog. Test keyboard focus on the hidden-native file picker and a long selected filename.

## API permission checks

Hiding a button is not enough. Confirm a non-admin receives **403** when attempting admin shared import/export and that unauthenticated requests cannot read private replies. The anonymous shared feed is intentionally public.

## Limitations

The project uses polling rather than direct push-based Realtime. Silent polls skip if another response refresh is still in flight; imports are atomic only within individual batches, not across the whole file. Third-party PFP CDNs may be missing, slow or unavailable and original GitHub sources provide a fallback. Automated tests do not prove visual fidelity, browser-specific behavior, or secure operations in a real production environment.

## Administrator account-management checks (staging only)

1. Sign in as the staging administrator. Expand **Admin dashboard** and switch between **Team overview** and **Manage agents**. Confirm only the selected submenu option has the glass pill, and the submenu closes/opens without losing the selected page.
2. Verify the registered-agent list shows agent names, roles, join dates, and response counts, but does not display recovery emails, private reply text, or PIN data. Ordinary agents must not see or access these endpoints.
3. Use a **disposable staging account** to verify the confirmation dialog. Cancelling or typing the wrong name must not delete anything; self-delete and deleting the administrator must be denied even if attempted through the API.
4. With a tested backup and a disposable staging account only, verify one confirmed deletion removes its sessions and replies, while another agent's Shared reply and any referenced shared shortcut survive. Reload and verify the public Shared feed. **Never perform a destructive account-delete smoke test on live users.**

## Two-account visibility checks (use expendable test content)

1. Create a shared test reply as Agent A. Confirm **By me** displays it for A but not for B. Confirm both see it under Shared and may copy it.
2. Agent B attempts to edit, move or bulk-delete Agent A's Shared reply using the API; each must return 403 without changing the data.
3. Admin edits Agent A's Shared reply to Private. Confirm the public feed removes it, A still has it under Private and By me, and the admin cannot retrieve or move the private reply afterward.
4. Agent A changes that Private reply back to Shared. Confirm that its ownership and shortcut remain intact and that it reappears on the shared feed.
5. With at least two selected rows, simulate a mixed authorized/unauthorized bulk-delete request; the database must reject the entire batch. Clear selections and repeat with only A's own rows to confirm successful deletion.
6. At narrow widths, 200% zoom, and with reduced-motion enabled, the new four-tab lens must stay aligned and native checkboxes and delete confirmation must remain usable.
