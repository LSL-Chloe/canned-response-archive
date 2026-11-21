# Features and permissions

This document describes the behavior the archive currently aims to preserve. It is useful when reviewing a proposed change or testing a new deployment.

## Finding a reply

Anyone can open the search workspace and browse **Shared** responses. Typing `#` anywhere in the draft opens the shortcut picker; typing a matching shortcut **without** `#` at the start of the draft also opens it after at least two characters. Unrelated prose should not trigger shortcut suggestions. Both `follow_up` and `#follow_up` work in the library search. Press Enter or the right arrow to open a shortcut and then choose a reply. The popup scrolls when there are many results. Ctrl/Cmd+Z can undo the most recent insertion. The draft can be copied to the clipboard.

The same shortcut can contain several separate responses. Shortcut labels preserve spaces and underscores as entered (e.g., `#auto pricing` or `#_OnIdle_`); typing the complete label after `#` filters it normally. Selecting a reply never overwrites other saved replies.

## Saving and organizing

Signed-in agents can create shared and private responses, edit or delete responses they own, change a response's visibility between Shared and Private, and change one response's shortcut without changing other entries in the original group. An administrator can also edit, move, or delete another agent's Shared response. The original creator remains the owner when an administrator moves it to Private, and the administrator cannot see it afterward.

The library has **All**, **Shared**, **Private**, and **By me** views. By me filters to responses created by the signed-in agent, whether shared or private. A guest sees shared material only. A user's private text stays private to that account, even from the administrator.

The **Select** action reveals checkboxes beside responses the current user may delete; **Select all** selects eligible responses within the current filter or search results, not hidden responses. **Delete selected** requires confirmation. The server validates all IDs and permissions; deletion is atomic per batch of at most 100, with multiple batches possible for larger selections.

Import and export use JSON. An import adds rows rather than replacing existing ones; the UI previews the file. Each individual import batch is atomic, although a full multi-batch import is not one transaction.

## Accounts

An account has an agent name, a four-digit PIN, and an optional verified recovery email. Users can sign in with either the agent name or the **verified** email using the same PIN. An unverified or absent email cannot be used to sign in; name-based sign-in continues working. Users can update their name, email and PIN from Settings. Recovery uses an emailed six-digit code when a verified email is present.

The first completed signup becomes the administrator. This should happen in a controlled environment before opening registration to others.

Settings also allows uploading a custom profile image or choosing a character portrait. The first gallery tile is the custom-upload **+**. The default anime, TV, and movie icons remain available without a catalog API call; **Browse more** reveals additional choices.

## Role summary

| Action | Visitor | Agent | Administrator |
| --- | --- | --- | --- |
| View and copy shared replies | Yes | Yes | Yes |
| Read your own private replies | No | Yes | Yes |
| Read another user's private replies | No | No | No |
| Create shared or private replies | No | Yes | Yes |
| Edit or delete your own replies | No | Yes | Yes |
| Change your own reply's Shared/Private visibility | No | Yes | Yes |
| Edit, move or delete someone else's shared reply | No | No | Yes |
| Move someone else's reply when it is Private | No | No | No |
| Bulk delete eligible responses after confirmation | No | Own only | Own + others' Shared |
| Import/export private replies | No | Own only | Own only |
| Import/export the shared library | No | No | Yes |
| View account counts | No | No | Yes |

**Shared really means public to visitors.** Creator display names are included in the shared library, but not in the shortcut insertion popup.

## Implementation and quality expectations

The current stack is React, TypeScript, a Cloudflare Worker, and Supabase. Changes should preserve keyboard navigation, light/dark modes, responsiveness, source authorization, reduced-motion support, and the user's draft.

The shared library currently refreshes through periodic API requests rather than a direct Realtime channel.

Before a public production deployment, establish an independent production database, backups, secrets management, stronger authentication or an explicit risk acceptance, abuse controls, dependency audits, and repeatable browser/device QA.
