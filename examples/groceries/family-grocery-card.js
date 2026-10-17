/* Family groceries 1.0.1. Uses only the configured HA to-do entity.
 * Uses the Home Assistant to-do item service and subscription contracts.
 * No storage, external requests, timers, inventory model, or automatic list edits.
 */
(() => {
  "use strict";
  if (customElements.get("family-grocery-card")) return;
  const clean = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
  const normalize = (value) => clean(value).toLowerCase();
  const categories = ["Produce", "Dairy & eggs", "Meat & seafood", "Bakery", "Pantry", "Frozen", "Drinks", "Household", "Other"];
  const rules = [
    ["Frozen", /\b(frozen|ice cream|popsicles?|ice cubes?)\b/i],
    ["Household", /\b(toilet paper|paper towels?|tissues?|napkins?|soap|detergent|dishwasher|bleach|trash bags?|garbage bags?|shampoo|toothpaste|diapers?|wipes?|sponges?|foil|batteries)\b/i],
    ["Pantry", /\b(peanut butter|almond butter|broth|stock cubes?)\b/i],
    ["Produce", /\b(butter lettuce)\b/i],
    ["Dairy & eggs", /\b(milk|eggs?|cheese|yog[hu]rt|butter|cream|half and half|kefir)\b/i],
    ["Meat & seafood", /\b(chicken|beef|steak|pork|bacon|sausage|turkey|ham|lamb|salmon|tuna|shrimp|fish|seafood|ground meat)\b/i],
    ["Bakery", /\b(bread|bagels?|buns?|rolls?|tortillas?|pita|croissants?|muffins?|baguette|sourdough)\b/i],
    ["Drinks", /\b(water|juice|soda|sparkling|coffee|tea|beer|wine|lemonade|kombucha)\b/i],
    ["Produce", /\b(apples?|bananas?|oranges?|lemons?|limes?|berries|strawberries|blueberries|raspberries|grapes?|peaches?|pears?|melons?|avocados?|tomatoes?|potatoes?|onions?|garlic|lettuce|spinach|kale|carrots?|broccoli|cucumbers?|peppers?|zucchini|mushrooms?|celery|cabbage|cilantro|parsley|fruit|vegetables?|salad)\b/i],
    ["Pantry", /\b(rice|pasta|noodles?|beans?|lentils?|canned|sauce|salsa|flour|sugar|salt|pepper|spice|oil|vinegar|cereal|oats?|oatmeal|granola|nuts?|crackers?|chips?|peanut butter|jam|honey|soup|chocolate)\b/i],
  ];
  const category = (name) => rules.find(([, pattern]) => pattern.test(name))?.[0] || "Other";
  const validateItems = (items) => {
    if (!Array.isArray(items)) throw new Error("Unexpected list response");
    const seen = new Set();
    return items.map((item) => {
      if (!item || typeof item.uid !== "string" || !item.uid || seen.has(item.uid) ||
          typeof item.summary !== "string" || !["needs_action", "completed"].includes(item.status)) {
        throw new Error("Unexpected list item");
      }
      seen.add(item.uid);
      return { uid: item.uid, summary: item.summary, status: item.status };
    });
  };
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const css = `
    :host{display:block;font-family:var(--primary-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--primary-text-color,#f5f5f7)}
    *{box-sizing:border-box}ha-card{border-radius:24px;overflow:hidden;background:var(--ha-card-background,var(--card-background-color,#1c1c1e))}
    .shell{padding:22px}.top{display:flex;align-items:center;gap:12px;margin-bottom:16px}.titles{flex:1;min-width:0}h2{font-size:24px;letter-spacing:-.6px;margin:0;font-weight:650}.caption,.hint{font-size:13px;line-height:1.5;color:var(--secondary-text-color,#98989f);margin:5px 0 0}.badge{font-size:14px;white-space:nowrap;color:#0a84ff;background:rgba(10,132,255,.12);padding:7px 10px;border-radius:12px;font-weight:600}
    button,input{font:inherit}button,a,input{touch-action:manipulation}button{cursor:pointer;border:0}button:disabled{opacity:.42;cursor:default}button:focus-visible,input:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #0a84ff;outline-offset:3px}.refresh{font-size:25px;color:var(--secondary-text-color,#98989f);background:transparent;min-width:44px;min-height:44px;border-radius:12px}
    .add{display:flex;gap:8px}.add input,.edit input{min-width:0;flex:1;width:100%;font-size:16px;border:1px solid var(--divider-color,rgba(128,128,128,.25));border-radius:14px;padding:13px 14px;color:inherit;background:rgba(128,128,128,.09)}.primary{background:#0a84ff;color:white;font-size:15px;font-weight:650;border-radius:14px;min-width:64px;min-height:48px;padding:10px 14px}.label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
    .quick{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}.chip{color:var(--primary-text-color,#f5f5f7);background:rgba(128,128,128,.1);border:1px solid var(--divider-color,rgba(128,128,128,.14));padding:9px 12px;min-height:40px;font-size:14px;border-radius:999px}.chip.on{color:var(--secondary-text-color,#98989f)}
    .message{font-size:14px;line-height:1.5;margin:12px 0 0;color:var(--secondary-text-color,#98989f)}.message:empty{display:none}.error{color:var(--error-color,#ff6961)}.list{margin-top:16px}.group{margin-top:20px}.group:first-child{margin-top:0}.group h3{font-size:13px;margin:0 0 5px;letter-spacing:.025em;color:var(--secondary-text-color,#98989f);font-weight:600}.group h3 span{font-weight:400;margin-left:7px}
    .row{display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--divider-color,rgba(128,128,128,.13));min-height:56px}.check{flex:1;min-width:0;display:flex;gap:13px;align-items:center;padding:12px 2px;cursor:pointer;min-height:56px}.check input{appearance:none;-webkit-appearance:none;width:26px;height:26px;flex:0 0 26px;border:1.5px solid var(--secondary-text-color,#98989f);border-radius:50%;margin:0;background:transparent}.check input:checked{background:#0a84ff;border-color:#0a84ff}.check input:checked:after{content:"✓";display:block;color:white;font-weight:700;font-size:19px;line-height:23px;text-align:center}.name{font-size:17px;line-height:1.4;overflow-wrap:anywhere}.edit-button,.undo,.cancel{background:transparent;color:#0a84ff;min-height:44px;min-width:44px;padding:8px;font-size:14px;border-radius:10px}.edit{display:flex;gap:5px;align-items:center;width:100%;padding:7px 0}.edit .primary{min-width:54px;min-height:44px;padding:8px}.edit input{padding:10px;font-size:16px}.empty{padding:22px 4px;color:var(--secondary-text-color,#98989f);font-size:15px;line-height:1.6}.empty strong{display:block;font-size:19px;color:var(--primary-text-color,#f5f5f7);font-weight:600;margin-bottom:3px}
    .again{margin-top:22px}.again h3{font-size:17px;margin:0 0 9px;font-weight:600}.again .quick{margin:0}details{margin-top:22px;border-top:1px solid var(--divider-color,rgba(128,128,128,.14));padding-top:8px}summary{cursor:pointer;color:var(--secondary-text-color,#98989f);font-size:14px;padding:12px 0;min-height:44px}.bought{color:var(--secondary-text-color,#98989f);font-size:15px;flex:1;overflow-wrap:anywhere;padding:10px 0}.bought-name{text-decoration:line-through}.footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:17px}.footer a{color:#0a84ff;text-decoration:none;font-size:15px;padding:9px 0;min-height:44px}.footer small{color:var(--secondary-text-color,#98989f);font-size:12px}.compact .shell{padding:18px}.compact h2{font-size:21px}.compact .list{margin-top:12px}.compact .row:last-child{border-bottom:0}
    @media(max-width:400px){.shell{padding:18px}.top{gap:6px}h2{font-size:22px}.badge{padding:7px;font-size:13px}.refresh{min-width:38px}.name{font-size:16px}.edit-button{font-size:13px}.edit{flex-wrap:wrap}.edit input{flex-basis:calc(100% - 115px)}}
    @media(prefers-reduced-motion:no-preference){button{transition:opacity .12s ease,background .12s ease}}
  `;

  class FamilyGroceryCard extends HTMLElement {
    static normalize = normalize;
    static category = category;
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._items = []; this._loaded = false; this._busy = false; this._loading = false;
      this._error = ""; this._notice = ""; this._revision = 0; this._life = 0;
      this._subToken = 0; this._subscription = null; this._subConnection = null;
      this._readSequence = 0; this._readPromise = null; this._editing = null;
      this._lastCompletedUid = null;
      this._connected = false; this._queued = false; this._boughtOpen = false;
      this._onFocus = () => this._queueRefresh();
      this._onVisible = () => { if (document.visibilityState === "visible") this._queueRefresh(); };
    }
    setConfig(config) {
      const entity = config.entity || "todo.shopping_list";
      if (!/^todo\.[a-z0-9_]+$/.test(entity)) throw new Error("Choose a to-do list entity.");
      if (config.staples !== undefined && (!Array.isArray(config.staples) || config.staples.some((x) => typeof x !== "string"))) throw new Error("Staples must be a list of names.");
      const path = config.navigation_path || "/lovelace/groceries";
      if (!/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(path)) throw new Error("Navigation must use a local dashboard path.");
      this._resetConnection();
      this._config = { entity, title: clean(config.title || "Groceries"), compact: config.compact === true, navigation_path: path,
        staples: [...new Map((config.staples || ["Milk", "Eggs", "Bread", "Bananas", "Rice", "Toilet paper"]).map((x) => [normalize(x), clean(x)])).values()].filter(Boolean).slice(0, 8) };
      this._items = []; this._loaded = false; this._seenStamp = null; this._error = ""; this._notice = ""; this._editing = null;
      this._lastCompletedUid = null;
      this._buildDOM(); this._render(); this._queueRefresh();
    }
    set hass(hass) {
      const oldConnection = this._hass?.connection;
      this._hass = hass;
      if (!this._config) return;
      if (oldConnection && oldConnection !== hass.connection) this._resetConnection();
      const entity = hass.states?.[this._config.entity];
      const stamp = entity ? `${entity.last_updated}|${entity.last_changed}|${entity.state}` : "missing";
      const available = this._available();
      if (stamp !== this._seenStamp || available !== this._wasAvailable) {
        this._seenStamp = stamp; this._wasAvailable = available; this._queueRefresh(); this._render();
      }
    }
    connectedCallback() {
      this._connected = true;
      window.addEventListener("focus", this._onFocus);
      document.addEventListener("visibilitychange", this._onVisible);
      this._queueRefresh();
    }
    disconnectedCallback() {
      this._connected = false;
      window.removeEventListener("focus", this._onFocus);
      document.removeEventListener("visibilitychange", this._onVisible);
      this._resetConnection();
    }
    getCardSize() { return this._config?.compact ? 5 : 9; }
    getGridOptions() { return { columns: 12, rows: "auto", min_columns: 6 }; }
    _available() {
      const state = this._hass?.states?.[this._config?.entity];
      return !!state && !["unknown", "unavailable"].includes(state.state) && this._hass.connected !== false && this._hass.connection?.connected !== false;
    }
    _supports(feature) {
      const features = this._hass?.states?.[this._config?.entity]?.attributes?.supported_features;
      return features === undefined || !!(features & feature);
    }
    _disabled(feature = 4) { return this._busy || !this._available() || !this._loaded || !this._supports(feature); }
    _resetConnection() {
      this._life++; this._subToken++; this._readSequence++; this._readPromise = null; this._loading = false;
      if (this._subscription) { try { Promise.resolve(this._subscription()).catch(() => {}); } catch {} }
      this._subscription = null; this._subConnection = null;
    }
    _queueRefresh() {
      if (!this._connected || !this._config || !this._hass || !this._available()) return;
      if (this._busy) { this._dirty = true; return; }
      if (this._queued) return;
      this._queued = true;
      queueMicrotask(() => { this._queued = false; if (this._connected) void this.refresh(); });
    }
    _applyItems(items) {
      this._items = validateItems(items); this._revision++; this._loaded = true;
      if (!this._items.some((item) => item.uid === this._lastCompletedUid && item.status === "completed")) this._lastCompletedUid = null;
      this._error = ""; this._render();
    }
    async _subscribe() {
      const connection = this._hass?.connection;
      if (!this._connected || !connection?.subscribeMessage || this._subConnection === connection) return;
      const token = ++this._subToken;
      this._subConnection = connection;
      try {
        const unsubscribe = await connection.subscribeMessage((update) => {
          if (token !== this._subToken || !this._connected) return;
          try { this._applyItems(update.items); } catch { this._error = "The shared list could not refresh. Tap Refresh."; this._render(); }
        }, { type: "todo/item/subscribe", entity_id: this._config.entity });
        if (token !== this._subToken || !this._connected) { try { await unsubscribe(); } catch {} }
        else this._subscription = unsubscribe;
      } catch {
        // Older servers can still refresh on entity changes, app focus, and Refresh.
        if (token === this._subToken) { this._subscription = null; this._subConnection = null; }
      }
    }
    async refresh() {
      if (!this._available()) { this._render(); return false; }
      if (this._readPromise) return this._readPromise;
      const hass = this._hass, entity = this._config.entity, life = this._life;
      const sequence = ++this._readSequence, revision = this._revision;
      this._loading = true; this._render();
      const read = Promise.resolve().then(async () => {
        try {
          const result = await hass.callWS({ type: "call_service", domain: "todo", service: "get_items",
            target: { entity_id: entity }, service_data: { status: ["needs_action", "completed"] }, return_response: true });
          const items = validateItems(result?.response?.[entity]?.items);
          if (life !== this._life || sequence !== this._readSequence) return false;
          // A newer push wins over a slower one-shot response.
          if (revision === this._revision) this._applyItems(items);
          void this._subscribe();
          return true;
        } catch (error) {
          if (life === this._life) { this._error = error?.code === "unauthorized" ? "This account cannot open this list." : "Couldn’t refresh the shared list. Check your connection and tap Refresh."; }
          return false;
        } finally {
          if (life === this._life && sequence === this._readSequence) { this._loading = false; this._readPromise = null; this._render(); }
        }
      });
      this._readPromise = read;
      return read;
    }
    async _action(work) {
      if (this._busy || !this._available()) return false;
      this._busy = true; this._notice = ""; this._error = ""; this._render();
      const life = this._life;
      let saved = false;
      try {
        if (!await this.refresh() || life !== this._life) return false;
        saved = await work();
        if (saved && !await this.refresh()) this._error = "Saved, but the list could not refresh. Tap Refresh before making another change.";
        return saved;
      } catch (error) {
        this._error = error?.code === "unauthorized" ? "This account cannot change this list." : "Your change wasn’t confirmed. Refresh the list before trying again.";
        return false;
      } finally {
        this._busy = false;
        if (this._dirty) { this._dirty = false; this._queueRefresh(); }
        this._render();
      }
    }
    _write(service, data) { return this._hass.callService("todo", service, data, { entity_id: this._config.entity }); }
    async add(value) {
      const name = clean(value);
      if (!name || name.length > 200) { this._notice = name ? "Keep the item name under 200 characters." : "Type an item to add."; this._render(); return false; }
      const result = await this._action(async () => {
        const matches = this._items.filter((item) => normalize(item.summary) === normalize(name));
        if (matches.some((item) => item.status === "needs_action")) { this._notice = "Already on the list."; return false; }
        const bought = matches.find((item) => item.status === "completed");
        if (!this._supports(bought ? 4 : 1)) throw new Error("Unsupported action");
        await this._write(bought ? "update_item" : "add_item", bought ? { item: bought.uid, status: "needs_action" } : { item: name });
        this._notice = bought ? "Back on the list." : "Added to the shared list.";
        return true;
      });
      if (result && this._input?.value === value) this._input.value = "";
      return result;
    }
    async setItem(uid, completed) {
      return this._action(async () => {
        const item = this._items.find((entry) => entry.uid === uid);
        if (!item) { this._notice = "That item changed. The list has refreshed."; return false; }
        const status = completed ? "completed" : "needs_action";
        if (item.status === status) return false;
        if (!completed && this._items.some((entry) => entry.uid !== uid && entry.status === "needs_action" && normalize(entry.summary) === normalize(item.summary))) { this._notice = "Already on the list."; return false; }
        if (!this._supports(4)) throw new Error("Unsupported action");
        await this._write("update_item", { item: uid, status });
        if (completed) this._lastCompletedUid = uid;
        else if (this._lastCompletedUid === uid) this._lastCompletedUid = null;
        this._notice = completed ? (this._config.compact ? "Marked as bought." : "Marked as bought. You can undo below.") : "Back on the list.";
        return true;
      });
    }
    async rename(uid, value) {
      const name = clean(value);
      if (!name || name.length > 200) { this._notice = "Enter an item name under 200 characters."; this._render(); return false; }
      return this._action(async () => {
        const item = this._items.find((entry) => entry.uid === uid);
        if (!item) { this._notice = "That item changed. The list has refreshed."; return false; }
        if (this._items.some((entry) => entry.uid !== uid && entry.status === "needs_action" && normalize(entry.summary) === normalize(name))) { this._notice = "That item is already on the list."; return false; }
        if (!this._supports(4)) throw new Error("Unsupported action");
        await this._write("update_item", { item: uid, rename: name });
        this._editing = null; this._notice = "Item updated."; return true;
      });
    }
    _button(text, className, action, disabled = false) {
      const button = make("button", text, className); button.type = "button"; button.disabled = disabled;
      button.addEventListener("click", action); return button;
    }
    _buildDOM() {
      const style = make("style", css), card = make("ha-card"), shell = make("div", undefined, "shell");
      card.className = this._config.compact ? "compact" : "";
      const top = make("div", undefined, "top"), titles = make("div", undefined, "titles");
      titles.append(make("h2", this._config.title));
      if (!this._config.compact) titles.append(make("p", "One shared list for everyone.", "caption"));
      this._count = make("span", "", "badge");
      this._refresh = this._button("↻", "refresh", () => void this.refresh()); this._refresh.setAttribute("aria-label", "Refresh shared list");
      top.append(titles, this._count, this._refresh);
      const form = make("form", undefined, "add");
      this._input = make("input"); this._input.type = "text"; this._input.placeholder = "What do we need?"; this._input.maxLength = 200;
      this._input.setAttribute("aria-label", "Add a grocery, including amount if needed"); this._input.setAttribute("autocomplete", "off");
      this._addButton = make("button", "Add", "primary"); this._addButton.type = "submit";
      form.append(this._input, this._addButton);
      form.addEventListener("submit", (event) => { event.preventDefault(); void this.add(this._input.value); });
      this._quick = make("div", undefined, "quick");
      this._message = make("div", "", "message"); this._message.setAttribute("role", "status"); this._message.setAttribute("aria-live", "polite");
      this._errorNode = make("div", "", "message error"); this._errorNode.setAttribute("role", "alert");
      this._recentUndo = make("div");
      this._list = make("div", undefined, "list"); this._again = make("div", undefined, "again"); this._completed = make("div");
      shell.append(top, form);
      if (!this._config.compact) shell.append(make("p", "Include amounts in the name, like Milk 2 cartons.", "hint"), this._quick);
      shell.append(this._message, this._errorNode, this._recentUndo, this._list, this._again, this._completed);
      const footer = make("div", undefined, "footer");
      if (this._config.compact) {
        const link = make("a", "Open list →"); link.href = this._config.navigation_path;
        link.addEventListener("click", (event) => {
          if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          window.history.pushState({ from: window.location.pathname + window.location.search }, "", this._config.navigation_path);
          window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
        });
        footer.append(link);
      }
      footer.append(make("small", "One shared shopping list"));
      shell.append(footer); card.append(shell); this.shadowRoot.replaceChildren(style, card);
    }
    _row(item) {
      const row = make("div", undefined, "row");
      if (this._editing === item.uid && !this._config.compact) {
        const form = make("form", undefined, "edit"), input = make("input"); input.value = this._editDraft ?? item.summary; input.maxLength = 200; input.setAttribute("aria-label", "Edit grocery name");
        this._editInput = input;
        input.addEventListener("input", () => { this._editDraft = input.value; });
        const save = make("button", "Save", "primary"); save.type = "submit"; save.disabled = this._disabled();
        form.append(input, save, this._button("Cancel", "cancel", () => { this._editing = null; this._render(); }));
        form.addEventListener("submit", (event) => { event.preventDefault(); void this.rename(item.uid, input.value); });
        input.addEventListener("keydown", (event) => { if (event.key === "Escape") { this._editing = null; this._render(); } });
        row.append(form); return row;
      }
      const label = make("label", undefined, "check"), checkbox = make("input"); checkbox.type = "checkbox"; checkbox.disabled = this._disabled();
      checkbox.setAttribute("aria-label", `Mark ${item.summary} as bought`);
      checkbox.addEventListener("change", () => void this.setItem(item.uid, true));
      label.append(checkbox, make("span", item.summary, "name")); row.append(label);
      if (!this._config.compact) {
        const edit = this._button("Edit", "edit-button", () => { this._editing = item.uid; this._editDraft = item.summary; this._focusEdit = true; this._render(); }, this._disabled());
        edit.setAttribute("aria-label", `Edit ${item.summary}`); row.append(edit);
      }
      return row;
    }
    _render() {
      if (!this._config || !this._count) return;
      const editFocused = this._editInput && this.shadowRoot.activeElement === this._editInput;
      const selection = editFocused ? [this._editInput.selectionStart, this._editInput.selectionEnd] : null;
      const active = this._items.filter((item) => item.status === "needs_action"), bought = this._items.filter((item) => item.status === "completed");
      this._count.textContent = this._loaded ? `${active.length} to get` : "—";
      this._refresh.disabled = this._busy || this._loading || !this._available();
      this._addButton.disabled = this._busy || !this._available() || !this._loaded || (!this._supports(1) && !this._supports(4));
      this._input.disabled = !this._available();
      this._message.textContent = !this._available() ? (this._loaded ? "Offline · showing the last loaded list. Reconnect before making changes." : "The shared list is unavailable. Check the connection and tap Refresh.") : this._loading && !this._loaded ? "Loading your shared list…" : this._busy ? "Saving…" : this._notice;
      this._errorNode.textContent = this._error;
      this._recentUndo.replaceChildren();
      const recent = this._config.compact && bought.find((item) => item.uid === this._lastCompletedUid);
      if (recent) {
        const row = make("div", undefined, "row"), text = make("span", recent.summary, "bought bought-name");
        const undo = this._button("Undo", "undo", () => void this.setItem(recent.uid, false), this._disabled());
        undo.setAttribute("aria-label", `Undo bought: ${recent.summary}`);
        row.append(text, undo); this._recentUndo.append(row);
      }
      const known = new Set(active.map((item) => normalize(item.summary)));
      this._quick.replaceChildren(...this._config.staples.map((name) => {
        const on = known.has(normalize(name));
        return this._button(`${on ? "✓" : "+"} ${name}`, `chip${on ? " on" : ""}`, () => void this.add(name), on || this._disabled(1));
      }));
      const sections = [];
      if (this._loaded && !active.length) {
        const empty = make("div", undefined, "empty"); empty.append(make("strong", bought.length ? "All picked up" : "What do we need?"), make("span", bought.length ? (this._config.compact ? "Add the next thing you need, or tap Open list to buy an item again." : "Add the next thing you need, or bring an item back below.") : "Add an item above. Everyone sees the same list.")); sections.push(empty);
      } else if (this._config.compact) sections.push(...active.slice(0, 6).map((item) => this._row(item)));
      else for (const name of categories) {
        const group = active.filter((item) => category(item.summary) === name); if (!group.length) continue;
        const section = make("section", undefined, "group"), heading = make("h3", name); heading.append(make("span", String(group.length)));
        section.append(heading, ...group.map((item) => this._row(item))); sections.push(section);
      }
      this._list.replaceChildren(...sections); this._again.replaceChildren(); this._completed.replaceChildren();
      if (this._editing && this._editInput && (editFocused || this._focusEdit)) {
        this._focusEdit = false; this._editInput.focus();
        if (selection) this._editInput.setSelectionRange(...selection);
      }
      if (this._config.compact) return;
      const repeatedNames = new Set(known);
      const repeated = bought.filter((item) => {
        const name = normalize(item.summary);
        if (repeatedNames.has(name)) return false;
        repeatedNames.add(name); return true;
      }).slice(0, 6);
      if (repeated.length) {
        const chips = make("div", undefined, "quick"); chips.append(...repeated.map((item) => this._button(`+ ${item.summary}`, "chip", () => void this.setItem(item.uid, false), this._disabled())));
        this._again.append(make("h3", "Buy again"), chips);
      }
      if (bought.length) {
        const details = make("details"), summary = make("summary", `Bought · ${bought.length}`); details.open = this._boughtOpen;
        details.addEventListener("toggle", () => { this._boughtOpen = details.open; }); details.append(summary);
        for (const item of bought) {
          const row = make("div", undefined, "row"), text = make("span", item.summary, "bought bought-name");
          const undo = this._button("Undo", "undo", () => void this.setItem(item.uid, false), this._disabled()); undo.setAttribute("aria-label", `Undo bought: ${item.summary}`);
          row.append(text, undo); details.append(row);
        }
        this._completed.append(details);
      }
    }
  }
  customElements.define("family-grocery-card", FamilyGroceryCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "family-grocery-card", name: "Family groceries", description: "One shared grocery list, quick add, aisle groups, and buy again.", preview: false });
})();
