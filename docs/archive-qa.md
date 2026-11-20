# Phase 3 — Archive UI smoke test (development only)

The homepage now contains an initial functional archive interface. This is a **workflow preview**,
not the final liquid-glass design. The verified QA authentication page remains at `/dev/auth-test`.

## Guest flow

1. Open the Worker homepage without signing in.
2. In the centered draft textarea, type `#` and see shared response suggestions.
3. Type a partial shortcut after `#` and use **Arrow Up/Down** and **Enter** to insert one response.
4. Use **Ctrl+Z** (Cmd+Z on macOS) immediately after selecting a suggestion to undo
   the insertion. It restores the entire typed `#word`, reopens the filtered list, and
   restores the selected suggestion. Normal typing uses the browser's undo behavior.
   A bare `#` reveals the complete scrollable list; `#in` should show only shortcuts
   beginning with `in`, never `#greeting`.
5. Switch to **Canned responses** in the sidebar; verify Shared and All display only shared content.
6. Click Private or + New response and confirm a sign-in prompt appears.

## Signed-in flow

1. Sign in with your existing development agent account.
2. Type `#` in the search workspace. Shared and your own private responses should appear.
3. Open the library; verify All, Shared and Private filters, and keyword search.
4. Select **+ New response** and create a shared response under a new shortcut.
5. Create another response under that same shared shortcut. It must **add**, not overwrite.
6. Create a private response using the same shortcut; only your account should see it.
7. Click Copy on a library entry, or insert it into the central draft.
8. Edit a private response's body **and shortcut** and delete one you created. Also edit
   an owned Shared response's body/shortcut; verify another response sharing the old
   shortcut retains its original shortcut. Other agents cannot edit yours unless admin.
9. Collapse the sidebar to an icon rail; check that Search, Canned Responses, and Team
   remain navigable by tooltip and that Expand restores the full labels.
10. From the profile dropdown, update your display name, PIN and verified email when you wish.
11. As admin, confirm Team overview displays counts but **never private response text**.
12. In the library, open **Import / Export**. As admin, check both **My Private** and
    **Shared (Admin)** destinations; with a normal account only **My Private** appears.
13. Export Shared as JSON; check it has `version: 1`, `visibility: "shared"`,
    and a `responses` array of `{shortcut,body}` entries.
14. Import a JSON export with a couple of safe test responses. Confirm that the file is
    previewed **before** confirmation, then verify new responses are added without replacing
    existing ones (including duplicate shortcuts).
15. Try choosing a Shared JSON file while Private is selected: the UI must reject it.
    Invalid JSON, empty entries, malformed shortcuts and more than 500 entries must be rejected.
16. Verify the Worker returns 403 when a normal agent attempts Shared import or export
    through the API, even if the UI buttons are hidden. An admin must not be able to export
    another agent's Private responses.

## Automatic updates and limitations

- The browser refreshes shared/private lists every **5 seconds** while the tab is visible,
  and on returning focus. The user who creates a response receives an immediate refresh.
- This is **near-live polling**, not true push-based Supabase Realtime yet.
- Shared created-by attribution appears in the library only, not in `#` suggestions.
- The Worker remains the sole owner of private data authorization. Never expose the
  `SUPABASE_SECRET_KEY` in React.
- JSON import/export UI is implemented. Imports are **append only** and **non-atomic**.
  Each API call handles at most 50 responses, with up to 10 requests/hour/account.
  The client previews the archive, validates up to 500 rows and sends bounded batches;
  a failing batch may partially succeed, so check the library before retrying.
- The archive is backed by the **development** database, not production. Do not import real
  workplace data before the visual, permissions and deployment reviews are complete.

No database migration or new secret is needed for this step.
