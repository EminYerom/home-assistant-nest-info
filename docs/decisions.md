# Engineering decisions

## Start with actions people repeat

Early feedback showed that a house map alone did not provide an immediate reason to return. The dashboard therefore gives shared groceries, tasks, TV shortcuts, and device care a more direct role. The map remains a navigation aid. Household adoption has not been measured.

## Keep one grocery list as the source of truth

The custom card uses an existing Home Assistant to-do entity instead of maintaining a second database. Quantities remain in item names. UID-based completion and Undo preserve item identity.

Duplicate checks refresh the list before writing and normalize case and whitespace. This is a usability check, not a transaction or a lock: two clients writing at exactly the same time can still race.

## Treat asynchronous updates carefully

A shared list can change while a read is in flight. A revision counter lets a newer pushed update win over a slower one-shot response. Disconnect and reconnection handling discard outdated subscriptions and responses. Draft text and caret position are preserved while the list changes.

Failed writes show a visible error and are not automatically retried. A lost response may leave the result uncertain, so the user is asked to refresh before trying again.

## Keep untrusted text inert

Grocery names are inserted with textContent rather than HTML interpretation. Navigation accepts local dashboard paths. The card does not create external analytics requests or persistent browser storage. Home Assistant itself stores and serves the shared list under its own access and retention settings.

## Diagnose camera limits before increasing concurrency

Single-stream viewing and multiple-stream trials produced different results. Playback and decoding failures remained during concurrent viewing. Unlimited network data did not establish that the camera, bridge, and playback path could sustain every stream together. Reliable simultaneous viewing remains open work.

## Stage Nest access separately

The planned thermostat connection uses Google's Smart Device Management integration and Cloud Pub/Sub. API setup, OAuth credentials, and an event topic have been prepared. Final authorization and end-to-end validation remain pending.

The OAuth flow requests broader Pub/Sub capabilities than a single event channel. The intended event-publishing grant is limited to the dedicated topic; that grant must be completed and verified separately. A dedicated Cloud project helps keep these resources organized but does not by itself narrow the OAuth scope.

## Keep the assistant's scope deliberate

Assistant exposure is limited to selected TV and shared-list entities. Locks, cameras, the Nest thermostat, and personal calendars are excluded from this initial assistant setup. The list of exposed entities must be rechecked as the installation changes.

## Keep public documentation separate from the home system

The information pages contain static text, inline styling, and links. They have no sign-in, control API, forms, tracking scripts, or connection to the live installation. Hosting providers may still log ordinary web requests.

The public repository excludes raw production configuration, home photos, floor plans, real device readings, family identities, private URLs, and secrets. Commit metadata also needs a GitHub-provided noreply author address before publication. Removing a file later is not a reliable way to retract public Git history or copies.
