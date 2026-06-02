// ── URBANFITZ SMS SERVICE (Termii) ───────────────────────────────────────────
// Set TERMII_API_KEY in your Render environment variables to enable SMS
// Sign up at termii.com to get your API key

const TERMII_API_KEY = process.env.TERMII_API_KEY || null;
const SENDER_ID      = process.env.TERMII_SENDER_ID || 'UrbanFitz';
const SMS_ENABLED    = !!TERMII_API_KEY;

// ── SMS MESSAGES PER STATUS ───────────────────────────────────────────────────
const STATUS_MESSAGES = {
  'In Production': (order) =>
    `Hi ${order.customer.split(' ')[0]}! 🧵 Great news! We have started production on your order (${order.id}) - ${order.product}. We will notify you when it's ready. Questions? Call/WhatsApp: 07038245181 - UrbanFitz Clothings`,

  'Ready for Delivery': (order) =>
    `Hi ${order.customer.split(' ')[0]}! 🎉 Your order is READY! Order ${order.id} - ${order.product} is complete and ready for delivery/pickup. Contact us to arrange: 07038245181 - UrbanFitz Clothings`,

  'Shipped': (order) =>
    `Hi ${order.customer.split(' ')[0]}! 🚚 Your order is on its way! Order ${order.id} - ${order.product} has been shipped to ${order.address || 'your address'}. Call us: 07038245181 - UrbanFitz Clothings`,

  'Delivered': (order) =>
    `Hi ${order.customer.split(' ')[0]}! ✅ Your order has been delivered! We hope you love your ${order.product}. Thank you for choosing UrbanFitz Clothings! We'd love to serve you again. 07038245181`,

  'Cancelled': (order) =>
    `Hi ${order.customer.split(' ')[0]}, your order ${order.id} - ${order.product} has been cancelled. Please contact us for more information: 07038245181 - UrbanFitz Clothings`,
};

// ── PAYMENT MESSAGES ──────────────────────────────────────────────────────────
const PAYMENT_MESSAGES = {
  'Paid': (order) =>
    `Hi ${order.customer.split(' ')[0]}! ✅ Payment confirmed for order ${order.id} - ${order.product} (₦${Number(order.amount).toLocaleString()}). Thank you! - UrbanFitz Clothings 07038245181`,

  'Partially Paid': (order) =>
    `Hi ${order.customer.split(' ')[0]}, we have received your part payment for order ${order.id}. Outstanding balance remaining. Please complete payment to proceed. Call: 07038245181 - UrbanFitz Clothings`,
};

// ── FORMAT PHONE NUMBER ───────────────────────────────────────────────────────
function formatPhone(phone) {
  // Remove all spaces and dashes
  let p = phone.replace(/[\s\-]/g, '');
  // Convert 0XXXXXXXXXX to 234XXXXXXXXXX (Nigerian format)
  if (p.startsWith('0')) p = '234' + p.slice(1);
  // Already has country code
  if (p.startsWith('+')) p = p.slice(1);
  return p;
}

// ── SEND SMS VIA TERMII ───────────────────────────────────────────────────────
async function sendSMS(phone, message) {
  if (!SMS_ENABLED) {
    console.log(`[SMS DISABLED] Would send to ${phone}: ${message.substring(0, 50)}...`);
    return { sent: false, reason: 'SMS not configured - add TERMII_API_KEY' };
  }

  try {
    const formattedPhone = formatPhone(phone);
    const payload = {
      to: formattedPhone,
      from: SENDER_ID,
      sms: message,
      type: 'plain',
      api_key: TERMII_API_KEY,
      channel: 'generic',
    };

    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log(`[SMS] Sent to ${formattedPhone}:`, data.message || 'OK');
    return { sent: true, data };
  } catch (err) {
    console.error('[SMS] Failed to send:', err.message);
    return { sent: false, error: err.message };
  }
}

// ── SEND ORDER STATUS SMS ─────────────────────────────────────────────────────
async function sendStatusSMS(order, newStatus) {
  const messageFn = STATUS_MESSAGES[newStatus];
  if (!messageFn) return { sent: false, reason: 'No SMS template for this status' };
  const message = messageFn(order);
  return sendSMS(order.phone, message);
}

// ── SEND PAYMENT STATUS SMS ───────────────────────────────────────────────────
async function sendPaymentSMS(order, newPayStatus) {
  const messageFn = PAYMENT_MESSAGES[newPayStatus];
  if (!messageFn) return { sent: false, reason: 'No SMS template for this payment status' };
  const message = messageFn(order);
  return sendSMS(order.phone, message);
}

// ── SEND CUSTOM SMS ───────────────────────────────────────────────────────────
async function sendCustomSMS(phone, message) {
  return sendSMS(phone, message);
}

// ── SEND BULK SMS ─────────────────────────────────────────────────────────────
async function sendBulkSMS(customers, message) {
  const results = [];
  for (const c of customers) {
    const result = await sendSMS(c.phone, message.replace('[Name]', c.name.split(' ')[0]));
    results.push({ customer: c.name, phone: c.phone, ...result });
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }
  return results;
}

module.exports = { sendStatusSMS, sendPaymentSMS, sendCustomSMS, sendBulkSMS, SMS_ENABLED };
