// ── API HELPER ────────────────────────────────────────────────────────────────
const API = {
  async request(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },
  get: (url) => API.request('GET', url),
  post: (url, body) => API.request('POST', url, body),
  put: (url, body) => API.request('PUT', url, body),
  del: (url) => API.request('DELETE', url),

  // Auth
  login: (email, password) => API.post('/api/login', { email, password }),
  logout: () => API.post('/api/logout'),
  me: () => API.get('/api/me'),

  // Orders
  getOrders: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return API.get('/api/orders' + (q ? '?' + q : ''));
  },
  createOrder: (data) => API.post('/api/orders', data),
  updateOrder: (id, data) => API.put('/api/orders/' + id, data),
  deleteOrder: (id) => API.del('/api/orders/' + id),

  // Customers
  getCustomers: () => API.get('/api/customers'),
  getCustomerOrders: (phone) => API.get('/api/customers/' + encodeURIComponent(phone) + '/orders'),

  // Stats
  getStats: () => API.get('/api/stats'),

  // PDF — direct browser download
  downloadPDF: (orderId) => {
    window.location.href = '/api/orders/' + orderId + '/pdf';
  },

  // Change password
  changePassword: (currentPassword, newPassword) =>
    API.post('/api/change-password', { currentPassword, newPassword }),
};
