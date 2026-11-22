// 收费接口预留层。
//
// 现在只有 manual（人工确认）一个实现：柜台收钱后，用现有的「标记已付款」把
// 堆叠/文件标成已收款即可。以后接入微信或支付宝时，实现同一组函数并注册到
// PROVIDERS 即可，调用方不需要改。
//
// 约定：
//   createPayment(order)  -> { provider, outTradeNo, qrCode?, payUrl?, status }
//   queryPayment(order)   -> { status: 'pending'|'paid'|'closed'|'refunded' }
//   refund(order, amount) -> { ok, refundNo? }
//
// order 建议至少包含：{ no, amount, nickname, phone, stackId }

export const PAYMENT_PROVIDERS = {
  manual: {
    id: 'manual',
    label: '人工确认',
    async createPayment(order) {
      return {
        provider: 'manual',
        outTradeNo: order?.no || '',
        status: 'pending',
        message: '等待柜台确认收款',
      };
    },
    async queryPayment(order) {
      return { status: order?.payment === 'paid' ? 'paid' : 'pending' };
    },
    async refund() {
      return { ok: false, error: '人工收款请在「金额统计」里登记退款' };
    },
  },
  // 预留：微信支付（需商户号、API 证书、回调验签）
  wechat: {
    id: 'wechat',
    label: '微信支付（未接入）',
    async createPayment() {
      return { provider: 'wechat', status: 'unconfigured', message: '微信支付尚未配置' };
    },
    async queryPayment() {
      return { status: 'unconfigured' };
    },
    async refund() {
      return { ok: false, error: '微信支付尚未配置' };
    },
  },
  // 预留：支付宝当面付 / 手机网站支付
  alipay: {
    id: 'alipay',
    label: '支付宝（未接入）',
    async createPayment() {
      return { provider: 'alipay', status: 'unconfigured', message: '支付宝尚未配置' };
    },
    async queryPayment() {
      return { status: 'unconfigured' };
    },
    async refund() {
      return { ok: false, error: '支付宝尚未配置' };
    },
  },
};

export function getPaymentProvider(id = 'manual') {
  return PAYMENT_PROVIDERS[id] || PAYMENT_PROVIDERS.manual;
}

export async function createPayment(order, providerId = 'manual') {
  return getPaymentProvider(providerId).createPayment(order);
}

export async function queryPayment(order, providerId = 'manual') {
  return getPaymentProvider(providerId).queryPayment(order);
}

export async function refundPayment(order, amount, providerId = 'manual') {
  return getPaymentProvider(providerId).refund(order, amount);
}
