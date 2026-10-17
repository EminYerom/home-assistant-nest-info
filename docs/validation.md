# Validation notes

Status recorded October 17, 2026.

## Reproducible checks in this repository

```sh
node --check examples/groceries/family-grocery-card.js
node --test examples/groceries/family-grocery-card.test.cjs
```

**Latest local result:** JavaScript syntax check passed; all 25 mock tests passed, with 0 failures.

The test suite uses Node's built-in test runner and a small mocked DOM and Home Assistant backend. It needs no npm packages, network connection, credentials, or Home Assistant server.

Coverage includes duplicate handling, quantity preservation, UID-based completion and Undo, rename, permission failures, write failures and no automatic retries, rapid repeated actions, subscription cleanup, stale-response ordering, offline behavior, inert untrusted item text, compact-mode controls, and edit-draft preservation.

These checks verify component logic against mocks. They do not establish browser rendering, screen-reader compatibility, multi-user transaction guarantees, or compatibility with every Home Assistant release.

## Recorded checks on the private installation

- A temporary grocery item was added, marked bought, restored with Undo, and removed.
- A temporary household task was added and removed through the configured assistant.
- Dashboard changes and selected maintenance/status displays were inspected during setup.
- Camera playback was tried in single-stream and concurrent configurations; concurrent viewing was not verified reliable.

Production screenshots and logs are omitted because they can reveal household details. These are recorded setup observations rather than a continuous monitoring service or independently certified test report.

## Outstanding checks

- Complete Nest authorization; verify live state updates and supported controls without changing household settings unexpectedly.
- Confirm TV wake behavior with the required physical TV setting enabled.
- Resolve and retest concurrent camera playback.
- Test vacuum controls and floor transitions after the flooring work is finished.
- Gather family feedback on groceries, navigation, and task use.

No uptime, adoption, energy savings, or security certification claim is made.
