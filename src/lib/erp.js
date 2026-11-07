/**
 * MoPrint ERP adapter.
 *
 * This is a deliberately small, stable interface so an ERP connector can be
 * added without touching the print pipeline. Implement these methods against
 * your own ERP and keep the payload shape below.
 */

export class ErpAdapter {
  constructor(settings = {}) {
    this.endpoint = String(settings.erpEndpoint || '').replace(/\/+$/, '');
    this.token = settings.erpToken || '';
    this.enabled = !!settings.erpEnabled && !!this.endpoint;
    this.timeout = 6000;
  }

  async request(path, body) {
    if (!this.enabled) return { ok: false, skipped: true, reason: 'ERP 未启用' };
    try {
      const res = await window.cloudPrint.erpRequest({
        url: `${this.endpoint}${path}`,
        method: 'POST',
        token: this.token,
        body,
      });
      return res;
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    } finally {
      // timeout is enforced by the main-process bridge
    }
  }

  /**
   * order: {
   *   id, title, customer, pages, amount, payment,
   *   printedAt, files: [{ name, pages, copies }]
   * }
   */
  pushOrder(order) {
    return this.request('/moprint/orders', order);
  }

  /**
   * payment: { id, type: 'payment'|'charge'|'refund', amount, stackId, note, time }
   */
  pushPayment(payment) {
    return this.request('/moprint/payments', payment);
  }

  /**
   * query: { keyword } -> { items: [{ id, name, phone, balance }] }
   */
  fetchCustomer(query) {
    return this.request('/moprint/customers/search', query);
  }

  testConnection() {
    return this.request('/moprint/ping', { at: Date.now() });
  }
}

export function createErpAdapter(settings) {
  return new ErpAdapter(settings);
}
