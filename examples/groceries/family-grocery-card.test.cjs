/* Local mock tests only: no Home Assistant, browser, network, or dependencies. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'family-grocery-card.js'), 'utf8');
const E = 'todo.shopping_list';
const clone = (x) => JSON.parse(JSON.stringify(x));
const entry = (uid, summary, status = 'needs_action') => ({ uid, summary, status });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise((resolve) => setImmediate(resolve));
const descendants = (node) => node ? [node, ...node.children.flatMap(descendants)] : [];
const compactUndo = (card) => descendants(card._recentUndo).find((node) => node.tagName === 'button');

function environment() {
  class Node {
    constructor(tag = 'node') { this.tagName = tag; this.children = []; this.listeners = new Map(); this.attrs = {}; this._text = ''; this.value = ''; }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map((x) => x.textContent).join(''); }
    set innerHTML(_) { throw new Error('HTML injection is forbidden'); }
    append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
    replaceChildren(...nodes) { this.children = []; this._text = ''; this.append(...nodes); }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(callback); }
    removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
    dispatchEvent(event) { event.preventDefault ||= () => { event.defaultPrevented = true; }; for (const callback of this.listeners.get(event.type) || []) callback(event); return !event.defaultPrevented; }
    focus() { let root = this; while (root.parentNode) root = root.parentNode; root.activeElement = this; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  }
  class Element extends Node { attachShadow() { this.shadowRoot = new Node('shadow'); return this.shadowRoot; } }
  const registry = new Map();
  const document = new Node('document'); document.createElement = (tag) => new Node(tag); document.visibilityState = 'visible';
  const window = new Node('window'); window.location = { pathname: '/lovelace/home', search: '' }; window.history = { calls: [], pushState(...args) { this.calls.push(args); } };
  const customElements = { get: (name) => registry.get(name), define: (name, card) => registry.set(name, card) };
  const context = vm.createContext({ HTMLElement: Element, customElements, document, window, queueMicrotask, CustomEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } } });
  vm.runInContext(source, context);
  return { Card: registry.get('family-grocery-card'), document, window, registry, context };
}

function backend(items = []) {
  const data = { items: clone(items), writes: [], reads: [], subscriptions: [], removes: 0, callbacks: new Set(), readError: null, writeError: null };
  data.push = () => { for (const callback of data.callbacks) callback({ items: clone(data.items) }); };
  const connection = { connected: true, subscribeMessage: async (callback, message) => {
    data.subscriptions.push(clone(message)); data.callbacks.add(callback); callback({ items: clone(data.items) });
    return () => { data.callbacks.delete(callback); data.removes++; };
  } };
  data.hass = { connected: true, connection, states: { [E]: { state: String(items.filter((x) => x.status === 'needs_action').length), last_updated: '1', last_changed: '1', attributes: { supported_features: 15 } } },
    callWS: async (message) => { data.reads.push(clone(message)); if (data.readError) throw data.readError; return { context: {}, response: { [E]: { items: clone(data.items) } } }; },
    callService: async (domain, service, payload, target) => {
      data.writes.push(clone({ domain, service, payload, target })); if (data.writeError) throw data.writeError;
      if (service === 'add_item') data.items.push(entry(`new-${data.writes.length}`, payload.item));
      else if (service === 'update_item') { const item = data.items.find((x) => x.uid === payload.item); if (!item) throw new Error('missing'); if (payload.rename !== undefined) item.summary = payload.rename; if (payload.status !== undefined) item.status = payload.status; }
      else throw new Error('Unexpected destructive service');
      data.push();
    } };
  return data;
}

async function setup(items = [], config = {}) {
  const env = environment(), data = backend(items), card = new env.Card();
  card.setConfig({ entity: E, ...config }); card.hass = data.hass;
  await card.refresh();
  return { ...env, data, card };
}

test('normalizes case/space only; quantities and accents remain distinct', () => {
  const { Card } = environment();
  assert.equal(Card.normalize('  MILK \n 2 cartons '), 'milk 2 cartons');
  assert.notEqual(Card.normalize('Milk'), Card.normalize('Milk 2 cartons'));
  assert.notEqual(Card.normalize('Milk 2'), Card.normalize('Milk 3'));
  assert.notEqual(Card.normalize('café'), Card.normalize('cafe'));
});

test('common food keywords group locally with specific compound exceptions', () => {
  const { Card } = environment();
  for (const [name, result] of [['2 bananas', 'Produce'], ['Milk 2 cartons', 'Dairy & eggs'], ['Eggs', 'Dairy & eggs'], ['salmon', 'Meat & seafood'], ['bread', 'Bakery'], ['rice', 'Pantry'], ['peanut butter', 'Pantry'], ['chicken broth', 'Pantry'], ['frozen strawberries', 'Frozen'], ['ice cream', 'Frozen'], ['orange juice', 'Drinks'], ['toilet paper', 'Household'], ['mystery item', 'Other']]) assert.equal(Card.category(name), result, name);
});

test('response-only get_items sends exact entity and both statuses', async () => {
  const { card, data } = await setup([entry('a', 'Milk'), entry('b', 'Bread', 'completed')]);
  assert.deepEqual(data.reads[0], { type: 'call_service', domain: 'todo', service: 'get_items', target: { entity_id: E }, service_data: { status: ['needs_action', 'completed'] }, return_response: true });
  assert.equal(card._items.length, 2);
  assert.equal(card._loaded, true);
});

test('add trims whitespace, blocks normalized active duplicates, keeps quantities separate', async () => {
  const { card, data } = await setup([entry('a', 'Milk')]);
  assert.equal(await card.add('  MILK '), false); assert.equal(data.writes.length, 0);
  assert.equal(await card.add(' Milk   2 cartons '), true);
  assert.deepEqual(data.writes[0], { domain: 'todo', service: 'add_item', payload: { item: 'Milk 2 cartons' }, target: { entity_id: E } });
  assert.equal(await card.add('   '), false); assert.equal(data.writes.length, 1);
});

test('buy again restores completed UID rather than creating a second item', async () => {
  const { card, data } = await setup([entry('b', 'Bread', 'completed')]);
  assert.equal(await card.add(' bread '), true);
  assert.deepEqual(data.writes[0].payload, { item: 'b', status: 'needs_action' });
  assert.equal(data.writes[0].service, 'update_item'); assert.equal(data.items.length, 1);
});

test('complete, individual Undo, rename use UID and only changed fields', async () => {
  const { card, data } = await setup([entry('a', 'Milk')]);
  assert.equal(await card.setItem('a', true), true);
  assert.equal(await card.setItem('a', false), true);
  assert.equal(await card.rename('a', ' Milk 2 cartons '), true);
  assert.deepEqual(data.writes.map((x) => x.payload), [{ item: 'a', status: 'completed' }, { item: 'a', status: 'needs_action' }, { item: 'a', rename: 'Milk 2 cartons' }]);
  assert(data.writes.every((x) => x.domain === 'todo' && x.service === 'update_item' && x.target.entity_id === E));
});

test('Undo and rename do not create a duplicate already active elsewhere', async () => {
  const { card, data } = await setup([entry('a', 'Milk'), entry('b', ' MILK ', 'completed'), entry('c', 'Eggs')]);
  assert.equal(await card.setItem('b', false), false);
  assert.equal(await card.rename('c', ' milk '), false);
  assert.equal(data.writes.length, 0);
});

test('actions refresh before checking duplicates and deleted IDs', async () => {
  const { card, data } = await setup();
  data.items = [entry('other-phone', 'Eggs')];
  assert.equal(await card.add('eggs'), false); assert.equal(data.writes.length, 0);
  assert.equal(await card.setItem('gone', true), false); assert.equal(data.writes.length, 0);
});

test('permission/read/write failures retain drafts and never retry mutations', async () => {
  const { card, data } = await setup(); card._input.value = 'Milk';
  data.writeError = { code: 'unauthorized' };
  assert.equal(await card.add('Milk'), false); assert.equal(data.writes.length, 1); assert.match(card._error, /cannot change/); assert.equal(card._input.value, 'Milk');
  data.readError = { code: 'unauthorized' };
  assert.equal(await card.add('Eggs'), false); assert.equal(data.writes.length, 1); assert.match(card._error, /cannot open/);
  assert.equal(card._busy, false);
});

test('sync exceptions and malformed responses do not leave reads stuck', async () => {
  const { card, data } = await setup();
  data.hass.callWS = () => { throw new Error('offline'); };
  assert.equal(await card.refresh(), false); assert.equal(card._readPromise, null);
  data.hass.callWS = async () => ({ response: { [E]: { items: [{ summary: 'Missing uid', status: 'needs_action' }] } } });
  assert.equal(await card.refresh(), false); assert.equal(card._loaded, true); assert.equal(card._items.length, 0);
});

test('one action in flight prevents rapid double add', async () => {
  const { card, data } = await setup(); const wait = deferred(), original = data.hass.callService;
  data.hass.callService = async (...args) => { await wait.promise; return original(...args); };
  const first = card.add('Milk'); await tick();
  assert.equal(await card.add('Milk'), false);
  wait.resolve(); assert.equal(await first, true); assert.equal(data.writes.length, 1);
});

test('native subscription handles same-count edits, unsubscribes, and has no timers', async () => {
  const { card, data } = await setup([entry('a', 'Milk')]); card.connectedCallback(); await tick(); await tick();
  assert.deepEqual(data.subscriptions[0], { type: 'todo/item/subscribe', entity_id: E });
  data.items[0].summary = 'Oat milk'; data.push(); assert.equal(card._items[0].summary, 'Oat milk');
  card.disconnectedCallback(); assert.equal(data.removes, 1); assert.equal(data.callbacks.size, 0);
  assert.doesNotMatch(source, /\b(?:setTimeout|setInterval|fetch|XMLHttpRequest|localStorage|sessionStorage|WebSocket)\s*[.(]/);
});

test('newer push wins over a slower read response', async () => {
  const { card, data } = await setup([entry('a', 'Milk')]); card.connectedCallback(); await tick(); await tick();
  const wait = deferred(); data.hass.callWS = () => wait.promise;
  const reading = card.refresh(); await tick();
  data.items = [entry('a', 'Fresh name')]; data.push();
  wait.resolve({ response: { [E]: { items: [entry('a', 'Old name')] } } });
  assert.equal(await reading, true); assert.equal(card._items[0].summary, 'Fresh name'); card.disconnectedCallback();
});

test('late subscription registration is cleaned after disconnect', async () => {
  const { card, data } = await setup(); const wait = deferred(); let removes = 0;
  data.hass.connection.subscribeMessage = () => wait.promise;
  card.connectedCallback(); await tick(); card.disconnectedCallback(); wait.resolve(() => { removes++; }); await tick(); assert.equal(removes, 1);
});

test('failed native subscription can retry on the next Refresh', async () => {
  const { card, data } = await setup(); let attempts = 0;
  const subscribe = data.hass.connection.subscribeMessage;
  data.hass.connection.subscribeMessage = (...args) => { attempts++; return attempts === 1 ? Promise.reject(new Error('temporary')) : subscribe(...args); };
  card.connectedCallback(); await tick(); await tick();
  assert.equal(card._subConnection, null); assert.equal(attempts, 1);
  await card.refresh(); await tick(); assert.equal(attempts, 2); assert.equal(typeof card._subscription, 'function'); card.disconnectedCallback();
});

test('offline mode disables changes and preserves the last known list', async () => {
  const { card, data } = await setup([entry('a', 'Milk')]); data.hass.connection.connected = false; card.hass = data.hass;
  assert.equal(await card.add('Eggs'), false); assert.equal(data.writes.length, 0); assert.equal(card._items[0].summary, 'Milk'); assert.equal(card._addButton.disabled, true); assert.match(card._message.textContent, /Offline/);
});

test('untrusted item text is inert; full mode preserves completed order and starts collapsed', async () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const { card } = await setup([entry('a', hostile), entry('b', 'Older order', 'completed'), entry('c', 'Next order', 'completed')]);
  assert.match(card._list.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(card._completed.children[0].open, false);
  assert(card._again.textContent.indexOf('Older order') < card._again.textContent.indexOf('Next order'));
  assert.doesNotMatch(source, /\.innerHTML\s*=|insertAdjacentHTML|eval\s*\(/);
});

test('compact mode shows only first six, no staples/history bank, and local SPA link', async () => {
  const { card, window } = await setup(Array.from({ length: 9 }, (_, i) => entry(String(i), `Item ${i}`)), { compact: true });
  assert.equal(card._list.children.length, 6); assert.equal(card._again.children.length, 0); assert.equal(card._completed.children.length, 0);
  const walk = (node) => [node, ...node.children.flatMap(walk)]; const link = walk(card.shadowRoot).find((node) => node.tagName === 'a');
  link.dispatchEvent({ type: 'click', button: 0 }); assert.equal(window.history.calls[0][2], '/lovelace/groceries');
  assert.equal(card._count.textContent, '9 to get');
});

test('compact all-bought copy points to Open list while full mode points below', async () => {
  const items = [entry('a', 'Milk', 'completed')];
  const compact = await setup(items, { compact: true });
  const full = await setup(items);
  assert.match(compact.card._list.textContent, /tap Open list/);
  assert.doesNotMatch(compact.card._list.textContent, /below/);
  assert.match(full.card._list.textContent, /bring an item back below/);
});

test('compact Undo restores the checked item by UID through the visible button, preserving quantity', async () => {
  const { card, data } = await setup([entry('milk-two', 'Milk 2 cartons'), entry('eggs', 'Eggs')], { compact: true });
  const checkbox = descendants(card._list).find((node) => node.attrs['aria-label'] === 'Mark Milk 2 cartons as bought');
  checkbox.dispatchEvent({ type: 'change' }); await tick();
  const undo = compactUndo(card);
  assert(undo, 'A compact card must show Undo after checking an item');
  assert.equal(undo.disabled, false);
  assert.equal(undo.attrs['aria-label'], 'Undo bought: Milk 2 cartons');
  assert.match(card._recentUndo.textContent, /Milk 2 cartons/);
  assert.doesNotMatch(card._message.textContent, /undo below/);
  assert.equal(card._count.textContent, '1 to get');
  undo.dispatchEvent({ type: 'click' }); await tick();
  assert.deepEqual(data.writes.map((write) => write.payload), [
    { item: 'milk-two', status: 'completed' }, { item: 'milk-two', status: 'needs_action' },
  ]);
  assert(data.writes.every((write) => write.service === 'update_item' && write.target.entity_id === E));
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0].summary, 'Milk 2 cartons');
  assert.equal(card._count.textContent, '2 to get');
  assert.equal(compactUndo(card), undefined);
  assert.match(card._message.textContent, /Back on the list/);
});

test('compact Undo offers only the latest completion and disappears after another client restores it', async () => {
  const { card, data } = await setup([entry('milk', 'Milk'), entry('bread', 'Bread')], { compact: true });
  await card.setItem('milk', true); await card.setItem('bread', true);
  assert(compactUndo(card), 'The most recently completed item needs Undo');
  assert.match(card._recentUndo.textContent, /Bread/);
  assert.doesNotMatch(card._recentUndo.textContent, /Milk/);
  assert.equal(descendants(card._recentUndo).filter((node) => node.tagName === 'button').length, 1);
  assert.equal(card._completed.children.length, 0, 'Compact mode must not expand the completed history');
  data.items.find((item) => item.uid === 'bread').status = 'needs_action';
  await card.refresh();
  assert.equal(compactUndo(card), undefined);
  assert.equal(data.writes.length, 2, 'A refresh must not automatically undo anything');
  assert.equal(data.items.find((item) => item.uid === 'milk').status, 'completed');
});

test('compact Undo reports failed completion and failed Undo truthfully without automatic retries', async () => {
  const { card, data } = await setup([entry('milk', 'Milk')], { compact: true });
  data.writeError = new Error('connection lost');
  assert.equal(await card.setItem('milk', true), false);
  assert.equal(compactUndo(card), undefined);
  assert.doesNotMatch(card._message.textContent, /Marked as bought|Back on the list|undo below/);
  assert.match(card._errorNode.textContent, /wasn.t confirmed/);
  assert.equal(data.items[0].status, 'needs_action');
  await tick(); assert.equal(data.writes.length, 1);
  data.writeError = null;
  assert.equal(await card.setItem('milk', true), true);
  const undo = compactUndo(card); assert(undo, 'Only a successful completion should offer Undo');
  data.writeError = new Error('connection lost');
  undo.dispatchEvent({ type: 'click' }); await tick();
  assert.equal(data.items[0].status, 'completed');
  assert.doesNotMatch(card._message.textContent, /Back on the list/);
  assert.match(card._errorNode.textContent, /wasn.t confirmed/);
  assert(compactUndo(card), 'Keep Undo available after a failed request');
  await tick(); assert.equal(data.writes.length, 3);
  data.writeError = null;
  compactUndo(card).dispatchEvent({ type: 'click' }); await tick();
  assert.equal(data.writes.length, 4);
  assert.equal(data.items[0].status, 'needs_action');
  assert.equal(compactUndo(card), undefined);
});

test('focus/visibility and entity timestamps request bounded refresh, unrelated state does not', async () => {
  const { card, data, window, document } = await setup(); card.connectedCallback(); await tick(); await tick(); const count = data.reads.length;
  card.hass = data.hass; await tick(); assert.equal(data.reads.length, count);
  data.hass.states[E].last_updated = '2'; card.hass = data.hass; await tick(); assert.equal(data.reads.length, count + 1);
  window.dispatchEvent({ type: 'focus' }); await tick(); assert.equal(data.reads.length, count + 2);
  document.visibilityState = 'hidden'; document.dispatchEvent({ type: 'visibilitychange' }); await tick(); assert.equal(data.reads.length, count + 2);
  document.visibilityState = 'visible'; document.dispatchEvent({ type: 'visibilitychange' }); await tick(); assert.equal(data.reads.length, count + 3); card.disconnectedCallback();
});

test('edit draft and caret survive shared updates without replacing the main add input', async () => {
  const { card } = await setup([entry('a', 'Milk')]); const addInput = card._input;
  card._editing = 'a'; card._editDraft = 'Milk'; card._focusEdit = true; card._render();
  card._editInput.value = 'Milk 2 cartons'; card._editInput.dispatchEvent({ type: 'input' }); card._editInput.setSelectionRange(4, 4);
  card._applyItems([entry('a', 'Milk'), entry('b', 'Bread')]);
  assert.equal(card._editInput.value, 'Milk 2 cartons'); assert.equal(card._editInput.selectionStart, 4); assert.equal(card._input, addInput);
});

test('configuration validates entity/links and contains no automatic example groceries', async () => {
  const { Card } = environment(); const card = new Card();
  assert.throws(() => card.setConfig({ entity: 'sensor.private' }), /to-do/);
  assert.throws(() => card.setConfig({ navigation_path: '//external.example' }), /local/);
  assert.throws(() => card.setConfig({ staples: [1] }), /names/);
  const { data } = await setup([], { staples: [] }); assert.equal(data.writes.length, 0);
});
