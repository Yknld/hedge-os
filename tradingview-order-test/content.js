(() => {
  'use strict';

  if (window.__tradingViewOrderTestLoaded) return;
  window.__tradingViewOrderTestLoaded = true;

  const LOG = '[TV Bridge]';
  const EXECUTION_PROTOCOL_VERSION = 2;
  const WAIT_TIMEOUT_MS = 6000;
  const SETTLE_MS = 150;

  const log = (...args) => console.log(LOG, ...args);
  const warn = (...args) => console.warn(LOG, ...args);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function directBrokerCommand(payload, timeoutMs = 12000) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { window.removeEventListener('hedge-os-direct-result', onResult); reject(new Error('DIRECT_BROKER_TIMEOUT')); }, timeoutMs);
      const onResult = event => { try { const value = JSON.parse(String(event.detail || '')); if (value.id !== id) return; clearTimeout(timer); window.removeEventListener('hedge-os-direct-result', onResult); if (!value.ok) reject(new Error(value.error || 'DIRECT_BROKER_FAILED')); else resolve(value.data); } catch (_) {} };
      window.addEventListener('hedge-os-direct-result', onResult);
      window.dispatchEvent(new CustomEvent('hedge-os-direct-command', { detail: JSON.stringify({ ...payload, id }) }));
    });
  }

  function isTradingViewChart() {
    return (location.hostname === 'tradingview.com' || location.hostname.endsWith('.tradingview.com')) &&
      location.pathname.startsWith('/chart/');
  }

  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' &&
      Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
  }

  async function waitFor(find, description, timeoutMs = WAIT_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs;
    do {
      const result = find();
      if (result) return result;
      await sleep(100);
    } while (Date.now() < deadline);
    throw new Error(`Could not find ${description}`);
  }

  function normalizedText(element) {
    return (element?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function findVisible(selector, root = document) {
    return Array.from(root.querySelectorAll(selector)).find(isVisible) || null;
  }

  function describeControls(root) {
    const controls = Array.from(root.querySelectorAll('button, input, [role="button"], [role="tab"]'))
      .filter(isVisible)
      .slice(0, 80)
      .map((element) => ({
        tag: element.tagName,
        text: normalizedText(element).slice(0, 80),
        dataName: element.getAttribute('data-name'),
        dataRole: element.getAttribute('data-role'),
        qa: element.getAttribute('data-qa-id'),
        role: element.getAttribute('role'),
        ariaLabel: element.getAttribute('aria-label'),
        ariaSelected: element.getAttribute('aria-selected'),
        ariaPressed: element.getAttribute('aria-pressed'),
        name: element.getAttribute('name'),
        placeholder: element.getAttribute('placeholder'),
        type: element.getAttribute('type'),
        value: element instanceof HTMLInputElement ? element.value : undefined
      }));
    console.table(controls);
  }

  function fail(message, root = document) {
    warn(message);
    warn('Visible DOM controls at failure point:');
    describeControls(root);
    throw new Error(message);
  }

  function findExactTextControl(root, text) {
    const wanted = text.toLowerCase();
    const candidates = Array.from(root.querySelectorAll('button, [role="button"], [role="tab"]'))
      .filter(isVisible)
      .filter((element) => normalizedText(element).toLowerCase() === wanted);
    return candidates.length === 1 ? candidates[0] : null;
  }

  function findTradingPanel() {
    return findVisible('[aria-label="Trading panel"]') ||
      findVisible('.layout__area--tradingpanel');
  }

  async function openTradingPanel() {
    let panel = findTradingPanel();
    if (panel) {
      log('Trading panel found');
      return panel;
    }

    const tradeButton = findVisible('[data-qa-id="trade-button"]');
    if (!tradeButton) fail('Could not find TradingView Trade button');

    log('Opening Trading panel');
    tradeButton.click();
    panel = await waitFor(findTradingPanel, 'visible TradingView trading panel');
    log('Trading panel found');
    return panel;
  }

  async function openOrderTicket(panel) {
    if (findVisible('[data-name="side-control-buy"]', panel) &&
        findVisible('[data-name="side-control-sell"]', panel)) {
      log('Order ticket already open');
      return;
    }

    const orderControl = findExactTextControl(panel, 'Order') ||
      findVisible('[data-name="order-ticket-tab"], [data-name="order-tab"]', panel);
    if (orderControl) {
      log('Opening Order ticket');
      orderControl.click();
    }

    try {
      await waitFor(
        () => findVisible('[data-name="side-control-buy"]', panel) &&
          findVisible('[data-name="side-control-sell"]', panel),
        'TradingView BUY/SELL controls'
      );
    } catch (_) {
      const connectControl = Array.from(panel.querySelectorAll('button, [role="button"]'))
        .filter(isVisible)
        .find((element) => /connect/i.test(normalizedText(element)));
      if (connectControl) fail('No broker appears to be connected in TradingView', panel);
      fail('Could not open the TradingView order ticket; verify that a broker is connected', panel);
    }
  }

  function semanticSelectionState(element) {
    if (!element) return false;
    if (element.matches(':checked')) return true;
    if (element.querySelector('input:checked')) return true;
    return element.getAttribute('aria-pressed') === 'true' ||
      element.getAttribute('aria-selected') === 'true' ||
      element.getAttribute('data-active') === 'true' ||
      ['active', 'checked', 'selected'].includes(element.getAttribute('data-state'));
  }

  function snapshotState(element) {
    return {
      className: element?.className || '',
      ariaPressed: element?.getAttribute('aria-pressed'),
      ariaSelected: element?.getAttribute('aria-selected'),
      dataState: element?.getAttribute('data-state'),
      dataActive: element?.getAttribute('data-active')
    };
  }

  function stateChanged(before, element) {
    const after = snapshotState(element);
    return Object.keys(after).some((key) => after[key] !== before[key]);
  }

  function ticketSubmitCandidates(panel) {
    const selectors = [
      '[data-name="submit-button"]',
      '[data-qa-id="submit-button"]',
      '[data-role="submit-order"]',
      'button[type="submit"]'
    ];
    const unique = new Set();
    const candidates = [];
    for (const selector of selectors) {
      for (const element of panel.querySelectorAll(selector)) {
        if (!isVisible(element) || unique.has(element)) continue;
        unique.add(element);
        candidates.push(element);
      }
    }
    for (const element of panel.querySelectorAll('button, [role="button"]')) {
      if (!isVisible(element) || unique.has(element)) continue;
      if (/side-control/i.test(element.getAttribute('data-name') || '')) continue;
      if (/^(place\s+)?(buy|sell)\b/i.test(normalizedText(element))) {
        unique.add(element);
        candidates.push(element);
      }
    }
    return candidates;
  }

  function ticketReflectsSide(panel, side) {
    const expected = side === 'BUY' ? /^(place\s+)?buy\b/i : /^(place\s+)?sell\b/i;
    return ticketSubmitCandidates(panel).some((element) => expected.test(normalizedText(element)));
  }

  function ticketReflectsOrderType(panel, orderType) {
    const expected = new RegExp(`\\b${orderType}\\b`, 'i');
    return ticketSubmitCandidates(panel).some((element) => expected.test(normalizedText(element)));
  }

  async function selectSide(panel, side) {
    const target = findVisible(`[data-name="side-control-${side.toLowerCase()}"]`, panel);
    const opposite = findVisible(`[data-name="side-control-${side === 'BUY' ? 'sell' : 'buy'}"]`, panel);
    if (!target || !opposite) fail(`Could not find TradingView ${side} side control`, panel);

    if (semanticSelectionState(target) || ticketReflectsSide(panel, side)) {
      log(`${side} already selected`);
      return;
    }

    const beforeTarget = snapshotState(target);
    const beforeOpposite = snapshotState(opposite);
    target.click();
    try {
      await waitFor(() => semanticSelectionState(target) || ticketReflectsSide(panel, side) ||
        stateChanged(beforeTarget, target) || stateChanged(beforeOpposite, opposite),
      `${side} to become the selected side`, 1500);
    } catch (_) {
      fail(`Clicked ${side}, but could not verify the selected side`, panel);
    }
    log(`${side} selected`);
  }

  async function selectOrderType(panel, orderType) {
    const lowerType = orderType.toLowerCase();
    const selectors = [
      `[data-name="order-type-${lowerType}"]`,
      `[data-name="${lowerType}"]`,
      `[data-value="${lowerType}"]`,
      `[value="${lowerType}"]`
    ];
    let control = selectors.map((selector) => findVisible(selector, panel)).find(Boolean) ||
      findExactTextControl(panel, orderType === 'STOP' ? 'Stop' : orderType === 'MARKET' ? 'Market' : 'Limit');
    if (!control) fail(`Could not find TradingView ${orderType} order-type control`, panel);

    const before = snapshotState(control);
    const alreadySelected = semanticSelectionState(control) || ticketReflectsOrderType(panel, orderType);
    if (!alreadySelected) {
      control.click();
      try {
        await waitFor(() => {
          control = selectors.map((selector) => findVisible(selector, panel)).find(Boolean) || control;
          return semanticSelectionState(control) || ticketReflectsOrderType(panel, orderType) ||
            stateChanged(before, control);
        }, `${orderType} to become the selected order type`, 1500);
      } catch (_) {
        fail(`Clicked ${orderType}, but could not verify it as the selected order type`, panel);
      }
    }

    if (!semanticSelectionState(control) && !ticketReflectsOrderType(panel, orderType) &&
        !stateChanged(before, control)) {
      fail(`Clicked ${orderType}, but could not verify it as the selected order type`, panel);
    }
    log(`${orderType} selected`);
  }

  function parsePriceFromText(text) {
    const matches = String(text || '').match(/[-+]?\d[\d\s,.]*/g) || [];
    const values = matches
      .map((match) => Number(match.replace(/[\s,]/g, '')))
      .filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? values[values.length - 1] : null;
  }

  function readQuoteFromControl(control) {
    if (!control) return null;

    const semanticPrice = Array.from(control.querySelectorAll(
      '[data-name*="price" i], [data-role*="price" i], [aria-label*="price" i]'
    )).filter(isVisible);

    for (const element of semanticPrice) {
      const value = parsePriceFromText(element.textContent || element.getAttribute('aria-label'));
      if (value != null) return value;
    }
    return parsePriceFromText(normalizedText(control));
  }

  function readCurrentMarket(panel, side) {
    const buyControl = findVisible('[data-name="side-control-buy"]', panel);
    const sellControl = findVisible('[data-name="side-control-sell"]', panel);
    if (!buyControl || !sellControl) fail('Could not find TradingView live BUY/SELL quote controls', panel);

    const ask = readQuoteFromControl(buyControl);
    const bid = readQuoteFromControl(sellControl);
    const currentPrice = side === 'BUY' ? ask : bid;
    if (!Number.isFinite(currentPrice)) {
      fail(`Could not read the current ${side === 'BUY' ? 'ask' : 'bid'} price from TradingView`, panel);
    }

    log('Current TradingView market read', { bid, ask, comparisonPrice: currentPrice, side });
    return { bid, ask, currentPrice };
  }

  function getOrderType(side, entryPrice, currentPrice) {
    if (!Number.isFinite(entryPrice) || !Number.isFinite(currentPrice)) {
      throw new Error('A valid entry price and executable market quote are required');
    }
    // An at-BBO entry must remain price-capped. A BUY LIMIT at the ask (or a
    // SELL LIMIT at the bid) is immediately executable, but unlike a market
    // order it cannot chase price while this UI-driven submission completes.
    // Do not return MARKET here: paired execution is allowed to miss/hold,
    // but must never turn an intended price into uncapped slippage.
    if (Math.abs(entryPrice - currentPrice) <= 0.125) return 'LIMIT';
    if (side === 'BUY') return entryPrice > currentPrice ? 'STOP' : 'LIMIT';
    return entryPrice < currentPrice ? 'STOP' : 'LIMIT';
  }

  function readCurrentSymbol(panel) {
    if (!panel) return null;
    const ticker = /(?:^|[^A-Z0-9])((NQ|MNQ|MBT)(?:[FGHJKMNQUVXZ]\d{1,4}|[12]!)?)(?=$|[^A-Z0-9])/i;
    const candidates = Array.from(panel.querySelectorAll(
      'input, [data-symbol], [data-name*="symbol" i], button, [role="button"], [role="heading"], span, div'
    )).filter(isVisible).map((element) => {
      const values = [
        element instanceof HTMLInputElement ? element.value : '',
        normalizedText(element),
        element.getAttribute('data-symbol') || '',
        element.getAttribute('aria-label') || ''
      ];
      const match = values.map((value) => value.trim().match(ticker)).find(Boolean);
      return match ? { element, displayed: match[1].toUpperCase(), root: match[2].toUpperCase() } : null;
    }).filter(Boolean);

    // The trading-panel header is the highest exact ticker inside the panel,
    // directly above the Order / DOM tabs. Ignore all chart and page metadata.
    candidates.sort((a, b) => {
      const aRect = a.element.getBoundingClientRect();
      const bRect = b.element.getBoundingClientRect();
      return aRect.top - bRect.top || aRect.left - bRect.left;
    });
    const current = candidates[0];
    if (!current) return null;
    return current.root ? { root: current.root, displayed: current.displayed, source: 'trading-panel-root-token' } : null;
  }

  function verifyRequestedSymbol(panel, requestedSymbol) {
    const current = readCurrentSymbol(panel);
    if (!current) {
      const error = new Error('Could not read the current TradingView chart/order-ticket symbol');
      error.code = 'SYMBOL_NOT_FOUND';
      throw error;
    }
    if (current.root !== requestedSymbol) {
      const error = new Error(`Requested ${requestedSymbol}, but TradingView is showing ${current.displayed}`);
      error.code = 'SYMBOL_MISMATCH';
      error.requested = requestedSymbol;
      error.current = current.displayed;
      throw error;
    }
    log('Symbol verified', current.displayed);
    return current.displayed;
  }

  function fieldMetadata(input) {
    const parts = [
      input.name,
      input.id,
      input.getAttribute('aria-label'),
      input.getAttribute('placeholder'),
      input.getAttribute('data-name'),
      input.closest('[data-name]')?.getAttribute('data-name')
    ];
    if (input.id) {
      const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      parts.push(normalizedText(label));
    }
    const wrappingLabel = input.closest('label');
    parts.push(normalizedText(wrappingLabel));
    const semanticParent = input.closest('[data-name], [data-role], [role="group"]');
    parts.push(normalizedText(semanticParent).slice(0, 120));
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function findOrderInput(panel, kind, expectedValue = null) {
    const patterns = kind === 'quantity'
      ? [/\bquantity\b/, /\bqty\b/, /\bamount\b/, /\bcontracts?\b/]
      : [/\b(stop|limit)[ _-]?price\b/, /\btrigger[ _-]?price\b/, /\border[ _-]?price\b/, /^price$/];

    const directSelectors = kind === 'quantity'
      ? [
          'input[name="quantity"]', 'input[name="qty"]',
          '[data-name="quantity"] input', '[data-name="qty"] input',
          'input[data-name="quantity"]', 'input[aria-label*="Quantity" i]'
        ]
      : [
          'input[name="stopPrice"]', 'input[name="limitPrice"]', 'input[name="price"]',
          '[data-name="stop-price"] input', '[data-name="trigger-price"] input',
          '[data-name="limit-price"] input', '[data-name="price"] input',
          'input[data-name="stop-price"]', 'input[data-name="limit-price"]',
          'input[aria-label*="Stop price" i]', 'input[aria-label*="Limit price" i]',
          'input[aria-label="Price" i]', 'input[aria-label*="Ask" i]',
          'input[aria-label*="Bid" i]', 'input[placeholder*="Price" i]'
        ];

    for (const selector of directSelectors) {
      const match = findVisible(selector, panel);
      if (match) return match;
    }

    const scored = Array.from(panel.querySelectorAll('input'))
      .filter(isVisible)
      .map((input) => {
        const metadata = fieldMetadata(input);
        const score = patterns.reduce((total, pattern, index) =>
          total + (pattern.test(metadata) ? 10 - index : 0), 0);
        return { input, metadata, score };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return null;
    if (scored.length > 1 && scored[0].score === scored[1].score) {
      warn(`Ambiguous ${kind} inputs`, scored.slice(0, 5));
      return null;
    }
    return scored[0].input;
  }

  function setReactInputValue(input, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!valueSetter) throw new Error('Browser native input value setter is unavailable');

    input.focus();
    valueSetter.call(input, String(value));
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: 'insertText',
      data: String(value)
    }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    input.blur();
  }

  function numericValuesEqual(actual, expected) {
    const normalized = String(actual).replace(/[^0-9.+-]/g, '');
    const parsed = Number(normalized);
    const tolerance = Math.max(1e-9, Math.abs(Number(expected)) * 1e-10);
    return Number.isFinite(parsed) && Math.abs(parsed - Number(expected)) <= tolerance;
  }

  async function setAndVerifyInput(panel, kind, value) {
    let input = findOrderInput(panel, kind, value);
    // TradingView's current Ironbeam ticket sometimes exposes the active Stop
    // or Limit field without a stable name/data-name/aria label. At this point
    // exits are still collapsed, so the only large, editable numeric input in
    // the order form is the entry-price control. Use the requested price only
    // as a deterministic tie-breaker, never as a blind DOM index.
    if (!input && kind === 'price') {
      // Switching Market/Limit/Stop causes TradingView to replace the ticket
      // subtree asynchronously.  The new Price control may not exist during
      // the first probe even though the order type is already visually active.
      // Re-scan briefly before falling back to structural matching.
      try {
        input = await waitFor(
          () => findOrderInput(panel, 'price', value),
          'TradingView entry-price input after order-type change',
          1200
        );
      } catch (_) {
        // The current ticket sometimes has no stable field metadata, so use
        // the conservative structural recovery below.
      }
    }
    if (!input && kind === 'price') {
      const fallback = Array.from(panel.querySelectorAll('input'))
        .filter(isVisible)
        .filter((candidate) => !candidate.disabled && !candidate.readOnly)
        .map((candidate) => {
          const raw = String(candidate.value || '').replace(/[^0-9.+-]/g, '');
          const numeric = Number(raw);
          const metadata = fieldMetadata(candidate);
          const ancestors = [];
          for (let node = candidate.parentElement, depth = 0; node && node !== panel && depth < 4; depth += 1, node = node.parentElement) {
            ancestors.push(normalizedText(node));
          }
          const context = ancestors.join(' ').toLowerCase();
          const semanticScore = /\b(price|stop|limit|ask|bid)\b/.test(`${metadata} ${context}`) ? 100 : 0;
          // A fresh TradingView Limit/Stop ticket can render the editable
          // price field as 0.00 until a side/order type finishes mounting.
          // Zero is acceptable only for a semantically identified price
          // control; an unlabeled zero must never win structural recovery.
          const isPlausiblePrice = Number.isFinite(numeric) && numeric >= 0 &&
            (numeric >= 1000 || semanticScore > 0);
          const distance = Number.isFinite(value)
            ? Math.abs(numeric - Number(value))
            : Number.POSITIVE_INFINITY;
          return { candidate, numeric, semanticScore, distance, isPlausiblePrice };
        })
        .filter((candidate) => candidate.isPlausiblePrice)
        .sort((a, b) => b.semanticScore - a.semanticScore || a.distance - b.distance);
      if (fallback.length && (fallback.length === 1 || fallback[0].semanticScore > fallback[1].semanticScore || fallback[0].distance < fallback[1].distance)) {
        input = fallback[0].candidate;
        log('Recovered unlabeled TradingView entry-price input', {
          value: fallback[0].numeric,
          expectedValue: value,
          semanticScore: fallback[0].semanticScore
        });
      }
    }
    if (!input) fail(`Could not find TradingView ${kind === 'quantity' ? 'quantity' : 'entry price'} input`, panel);

    setReactInputValue(input, value);
    await sleep(SETTLE_MS);
    if (!numericValuesEqual(input.value, value)) {
      fail(`TradingView ${kind} input read-back failed: expected ${value}, got ${input.value}`, panel);
    }
    log(`${kind === 'quantity' ? 'Quantity' : 'Price'} set to ${value}`);
    return input;
  }

  function findQuantityUnitControl(panel) {
    const quantityInput = findOrderInput(panel, 'quantity');
    if (!quantityInput) return null;
    const unitPattern = /^(units?|usd margin|% balance|risk, usd|risk, % balance)$/i;

    let node = quantityInput.parentElement;
    for (let depth = 0; node && node !== panel && depth < 7; depth += 1, node = node.parentElement) {
      const candidates = Array.from(node.querySelectorAll(
        'button, [role="button"], [aria-haspopup], [tabindex]'
      )).filter(isVisible).filter((element) => unitPattern.test(normalizedText(element)));
      const unique = [...new Set(candidates.map(clickableFor))].filter(Boolean);
      if (unique.length === 1) return unique[0];
    }
    return null;
  }

  function quantityModeIsUnits(control) {
    if (!control) return false;
    return /^units?$/i.test(normalizedText(control)) ||
      /^units?$/i.test(control.getAttribute('data-value') || '') ||
      /^units?$/i.test(control.getAttribute('aria-label') || '');
  }

  async function selectQuantityUnits(panel) {
    let modeControl = findQuantityUnitControl(panel);
    if (!modeControl) fail('Could not find the TradingView quantity unit selector', panel);
    if (quantityModeIsUnits(modeControl)) {
      log('Quantity mode already set to Units');
      return;
    }

    const before = new Set(exactTextClickables(document, 'Units'));
    modeControl.click();
    await sleep(SETTLE_MS);
    const unitsOptions = await waitFor(() => {
      const newlyVisible = exactTextClickables(document, 'Units').filter((element) => !before.has(element));
      return newlyVisible.length === 1 ? newlyVisible : null;
    }, 'TradingView Units quantity menu option');
    unitsOptions[0].click();
    await sleep(SETTLE_MS);

    modeControl = findQuantityUnitControl(panel);
    if (!quantityModeIsUnits(modeControl)) fail('TradingView quantity mode did not switch to Units', panel);
    log('Quantity mode set to Units');
  }

  function deepestExactTextElements(root, text) {
    const wanted = text.toLowerCase();
    return Array.from(root.querySelectorAll('*'))
      .filter(isVisible)
      .filter((element) => normalizedText(element).toLowerCase() === wanted)
      .filter((element) => !Array.from(element.children).some(
        (child) => isVisible(child) && normalizedText(child).toLowerCase() === wanted
      ));
  }

  function clickableFor(element) {
    return element?.closest(
      'button, [role="button"], [role="tab"], [role="option"], [role="menuitem"], [tabindex]'
    ) || element;
  }

  function exactTextClickables(root, text) {
    const unique = new Set();
    return deepestExactTextElements(root, text)
      .map(clickableFor)
      .filter((element) => {
        if (!element || !isVisible(element) || unique.has(element)) return false;
        unique.add(element);
        return true;
      });
  }

  async function expandExits(panel) {
    const panelText = normalizedText(panel);
    if (/take profit/i.test(panelText) && /stop loss/i.test(panelText)) {
      log('Exits already expanded');
      return;
    }

    const exitsControls = exactTextClickables(panel, 'Exits');
    if (exitsControls.length !== 1) fail('Could not uniquely identify the TradingView Exits control', panel);
    exitsControls[0].click();

    await waitFor(() => {
      const text = normalizedText(panel);
      return /take profit/i.test(text) && /stop loss/i.test(text);
    }, 'expanded TradingView Exits section');
    log('Exits expanded');
  }

  function findExitModeControl(panel, kind) {
    const pattern = kind === 'tp' ? /^take profit(?:,|$)/i : /^stop loss(?:,|$)/i;
    const semanticCandidates = Array.from(panel.querySelectorAll(
      'button, [role="button"], [aria-haspopup], [tabindex]'
    )).filter(isVisible).filter((element) => pattern.test(normalizedText(element)));
    if (semanticCandidates.length === 1) return semanticCandidates[0];

    const textMatches = Array.from(panel.querySelectorAll('*'))
      .filter(isVisible)
      .filter((element) => pattern.test(normalizedText(element)))
      .filter((element) => !Array.from(element.children).some(
        (child) => isVisible(child) && pattern.test(normalizedText(child))
      ));
    const controls = [...new Set(textMatches.map(clickableFor).filter((element) => element && isVisible(element)))];
    return controls.length === 1 ? controls[0] : null;
  }

  function findExitRow(panel, kind) {
    const modeControl = findExitModeControl(panel, kind);
    if (!modeControl) return null;
    const otherPattern = kind === 'tp' ? /stop loss/i : /take profit/i;

    let node = modeControl;
    for (let depth = 0; node && node !== panel && depth < 8; depth += 1, node = node.parentElement) {
      const hasToggle = node.querySelector('input[type="checkbox"], [role="switch"]');
      const hasValueInput = node.querySelector('input:not([type="checkbox"]), [contenteditable="true"]');
      if (hasToggle && hasValueInput && !otherPattern.test(normalizedText(node))) {
        return { row: node, modeControl };
      }
    }
    return null;
  }

  function findToggle(row) {
    return row.querySelector('[role="switch"]') || row.querySelector('input[type="checkbox"]');
  }

  function toggleIsEnabled(toggle) {
    if (!toggle) return false;
    return toggle.checked === true || toggle.getAttribute('aria-checked') === 'true' ||
      toggle.getAttribute('data-state') === 'checked' || toggle.getAttribute('data-active') === 'true';
  }

  async function enableExit(panel, kind) {
    const label = kind === 'tp' ? 'Take Profit' : 'Stop Loss';
    let found = findExitRow(panel, kind);
    if (!found) fail(`Could not identify the TradingView ${label} row`, panel);
    let toggle = findToggle(found.row);
    if (!toggle) fail(`Could not find the ${label} toggle`, found.row);

    if (!toggleIsEnabled(toggle)) {
      const clickTarget = toggle.closest('label, button, [role="switch"]') || toggle;
      clickTarget.click();
      await sleep(SETTLE_MS);
      found = findExitRow(panel, kind);
      toggle = found && findToggle(found.row);
    }
    if (!toggleIsEnabled(toggle)) fail(`${label} toggle did not enable`, found?.row || panel);
    log(`${label} enabled`);
  }

  function exitModeIsPrice(modeControl) {
    return /,\s*price\b/i.test(normalizedText(modeControl)) ||
      modeControl.getAttribute('data-value')?.toLowerCase() === 'price' ||
      modeControl.getAttribute('aria-label')?.toLowerCase().includes('price');
  }

  async function setExitPriceMode(panel, kind) {
    const label = kind === 'tp' ? 'Take Profit' : 'Stop Loss';
    let modeControl = findExitModeControl(panel, kind);
    if (!modeControl) fail(`Could not find the ${label} unit selector`, panel);
    if (exitModeIsPrice(modeControl)) {
      log(`${kind === 'tp' ? 'TP' : 'SL'} already in price mode`);
      return;
    }

    const before = new Set(exactTextClickables(document, 'Price'));
    modeControl.click();
    await sleep(SETTLE_MS);

    const priceOptions = await waitFor(() => {
      const newlyVisible = exactTextClickables(document, 'Price').filter((element) => !before.has(element));
      return newlyVisible.length === 1 ? newlyVisible : null;
    }, `${label} Price menu option`);
    priceOptions[0].click();
    await sleep(SETTLE_MS);

    modeControl = findExitModeControl(panel, kind);
    if (!modeControl || !exitModeIsPrice(modeControl)) fail(`${label} did not switch to price mode`, panel);
    log(`${kind === 'tp' ? 'TP' : 'SL'} set to price mode`);
  }

  function findExitPriceInput(panel, kind) {
    const found = findExitRow(panel, kind);
    if (!found) return null;
    const directSelectors = [
      '[data-name="price"] input',
      '[data-name*="price" i] input',
      'input[name*="price" i]',
      'input[aria-label*="price" i]'
    ];
    for (const selector of directSelectors) {
      const candidate = findVisible(selector, found.row);
      if (candidate) return candidate;
    }
    const candidates = Array.from(found.row.querySelectorAll('input:not([type="checkbox"])')).filter(isVisible);
    return candidates.length === 1 ? candidates[0] : null;
  }

  async function setExitPrice(panel, kind, value) {
    const label = kind === 'tp' ? 'Take Profit' : 'Stop Loss';
    const input = findExitPriceInput(panel, kind);
    if (!input) fail(`Could not uniquely identify the ${label} price input`, panel);
    setReactInputValue(input, value);
    await sleep(SETTLE_MS);
    if (!numericValuesEqual(input.value, value)) {
      fail(`${label} field did not update correctly: expected ${value}, got ${input.value}`, panel);
    }
    log(`${kind === 'tp' ? 'TP' : 'SL'} price set to ${value}`);
    return input;
  }

  function verifyExit(panel, kind, expectedValue) {
    const label = kind === 'tp' ? 'Take Profit' : 'Stop Loss';
    const found = findExitRow(panel, kind);
    const toggle = found && findToggle(found.row);
    const input = found && findExitPriceInput(panel, kind);
    if (!found || !toggleIsEnabled(toggle)) throw new Error(`${label} is not enabled during final verification`);
    if (!exitModeIsPrice(found.modeControl)) throw new Error(`${label} is not in price mode during final verification`);
    if (!input || !numericValuesEqual(input.value, expectedValue)) {
      throw new Error(`${label} price failed final verification`);
    }
  }

  function findSubmitButton(panel, side) {
    const expected = side === 'BUY' ? /^(place\s+)?buy\b/i : /^(place\s+)?sell\b/i;
    const candidates = ticketSubmitCandidates(panel)
      .filter((element) => expected.test(normalizedText(element)));
    return candidates.length === 1 ? candidates[0] : null;
  }

  async function placeBracketOrder(order) {
    log('Received order', order);
    if (!isTradingViewChart()) throw new Error('This page is not a TradingView chart');
    if (!['BUY', 'SELL'].includes(order.side)) throw new Error('Side must be BUY or SELL');
    if (!['NQ', 'MNQ', 'MBT'].includes(order.symbol)) throw new Error('Only NQ, MNQ and MBT are supported');
    if (!Number.isFinite(order.quantity) || order.quantity <= 0) throw new Error('Quantity must be greater than zero');
    if (!Number.isFinite(order.entryPrice) || order.entryPrice <= 0) throw new Error('Entry price must be greater than zero');
    if (!Number.isFinite(order.takeProfit) || order.takeProfit <= 0) throw new Error('Take Profit must be greater than zero');
    if (!Number.isFinite(order.stopLoss) || order.stopLoss <= 0) throw new Error('Stop Loss must be greater than zero');

    const panel = await openTradingPanel();
    await openOrderTicket(panel);
    verifyRequestedSymbol(panel, order.symbol);
    const market = readCurrentMarket(panel, order.side);
    const orderType = getOrderType(order.side, order.entryPrice, market.currentPrice);
    const directType = orderType === 'STOP' ? 3 : 1;
    const currentContract = readCurrentSymbol(panel)?.displayed || order.symbol;
    const direct = await directBrokerCommand({ action: 'place', order: { symbol: `CME_MINI:${currentContract}`, side: order.side === 'BUY' ? 1 : -1, qty: order.quantity, type: directType, ...(directType === 3 ? { stopPrice: order.entryPrice } : { limitPrice: order.entryPrice }), takeProfit: order.takeProfit, stopLoss: order.stopLoss } });
    return { success: true, executionProtocolVersion: EXECUTION_PROTOCOL_VERSION, message: `${order.side} ${orderType} submitted through direct broker`, side: order.side, quantity: order.quantity, entryPrice: order.entryPrice, orderType, takeProfit: order.takeProfit, stopLoss: order.stopLoss, direct };
    log('Order type selected from market relationship', {
      side: order.side,
      entryPrice: order.entryPrice,
      currentPrice: market.currentPrice,
      orderType
    });
    await selectSide(panel, order.side);
    await selectOrderType(panel, orderType);
    await selectQuantityUnits(panel);
    const quantityInput = await setAndVerifyInput(panel, 'quantity', order.quantity);
    // Every entry is price-capped: limit and stop orders must round-trip the
    // exact requested trigger/limit price.
    const priceInput = await setAndVerifyInput(panel, 'price', order.entryPrice);
    await expandExits(panel);
    await enableExit(panel, 'tp');
    await setExitPriceMode(panel, 'tp');
    const tpInput = await setExitPrice(panel, 'tp', order.takeProfit);
    await enableExit(panel, 'sl');
    await setExitPriceMode(panel, 'sl');
    const slInput = await setExitPrice(panel, 'sl', order.stopLoss);

    if (!numericValuesEqual(quantityInput.value, order.quantity) ||
        (priceInput && !numericValuesEqual(priceInput.value, order.entryPrice)) ||
        !numericValuesEqual(tpInput.value, order.takeProfit) ||
        !numericValuesEqual(slInput.value, order.stopLoss)) {
      fail('Final order-value verification failed', panel);
    }
    if (!quantityModeIsUnits(findQuantityUnitControl(panel))) {
      fail('Quantity is not in Units mode during final verification', panel);
    }
    verifyExit(panel, 'tp', order.takeProfit);
    verifyExit(panel, 'sl', order.stopLoss);

    const submitButton = findSubmitButton(panel, order.side);
    if (!submitButton) fail('Could not uniquely identify TradingView order submit button', panel);
    if (submitButton.disabled || submitButton.getAttribute('aria-disabled') === 'true') {
      fail('TradingView order submit button is disabled', panel);
    }

    log('Verification passed');
    log('Clicking submit', {
      text: normalizedText(submitButton),
      dataName: submitButton.getAttribute('data-name'),
      qa: submitButton.getAttribute('data-qa-id')
    });
    submitButton.click();

    return {
      success: true,
      executionProtocolVersion: EXECUTION_PROTOCOL_VERSION,
      message: `${order.side} ${orderType} ${order.quantity} @ ${order.entryPrice} with TP ${order.takeProfit} and SL ${order.stopLoss} submitted (market ${market.currentPrice})`,
      side: order.side,
      quantity: order.quantity,
      entryPrice: order.entryPrice,
      orderType,
      takeProfit: order.takeProfit,
      stopLoss: order.stopLoss
    };
  }

  function getExecutionStatus() {
    const panel = findTradingPanel();
    const orderTicketDetected = Boolean(panel &&
      findVisible('[data-name="side-control-buy"]', panel) &&
      findVisible('[data-name="side-control-sell"]', panel));
    const domDetected = Boolean(panel && exactTextClickables(panel, 'DOM').length === 1 &&
      (findExactTextControl(panel, 'CXL All') || !orderTicketDetected));
    const orderPanelDetected = Boolean(panel && (orderTicketDetected || domDetected));
    const currentSymbol = panel ? readCurrentSymbol(panel) : null;
    const position = readOpenPosition();
    const positionEvidence = readPositionEvidence(position);
    return {
      success: true,
      executionProtocolVersion: EXECUTION_PROTOCOL_VERSION,
      tradingViewDetected: isTradingViewChart(),
      orderPanelDetected,
      orderTicketDetected,
      domDetected,
      brokerConnected: orderPanelDetected,
      ready: isTradingViewChart() && orderPanelDetected,
      symbol: currentSymbol?.root || null,
      displayedSymbol: currentSymbol?.displayed || null,
      symbolSource: currentSymbol?.source || null,
      // The background's three-second readiness poll uses this as a second,
      // independent exit signal when the regular quote publisher misses the
      // position transition after a broker-side TP/SL fill.
      position,
      positionEvidence,
      positionObservedAt: position ? positionFirstObservedAt : null
    };
  }

  let cachedLastPriceSource=null,lastPriceSourceSearchAt=0;
  function closeFromOhlcText(text) {
    if(!/O\s*[0-9]/i.test(text)||!/H\s*[0-9]/i.test(text)||!/L\s*[0-9]/i.test(text))return null;
    const match=text.match(/C\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
    if(!match)return null;
    const value=Number(match[1].replace(/,/g,''));return Number.isFinite(value)?value:null;
  }

  function readLastTradePrice() {
    if(cachedLastPriceSource?.isConnected&&isVisible(cachedLastPriceSource)) {
      const value=closeFromOhlcText(normalizedText(cachedLastPriceSource));
      if(value!=null)return value;
    }
    if(Date.now()-lastPriceSourceSearchAt<1000)return null;
    lastPriceSourceSearchAt=Date.now();
    const selectors='[data-name*="legend" i], [class*="legend" i], [class*="valuesWrapper"], [class*="valuesAdditionalWrapper"], [class*="sourcesWrapper"]';
    let candidates=Array.from(document.querySelectorAll(selectors)).filter(isVisible)
      .filter(element=>closeFromOhlcText(normalizedText(element))!=null);
    if(!candidates.length) candidates=Array.from(document.querySelectorAll('div, span')).filter(element=>{
      if(!isVisible(element))return false;
      const text=normalizedText(element);
      return text.length>=20&&text.length<=350&&closeFromOhlcText(text)!=null;
    });
    candidates.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top||normalizedText(a).length-normalizedText(b).length);
    cachedLastPriceSource=candidates[0]||null;
    return cachedLastPriceSource?closeFromOhlcText(normalizedText(cachedLastPriceSource)):null;
  }

  let lastPublishedQuote = '', lastPublishedQuoteAt = 0;
  let lastObservedPositionKey = '', positionFirstObservedAt = null;
  function parseFinancialValue(text) {
    const normalized = String(text || '').replace(/[−–—]/g, '-');
    const match = normalized.match(/[-+]?\s*\$?\s*\d[\d,\s]*(?:\.\d+)?/);
    if (!match) return null;
    const value = Number(match[0].replace(/[$,\s]/g, ''));
    return Number.isFinite(value) ? value : null;
  }

  function readLabeledFinancialMetric(label) {
    const labels = deepestExactTextElements(document, label);
    for (const labelElement of labels) {
      let container = labelElement.parentElement;
      for (let depth = 0; container && depth < 5; depth += 1, container = container.parentElement) {
        const text = normalizedText(container);
        if (text.length > 160) break;
        const labelIndex = text.toLowerCase().indexOf(label.toLowerCase());
        if (labelIndex < 0) continue;
        const withoutLabel = `${text.slice(0, labelIndex)} ${text.slice(labelIndex + label.length)}`;
        const value = parseFinancialValue(withoutLabel);
        if (value != null) return value;
      }
    }
    return null;
  }

  function readOpenPosition() {
    // The Paper Trading pane and order ticket are separate TradingView trees.
    // Anchor on the broker-qualified symbol cell in the visible position row.
    const positionTabs = Array.from(document.querySelectorAll('button, [role="tab"], div, span'))
      .filter(isVisible)
      .map((element) => ({ element, text: normalizedText(element) }))
      .filter(({ text }) => /^positions\s*\d+$/i.test(text))
      .sort((a, b) => a.text.length - b.text.length);
    const positionTab = positionTabs[0];
    // Do not infer an open position from order/trade history. TradingView keeps
    // historical rows mounted in the DOM, and those rows can otherwise block a
    // new arm after the actual position is already flat. A current, nonzero
    // Positions counter is the authoritative gate for this reader.
    if (!positionTab || Number(positionTab.text.match(/\d+$/)?.[0]) < 1) return null;
    // TradingView's virtualized grid cells do not always share a usable DOM
    // ancestor. innerText preserves the visible row's column order and excludes
    // hidden Order history / Trade history panes.
    const rendered = (document.body.innerText || '').replace(/\s+/g, ' ');
    const renderedRow = rendered.match(/\bCME_MINI:((?:NQ|MNQ)[A-Z0-9!]*)\s+(Long|Short)\s+([\d,.]+)\s+([\d,.]+)/i);
    if (renderedRow) {
      const quantity = Number(renderedRow[3].replaceAll(',', ''));
      const avgPrice = Number(renderedRow[4].replaceAll(',', ''));
      if (Number.isFinite(quantity) && quantity > 0 && Number.isFinite(avgPrice) && avgPrice > 0) {
        return { symbol: renderedRow[1].toUpperCase(), side: renderedRow[2].toUpperCase(), quantity, avgPrice };
      }
    }
    const symbolCells = Array.from(document.querySelectorAll('div, span, td, [role="cell"], [role="gridcell"]'))
      .filter(isVisible)
      .filter((element) => /^CME_MINI:(?:NQ|MNQ)[A-Z0-9!]*$/i.test(normalizedText(element)));
    const candidates = [];
    for (const symbolCell of symbolCells) {
      let row = symbolCell;
      for (let depth = 0; row && depth < 18; depth += 1, row = row.parentElement) {
        const text = normalizedText(row);
        if (/\b(?:long|short)\b/i.test(text) && /\bCME_MINI:(?:NQ|MNQ)[A-Z0-9!]*\b/i.test(text)) candidates.push({ element: row, text });
        if (row.matches?.('tr, [role="row"]')) break;
      }
    }
    candidates.sort((a, b) => a.text.length - b.text.length);
    for (const { text } of candidates) {
      const symbol = text.match(/\bCME_MINI:((?:NQ|MNQ)[A-Z0-9!]*)\b/i);
      const side = text.match(/\b(Long|Short)\b/i);
      if (!symbol || !side) continue;
      const values = text.slice((side.index || 0) + side[0].length).match(/[-+]?\d[\d,]*(?:\.\d+)?/g) || [];
      const quantity = Number(values[0]?.replaceAll(',', ''));
      const avgPrice = Number(values[1]?.replaceAll(',', ''));
      if (Number.isFinite(quantity) && quantity > 0 && Number.isFinite(avgPrice) && avgPrice > 0) {
        return { symbol: symbol[1].toUpperCase(), side: side[1].toUpperCase(), quantity, avgPrice };
      }
    }
    return null;
  }

  function readPositionEvidence(position) {
    if (position) return 'OPEN';
    // A missing or virtualized Positions node is not evidence that an account
    // is flat. Only TradingView's explicit empty-position UI is authoritative.
    const labels = Array.from(document.querySelectorAll('button, [role="tab"], div, span'))
      .filter(isVisible).map((element) => normalizedText(element));
    if (labels.some((value) => /^positions\s*0$/i.test(value))) return 'FLAT';
    if (/There are no open positions in your trading account yet/i.test((document.body.innerText || '').replace(/\s+/g, ' '))) return 'FLAT';
    return 'UNKNOWN';
  }

  let quotePublishTimer = null;

  function stopQuotePublisher() {
    if (quotePublishTimer !== null) clearInterval(quotePublishTimer);
    quotePublishTimer = null;
  }

  function extensionContextAvailable() {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch (_) {
      stopQuotePublisher();
      return false;
    }
  }

  function publishQuotes() {
    if (!extensionContextAvailable()) {
      stopQuotePublisher();
      return;
    }
    const panel=findTradingPanel();
    const sellControl=panel&&findVisible('[data-name="side-control-sell"]',panel);
    const buyControl=panel&&findVisible('[data-name="side-control-buy"]',panel);
    const bid=readQuoteFromControl(sellControl),ask=readQuoteFromControl(buyControl),rawLast=readLastTradePrice();
    const symbol=readCurrentSymbol(panel);
    const tick=['NQ','MNQ'].includes(symbol?.root)?0.25:symbol?.root==='MBT'?5:null;
    const roundedLast=Number.isFinite(rawLast)&&tick?Math.round(rawLast/tick)*tick:rawLast;
    const quoteLow=Math.min(Number(bid),Number(ask)),quoteHigh=Math.max(Number(bid),Number(ask));
    const legendIsLive=Number.isFinite(roundedLast)&&Number.isFinite(quoteLow)&&Number.isFinite(quoteHigh)&&
      roundedLast>=quoteLow-(tick||0)&&roundedLast<=quoteHigh+(tick||0);
    // The OHLC legend follows the crosshair. Never turn a historical hover
    // value into a live tick and an artificial candle wick.
    const last=legendIsLive?roundedLast:(Number.isFinite(bid)?bid:Number.isFinite(ask)?ask:null);
    const accountBalance=readLabeledFinancialMetric('Account balance');
    const unrealizedPnl=readLabeledFinancialMetric('Unrealized PnL');
    const position=readOpenPosition();
    const positionEvidence=readPositionEvidence(position);
    const positionKey=position?`${position.symbol}:${position.side}:${position.quantity}:${position.avgPrice}`:'';
    if(positionKey!==lastObservedPositionKey){lastObservedPositionKey=positionKey;positionFirstObservedAt=positionKey?Date.now():null;}
    if(!Number.isFinite(bid)&&!Number.isFinite(ask)&&!Number.isFinite(last)&&
      !Number.isFinite(accountBalance)&&!Number.isFinite(unrealizedPnl)&&!position) return;
    const fingerprint=`${symbol?.displayed||''}:${bid}:${ask}:${last}:${accountBalance}:${unrealizedPnl}:${position?.symbol||''}:${position?.side||''}:${position?.quantity||''}:${position?.avgPrice||''}`;
    if(fingerprint===lastPublishedQuote && Date.now()-lastPublishedQuoteAt<1000) return;
    lastPublishedQuote=fingerprint;lastPublishedQuoteAt=Date.now();
    try {
      const delivery=chrome.runtime.sendMessage({type:'QUOTE_UPDATE',bid,ask,last,accountBalance,unrealizedPnl,position,lastSource:legendIsLive?'chart':'bid-fallback',symbol:symbol?.root||null,
        displayedSymbol:symbol?.displayed||null,timestamp:Date.now(),positionObservedAt:positionFirstObservedAt,positionEvidence});
      delivery?.catch((error)=>{if(/extension context invalidated/i.test(String(error?.message||error)))stopQuotePublisher();});
    } catch (error) {
      if(/extension context invalidated/i.test(String(error?.message||error)))stopQuotePublisher();
    }
  }

  function findCancelDialog() {
    const named = findVisible('[data-name="simple-confirm-dialog"]');
    if (named) return named;
    return Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-name*="dialog" i]'))
      .filter(isVisible).find((dialog) => /cancel order/i.test(normalizedText(dialog)) && /keep order/i.test(normalizedText(dialog))) || null;
  }

  function findCancelConfirmation(dialog) {
    const candidates = Array.from(dialog.querySelectorAll('button, [role="button"], [data-name="submit-button"]'))
      .filter(isVisible)
      .filter((button) => !(button.disabled || button.getAttribute('aria-disabled') === 'true'));
    // TradingView's dialog can include invisible wrapper controls, so select
    // the explicit destructive confirmation rather than requiring there to
    // be exactly one generic “cancel” candidate.
    return candidates.find((button) => /^cancel order$/i.test(normalizedText(button)))
      || candidates.find((button) => /^(cancel|confirm|yes)$/i.test(normalizedText(button)))
      || null;
  }

  function findClosePositionDialog() {
    return Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-name*="dialog" i]'))
      .filter(isVisible).find(dialog=>/close position/i.test(normalizedText(dialog)))||null;
  }

  async function cancelAllOrders(flatten = false, expectedSymbol = null) {
    if (expectedSymbol === 'MNQ') {
      const direct = await directBrokerCommand({ action: 'cancelAll', flatten });
      return { success: true, message: flatten ? 'Direct broker orders cancelled and positions flattened' : 'Direct broker orders cancelled', direct };
    }
    log(flatten ? 'Cancel All & Flatten requested' : 'Cancel pending orders requested');
    const panel = await openTradingPanel();
    try {
      // A chart can be changed between the background worker selecting this
      // tab and this command reaching the page. Never cancel/flatten a chart
      // unless it is still the requested prop root.
      if (expectedSymbol) verifyRequestedSymbol(panel, String(expectedSymbol).toUpperCase());
      let cxlAllButton = findExactTextControl(panel, 'CXL All');
      if (!cxlAllButton) {
        const domControls = exactTextClickables(panel, 'DOM');
        if (domControls.length !== 1) fail('Could not uniquely identify the TradingView DOM tab', panel);
        domControls[0].click();
        cxlAllButton = await waitFor(() => findExactTextControl(panel, 'CXL All'), 'TradingView DOM CXL All button');
      }
      const hasPendingOrders=!(cxlAllButton.disabled||cxlAllButton.getAttribute('aria-disabled')==='true');
      if(hasPendingOrders) {
        cxlAllButton.click();
        let dialog;
        try { dialog = await waitFor(findCancelDialog, 'TradingView cancel confirmation dialog', 6000); }
        catch (_) {
          log('Cancel completed without a confirmation dialog');
        }
        if(dialog) {
          const confirmButton = findCancelConfirmation(dialog);
          if (!confirmButton) fail('Could not identify the Cancel order confirmation button', dialog);
          confirmButton.click();
          await waitFor(() => !dialog.isConnected || !isVisible(dialog), 'cancel confirmation dialog to close');
          log('All pending orders cancelled');
        }
      }

      if(!flatten)return {success:true,message:'All pending orders cancelled'};

      const flattenButton=findExactTextControl(panel,'Flatten');
      if(!flattenButton) fail('Could not find TradingView Flatten button',panel);
      const hasOpenPosition=!(flattenButton.disabled||flattenButton.getAttribute('aria-disabled')==='true');
      if(hasOpenPosition) {
        flattenButton.click();
        let closeDialog;
        try { closeDialog=await waitFor(findClosePositionDialog,'TradingView Close position dialog',1500); }
        catch (_) {
          // CXL All may have removed the only working entry before a position
          // existed. TradingView can leave Flatten looking enabled briefly but
          // correctly opens no close dialog in that state.
          log('No open TradingView position found after cancelling orders');
          return {success:true,message:'All orders cancelled; no open position found'};
        }
        const closeButton=findExactTextControl(closeDialog,'Close position');
        if(!closeButton)fail('Could not identify the Close position confirmation button',closeDialog);
        closeButton.click();
        await waitFor(()=>!closeDialog.isConnected||!isVisible(closeDialog),'Close position dialog to close');
        log('Open TradingView position flattened');
      }
      return { success: true, message: hasOpenPosition?'All orders cancelled and position flattened':'All orders cancelled; no open position found' };
    } finally {
      try { await openOrderTicket(panel); }
      catch (error) { warn('Could not return TradingView to the Order ticket', error); }
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'GET_EXECUTION_STATUS') {
      publishQuotes();
      sendResponse(getExecutionStatus());
      return false;
    }
    if (message?.action === 'PUBLISH_QUOTES') {
      cachedLastPriceSource = null;
      lastPriceSourceSearchAt = 0;
      lastPublishedQuoteAt = 0;
      publishQuotes();
      sendResponse({ success: true });
      return false;
    }
    let operation;
    if (message?.action === 'PLACE_BRACKET_ORDER') {
      operation = placeBracketOrder({
        id: String(message.id || ''),
        symbol: String(message.symbol || '').toUpperCase(),
        side: String(message.side || '').toUpperCase(),
        quantity: Number(message.quantity),
        entryPrice: Number(message.entryPrice),
        takeProfit: Number(message.takeProfit),
        stopLoss: Number(message.stopLoss)
      });
    } else if (message?.action === 'CANCEL_ALL_ORDERS') {
      operation = cancelAllOrders(message.flatten === true, message.expectedSymbol || null);
    } else {
      return false;
    }

    operation.then(sendResponse).catch((error) => {
      warn('Operation stopped:', error);
      sendResponse({
        success: false,
        code: error.code || 'SUBMIT_FAILED',
        message: error.message || String(error),
        requested: error.requested,
        current: error.current
      });
    });
    return true;
  });

  log('Content script loaded');
  publishQuotes();
  quotePublishTimer=setInterval(publishQuotes,100);
  // Chrome can freeze or discard background tabs. These lifecycle hooks force
  // immediate DOM rediscovery and publication when TradingView wakes again.
  const resumeQuotes = () => {
    cachedLastPriceSource = null;
    lastPriceSourceSearchAt = 0;
    lastPublishedQuoteAt = 0;
    publishQuotes();
  };
  window.addEventListener('focus', resumeQuotes);
  window.addEventListener('pageshow', resumeQuotes);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resumeQuotes();
  });
})();
