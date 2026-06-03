// ── URBANFITZ SMS SERVICE (Africa's Talking) ──────────────────────────────────
const AT_API_KEY  = process.env.AT_API_KEY || null;
const AT_USERNAME = process.env.AT_USERNAME || 'sandbox';
const SMS_ENABLED = !!AT_API_KEY;

// ── SMS MESSAGES PER STATUS ───────────────────────────────────────────────────
const STATUS_MESSAGES = {
  'In Production': (order) =>
    `Hi ${order.customer.split(' ')[0]}! Great news! We have started production on your order (${order.id}) - ${order.product}. We will notify you when it is ready. Questions? Call/WhatsApp: 07038245181 - UrbanFitz Clothings`,

  'Ready for Delivery': (order) =>
    `Hi ${order.customer.split(' ')[0]}! Your order is READY! Order ${order.id} - ${order.product} is complete and ready for delivery/pickup. Contact us to arrange: 07038245181 - UrbanFitz Clothings`,

  'Shipped': (order) => {
    let trackingInfo = '';
    if (order.tracking_number && order.delivery_type === 'Interstate') {
      trackingInfo = ` Your waybill number is ${order.tracking_number} via ${order.logistics||'our logistics partner'}.`;
    } else if (order.tracking_number && order.delivery_type === 'Lagos') {
      trackingInfo = ` Your rider will contact you shortly on ${order.tracking_number}.`;
    }
    return `Hi ${order.customer.split(' ')[0]}! Your order is on its way! Order ${order.id} - ${order.product} has been shipped to ${order.address||'your address'}.${trackingInfo} Call us: 07038245181 - UrbanFitz Clothings`;
  },

  'Delivered': (order) =>
    `Hi ${order.customer.split(' ')[0]}! Your order has been delivered! We hope you love your ${order.product}. Thank you for choosing UrbanFitz Clothings! 07038245181`,

  'Cancelled': (order) =>
    `Hi ${order.customer.split(' ')[0]}, your order ${order.id} - ${order.product} has been cancelled. Please contact us: 07038245181 - UrbanFitz Clothings`,
};

const PAYMENT_MESSAGES = {
  'Paid': (order) =>
    `Hi ${order.customer.split(' ')[0]}! Payment confirmed for order ${order.id} - ${order.product} (NGN ${Number(order.amount).toLocaleString()}). Thank you! - UrbanFitz Clothings 07038245181`,

  'Partially Paid': (order) =>
    `Hi ${order.customer.split(' ')[0]}, we received your part payment for order ${order.id}. Please complete payment to proceed. Call: 07038245181 - UrbanFitz Clothings`,
};

// ── FORMAT PHONE ──────────────────────────────────────────────────────────────
function formatPhone(phone) {
  let p = phone.replace(/[\s\-]/g, '');
  if (p.startsWith('0')) p = '+234' + p.slice(1);
  if (!p.startsWith('+')) p = '+' + p;
  return p;
}

// ── SEND SMS VIA AFRICA'S TALKING ─────────────────────────────────────────────
async function sendSMS(phone, message) {
  if (!SMS_ENABLED) {
    console.log(`[SMS DISABLED] To ${phone}: ${message.substring(0, 60)}...`);
    return { sent: false, reason: 'SMS not configured' };
  }

  try {
    const formattedPhone = formatPhone(phone);
    // Use sandbox endpoint for sandbox, production endpoint for live
    const endpoint = AT_USERNAME === 'sandbox'
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';

    const params = new URLSearchParams({
      username: AT_USERNAME,
      to: formattedPhone,
      message: message,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': AT_API_KEY,
      },
      body: params.toString(),
    });

    const rawText = await response.text();
    console.log(`[SMS] Response (${response.status}):`, rawText.substring(0, 200));

    try {
      const data = JSON.parse(rawText);
      console.log(`[SMS] Sent to ${formattedPhone}:`, JSON.stringify(data));
      return { sent: true, data };
    } catch(parseErr) {
      console.error(`[SMS] Non-JSON:`, rawText.substring(0, 300));
      return { sent: false, error: rawText.substring(0, 200) };
    }
  } catch(err) {
    console.error('[SMS] Failed:', err.message);
    return { sent: false, error: err.message };
  }
}

// ── SEND ORDER STATUS SMS ─────────────────────────────────────────────────────
async function sendStatusSMS(order, newStatus) {
  const messageFn = STATUS_MESSAGES[newStatus];
  if (!messageFn) return { sent: false, reason: 'No SMS template for this status' };
  return sendSMS(order.phone, messageFn(order));
}

// ── SEND PAYMENT STATUS SMS ───────────────────────────────────────────────────
async function sendPaymentSMS(order, newPayStatus) {
  const messageFn = PAYMENT_MESSAGES[newPayStatus];
  if (!messageFn) return { sent: false, reason: 'No SMS template for this payment status' };
  return sendSMS(order.phone, messageFn(order));
}

// ── SEND CUSTOM SMS ───────────────────────────────────────────────────────────
async function sendCustomSMS(phone, message) {
  return sendSMS(phone, message);
}

// ── SEND BULK SMS ─────────────────────────────────────────────────────────────
async function sendBulkSMS(customers, message) {
  const results = [];
  for (const c of customers) {
    const msg = message.replace('[Name]', c.name.split(' ')[0]);
    const result = await sendSMS(c.phone, msg);
    results.push({ customer: c.name, phone: c.phone, ...result });
    await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

module.exports = { sendStatusSMS, sendPaymentSMS, sendCustomSMS, sendBulkSMS, SMS_ENABLED };
