# Approved functional requirements (captured November 2026)

## Guests
- Open site with no login, search and copy shared canned responses.
- Centered text entry accepts `#` and suggests shortcuts/responses.
- Keyboard support: Up/Down, Enter, Escape, undo with Ctrl+Z (platform equivalents where appropriate).
- Clicking Private or attempting to add responses prompts login/signup.

## Library
- Left sidebar tabs: Search and Canned Responses.
- Library filters: All, Shared, Private. For guests, All contains shared results only.
- Add response: response text, shortcut, shared/private visibility. No group, suggest-events, or tags.
- While entering a shortcut, suggest existing shortcuts; choosing one adds another response to its collection.
- If no existing shortcut is selected, new valid shortcut creates a new collection.
- Multiple responses may share one shortcut; never overwrite automatically.
- Shared updates should appear for connected users without refresh.

## Accounts
- Signup: unique agent name, 4-digit PIN, optional email.
- If email is provided, verify via 6-digit OTP sent to new email.
- Login uses agent name + PIN; optional email is for recovery, not login.
- Without verified email, there is no self-service forgotten-PIN recovery. Clearly warn at signup.
- Account settings: rename agent, add/change email with OTP to new address, change PIN with old PIN,
  recover forgotten PIN via verified email.
- Logged-in avatar/name at upper-right; Settings and Sign Out dropdown.
- The first successfully created account is admin exactly once, tracked by immutable user ID,
  not by mutable agent name or email.
- No invite code or signup approval desired.

## Hosting and workflow
- React + TypeScript, Cloudflare Worker API, Supabase database/realtime.
- Gmail + Apps Script intended for low-volume verification mail; secure integration to be designed.
- Development and production use separate databases.
- Design direction, animation choices, and visual references will be supplied later.

## Admin and response permissions (confirmed)
- Any authenticated agent can create Shared or Private responses.
- Agents can edit and delete **only their own Private** responses.
- Agents can delete **their own Shared** responses, but cannot edit any Shared response.
- The admin can edit or delete **any Shared** response, but not read or manage another agent's Private response contents.
- Only admin can import/export Shared responses. Agents can import/export **their own Private** responses.
- The shared library displays "Created by {agent name}" below response text; the
  main `#` search suggestion interface does **not** display creator names.
- Admin section lists registered accounts, join dates, roles, shared counts, and private counts;
  it does not expose private response text to the admin.

## Still to define
- Additional admin moderation operations beyond current permissions.
- Search ranking, shortcut character rules, and exact multi-response selection behavior.
- Backup retention and restore process.
