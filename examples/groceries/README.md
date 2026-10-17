# Family grocery card

A Home Assistant custom card that presents one existing to-do list in full or compact form. This publication copy uses generic dashboard routes and synthetic test data.

Features include quick add, local keyword grouping, duplicate checks, rename, completed history, buy again, and Undo. It uses the configured to-do entity for reads and writes. It adds no separate storage service, persistent browser storage, or third-party analytics requests.

## Try the checks

Requires a current Node.js release with the built-in test runner. No package installation is needed.

```sh
node --check family-grocery-card.js
node --test family-grocery-card.test.cjs
```

Run those commands from this directory. The tests use mocks and do not change any household list.

## Example configuration

Copy the JavaScript file to your own Home Assistant www directory and register it as a JavaScript module resource using your installation's dashboard resource settings. Adjust paths and the entity for your installation.

```yaml
type: custom:family-grocery-card
entity: todo.shopping_list
title: Groceries
compact: false
staples:
  - Milk
  - Eggs
  - Bread
```

For a compact card linking to a separate full-list view:

```yaml
type: custom:family-grocery-card
entity: todo.shopping_list
compact: true
navigation_path: /lovelace/groceries
```

The navigation path must refer to a view you create. This card does not create a dashboard or a to-do entity. It uses Home Assistant's to-do item response API and, when available, item subscriptions. Check compatibility with your own installation before relying on it.

## Limits

Categories are keyword suggestions. Amounts stay in the item name. The card is not a pantry inventory system. Client-side duplicate checks do not provide atomic coordination across simultaneous writes from different devices. Mock tests do not verify rendered appearance or replace browser and Home Assistant checks.
