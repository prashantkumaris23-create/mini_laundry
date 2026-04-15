const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "..", "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const STATUSES = ["RECEIVED", "PROCESSING", "READY", "DELIVERED"];
const PRICE_LIST = {
  Shirt: 60,
  Pants: 80,
  Saree: 150,
  Suit: 250,
  Dress: 180,
  Coat: 220,
  Bedsheet: 120
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, "[]\n");
  }
}

function readOrders() {
  ensureStore();
  return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
}

function writeOrders(orders) {
  ensureStore();
  fs.writeFileSync(ORDERS_FILE, `${JSON.stringify(orders, null, 2)}\n`);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message, details) {
  sendJson(res, statusCode, { error: message, details });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large"));
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
  });
}

function makeOrderId(orders, orderTakenDate) {
  const datePart = orderTakenDate.replaceAll("-", "");
  const todaysCount = orders.filter(order => order.id.includes(datePart)).length + 1;
  return `LND-${datePart}-${String(todaysCount).padStart(4, "0")}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\s+/g, "").trim();
}

function validateOrderPayload(payload) {
  const errors = [];
  const customerName = String(payload.customerName || "").trim();
  const phone = normalizePhone(payload.phone);
  const orderTakenDate = String(payload.orderTakenDate || new Date().toISOString().slice(0, 10)).trim();
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!customerName) errors.push("Customer name is required.");
  if (!/^[0-9+()-]{7,15}$/.test(phone)) errors.push("A valid phone number is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(orderTakenDate)) {
    errors.push("Order taken date must use YYYY-MM-DD format.");
  }
  if (items.length === 0) errors.push("At least one garment item is required.");

  const cleanedItems = items.map((item, index) => {
    const garment = String(item.garment || "").trim();
    const quantity = Number(item.quantity);
    const configuredPrice = PRICE_LIST[garment];
    const pricePerItem = Number(item.pricePerItem || configuredPrice);

    if (!garment) errors.push(`Item ${index + 1}: garment is required.`);
    if (!Number.isInteger(quantity) || quantity < 1) {
      errors.push(`Item ${index + 1}: quantity must be a positive whole number.`);
    }
    if (!Number.isFinite(pricePerItem) || pricePerItem < 0) {
      errors.push(`Item ${index + 1}: price must be zero or greater.`);
    }
    if (!configuredPrice && !item.pricePerItem) {
      errors.push(`Item ${index + 1}: unknown garment. Provide pricePerItem or use a configured garment.`);
    }

    return {
      garment,
      quantity,
      pricePerItem,
      lineTotal: quantity * pricePerItem
    };
  });

  return { errors, customerName, phone, orderTakenDate, items: cleanedItems };
}

function createOrder(payload) {
  const orders = readOrders();
  const { errors, customerName, phone, orderTakenDate, items } = validateOrderPayload(payload);

  if (errors.length > 0) {
    return { errors };
  }

  const now = new Date();
  const order = {
    id: makeOrderId(orders, orderTakenDate),
    customerName,
    phone,
    items,
    totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
    status: "RECEIVED",
    orderTakenDate,
    createdAt: now.toISOString(),
    estimatedDeliveryDate: payload.estimatedDeliveryDate || addDays(now, 3)
  };

  orders.push(order);
  writeOrders(orders);
  return { order };
}

function filterOrders(orders, searchParams) {
  const status = (searchParams.get("status") || "").trim().toUpperCase();
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const garment = (searchParams.get("garment") || "").trim().toLowerCase();

  return orders
    .filter(order => {
      const shouldSearchAllStatuses = !status && (q || garment);
      const matchesStatus = status ? order.status === status : true;
      const matchesDefaultView = status || shouldSearchAllStatuses || order.status !== "DELIVERED";
      const matchesQuery =
        !q ||
        order.customerName.toLowerCase().includes(q) ||
        order.phone.toLowerCase().includes(q);
      const matchesGarment =
        !garment ||
        order.items.some(item => item.garment.toLowerCase().includes(garment));

      return matchesStatus && matchesDefaultView && matchesQuery && matchesGarment;
    })
    .sort((a, b) => {
      if (a.status === "DELIVERED" && b.status !== "DELIVERED") return 1;
      if (a.status !== "DELIVERED" && b.status === "DELIVERED") return -1;

      const dateCompare = String(b.orderTakenDate || b.createdAt || "").localeCompare(
        String(a.orderTakenDate || a.createdAt || "")
      );
      if (dateCompare !== 0) return dateCompare;

      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
}

function getDashboard() {
  const orders = readOrders();
  const ordersPerStatus = Object.fromEntries(STATUSES.map(status => [status, 0]));
  const dailyOrderMap = {};
  const deliveredOrderDetails = [];

  for (const order of orders) {
    ordersPerStatus[order.status] = (ordersPerStatus[order.status] || 0) + 1;
    const takenDate = order.orderTakenDate || String(order.createdAt || "").slice(0, 10) || "Unknown";
    dailyOrderMap[takenDate] = (dailyOrderMap[takenDate] || 0) + 1;
    if (order.status === "DELIVERED") {
      deliveredOrderDetails.push(order);
    }
  }

  return {
    totalOrders: orders.length,
    totalRevenue: orders
      .filter(order => order.status !== "DELIVERED" || order.totalAmount >= 0)
      .reduce((sum, order) => sum + order.totalAmount, 0),
    deliveredOrders: ordersPerStatus.DELIVERED || 0,
    ordersPerStatus,
    dailyOrderCounts: Object.entries(dailyOrderMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    deliveredOrderDetails: deliveredOrderDetails.sort((a, b) =>
      String(b.deliveredAt || b.updatedAt || b.createdAt || "").localeCompare(
        String(a.deliveredAt || a.updatedAt || a.createdAt || "")
      )
    )
  };
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const safePath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendError(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "mini-laundry-order-management" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/prices") {
    sendJson(res, 200, { prices: PRICE_LIST });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/orders") {
    const payload = await parseBody(req);
    const result = createOrder(payload);

    if (result.errors) {
      sendError(res, 400, "Order validation failed", result.errors);
      return;
    }

    sendJson(res, 201, {
      orderId: result.order.id,
      totalAmount: result.order.totalAmount,
      order: result.order
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/orders") {
    sendJson(res, 200, { orders: filterOrders(readOrders(), url.searchParams) });
    return;
  }

  const orderIdMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
  const statusMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/);

  if (req.method === "GET" && orderIdMatch) {
    const order = readOrders().find(current => current.id === decodeURIComponent(orderIdMatch[1]));

    if (!order) {
      sendError(res, 404, "Order not found");
      return;
    }

    sendJson(res, 200, { order });
    return;
  }

  if (req.method === "PATCH" && statusMatch) {
    const orderId = decodeURIComponent(statusMatch[1]);
    const payload = await parseBody(req);
    const nextStatus = String(payload.status || "").trim().toUpperCase();

    if (!STATUSES.includes(nextStatus)) {
      sendError(res, 400, "Invalid status", { allowedStatuses: STATUSES });
      return;
    }

    const orders = readOrders();
    const order = orders.find(current => current.id === orderId);

    if (!order) {
      sendError(res, 404, "Order not found");
      return;
    }

    order.status = nextStatus;
    order.updatedAt = new Date().toISOString();
    if (nextStatus === "DELIVERED") {
      order.deliveredAt = order.updatedAt;
    } else {
      delete order.deliveredAt;
    }
    writeOrders(orders);
    sendJson(res, 200, { order });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    sendJson(res, 200, getDashboard());
    return;
  }

  sendError(res, 404, "API route not found");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendError(res, 500, error.message || "Internal server error");
  }
});

if (require.main === module) {
  ensureStore();
  server.listen(PORT, () => {
    console.log(`Mini Laundry Order Management running at http://localhost:${PORT}`);
  });
}

module.exports = {
  server,
  createOrder,
  filterOrders,
  getDashboard,
  PRICE_LIST,
  STATUSES
};
