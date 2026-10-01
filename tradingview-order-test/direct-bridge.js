(() => {
  if (window.__hedgeDirectBrokerBridge) return;
  window.__hedgeDirectBrokerBridge = true;
  const unwrap = value => value && typeof value.value === 'function' ? value.value() : value;
  const getBroker = () => {
    const trading = window.TradingView?.bottomWidgetBar?._widgetControllers?.get('paper_trading')?._trading;
    return { trading, broker: unwrap(trading?.activeBroker?.()) };
  };
  window.addEventListener('hedge-os-direct-command', async event => {
    let request; try { request = JSON.parse(String(event.detail || '')); } catch (_) { return; }
    const reply = { id: request.id, ok: false };
    try {
      const { broker } = getBroker(); if (!broker) throw Error('ACTIVE_BROKER_NOT_FOUND');
      if (request.action === 'inspect') {
        reply.data = { account: await broker.currentAccount?.(), accountType: await broker.currentAccountType?.(), positions: await broker.positions?.(), orders: await broker.orders?.(), executions: await broker.executions?.() };
      } else if (request.action === 'place') reply.data = await broker.placeOrder(request.order);
      else if (request.action === 'cancelAll') {
        const orders = await broker.orders?.() || [];
        reply.data = [];
        for (const order of orders.filter(o => ![1,2,5].includes(Number(o.status)))) reply.data.push(await broker.cancelOrder(String(order.id)));
        if (request.flatten) for (const position of (await broker.positions?.() || [])) reply.data.push(await broker.closePosition(position.id));
      }
      else if (request.action === 'cancel') reply.data = await broker.cancelOrder(String(request.orderId));
      else if (request.action === 'close') reply.data = await broker.closePosition(request.positionId);
      else throw Error('UNSUPPORTED_DIRECT_ACTION');
      reply.ok = true;
    } catch (error) { reply.error = String(error?.message || error); }
    window.dispatchEvent(new CustomEvent('hedge-os-direct-result', { detail: JSON.stringify(reply) }));
  });
})();
