const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const state = {
  prices: {}
};

const itemsContainer = document.querySelector("#items");
const itemTemplate = document.querySelector("#itemTemplate");
const orderForm = document.querySelector("#orderForm");
const formMessage = document.querySelector("#formMessage");
const ordersList = document.querySelector("#ordersList");
const dailyOrdersList = document.querySelector("#dailyOrdersList");
const deliveredOrdersList = document.querySelector("#deliveredOrdersList");
const statusFilter = document.querySelector("#statusFilter");
const searchFilter = document.querySelector("#searchFilter");
const garmentFilter = document.querySelector("#garmentFilter");
const searchButton = document.querySelector("#searchButton");
const clearSearchButton = document.querySelector("#clearSearchButton");

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function priceOptions() {
  return Object.entries(state.prices)
    .map(([garment, price]) => `<option value="${garment}">${garment} - ${currency.format(price)}</option>`)
    .join("");
}

function addItemRow() {
  const node = itemTemplate.content.cloneNode(true);
  const select = node.querySelector("select");
  select.innerHTML = priceOptions();
  node.querySelector(".remove-item").addEventListener("click", event => {
    event.target.closest(".item-row").remove();
    if (itemsContainer.children.length === 0) addItemRow();
  });
  itemsContainer.appendChild(node);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.details ? payload.details.join(" ") : payload.error);
  }

  return payload;
}

async function loadPrices() {
  const payload = await api("/api/prices");
  state.prices = payload.prices;
  addItemRow();
}

async function loadDashboard() {
  const dashboard = await api("/api/dashboard");
  document.querySelector("#totalOrders").textContent = dashboard.totalOrders;
  document.querySelector("#totalRevenue").textContent = currency.format(dashboard.totalRevenue);
  document.querySelector("#receivedCount").textContent = dashboard.ordersPerStatus.RECEIVED || 0;
  document.querySelector("#readyCount").textContent = dashboard.ordersPerStatus.READY || 0;
  document.querySelector("#deliveredCount").textContent = dashboard.deliveredOrders || 0;
  document.querySelector("#deliveredPanelCount").textContent = dashboard.deliveredOrders || 0;
  renderDailyOrders(dashboard.dailyOrderCounts || []);
  renderDeliveredOrders(dashboard.deliveredOrderDetails || []);
}

function renderDailyOrders(dailyCounts) {
  if (dailyCounts.length === 0) {
    dailyOrdersList.innerHTML = '<div class="empty">No orders taken yet.</div>';
    return;
  }

  dailyOrdersList.innerHTML = dailyCounts.map(day => `
    <div class="daily-row">
      <span>${day.date}</span>
      <strong>${day.count} order${day.count === 1 ? "" : "s"}</strong>
    </div>
  `).join("");
}

function renderDeliveredOrders(orders) {
  if (orders.length === 0) {
    deliveredOrdersList.innerHTML = '<div class="empty">No delivered orders yet.</div>';
    return;
  }

  deliveredOrdersList.innerHTML = orders.map(order => `
    <article class="delivered-row">
      <header>
        <div>
          <h3>${order.customerName}</h3>
          <div class="meta">${order.id} · ${order.phone}</div>
        </div>
        <strong>${currency.format(order.totalAmount)}</strong>
      </header>
      <ul class="items">
        ${order.items.map(item => `
          <li>${item.quantity} x ${item.garment}</li>
        `).join("")}
      </ul>
      <p class="money">Taken: ${order.orderTakenDate || "Not set"} · Delivered: ${String(order.deliveredAt || order.updatedAt || "").slice(0, 10) || "Not set"}</p>
    </article>
  `).join("");
}

function buildQuery() {
  const params = new URLSearchParams();
  if (statusFilter.value) params.set("status", statusFilter.value);
  if (searchFilter.value.trim()) params.set("q", searchFilter.value.trim());
  if (garmentFilter.value.trim()) params.set("garment", garmentFilter.value.trim());
  return params.toString();
}

function renderOrders(orders) {
  if (orders.length === 0) {
    ordersList.innerHTML = '<div class="empty">No orders found.</div>';
    return;
  }

  ordersList.innerHTML = orders.map(order => `
    <article class="order-card">
      <header>
        <div>
          <h3>${order.customerName}</h3>
          <div class="meta">${order.id} · ${order.phone}</div>
        </div>
        <span class="status">${order.status}</span>
      </header>
      <ul class="items">
        ${order.items.map(item => `
          <li>${item.quantity} x ${item.garment} at ${currency.format(item.pricePerItem)} = ${currency.format(item.lineTotal)}</li>
        `).join("")}
      </ul>
      <p class="money">Bill: ${currency.format(order.totalAmount)} · Taken: ${order.orderTakenDate || "Not set"} · Delivery: ${order.estimatedDeliveryDate}</p>
      <div class="order-actions">
        <select data-order-id="${order.id}" aria-label="Update status for ${order.id}">
          ${["RECEIVED", "PROCESSING", "READY", "DELIVERED"].map(status => `
            <option ${status === order.status ? "selected" : ""}>${status}</option>
          `).join("")}
        </select>
        <button type="button" data-update-id="${order.id}">Update Status</button>
      </div>
    </article>
  `).join("");
}

async function loadOrders() {
  const query = buildQuery();
  const payload = await api(`/api/orders${query ? `?${query}` : ""}`);
  renderOrders(payload.orders);
}

async function refresh() {
  await Promise.all([loadDashboard(), loadOrders()]);
}

orderForm.addEventListener("submit", async event => {
  event.preventDefault();
  formMessage.textContent = "Creating order...";

  const form = new FormData(orderForm);
  const items = [...itemsContainer.querySelectorAll(".item-row")].map(row => ({
    garment: row.querySelector('[name="garment"]').value,
    quantity: Number(row.querySelector('[name="quantity"]').value)
  }));

  try {
    const payload = {
      customerName: form.get("customerName"),
      phone: form.get("phone"),
      orderTakenDate: form.get("orderTakenDate"),
      estimatedDeliveryDate: form.get("estimatedDeliveryDate") || undefined,
      items
    };
    const result = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    orderForm.reset();
    orderForm.elements.orderTakenDate.value = todayDate();
    itemsContainer.innerHTML = "";
    addItemRow();
    formMessage.textContent = `Created ${result.orderId}. Total bill ${currency.format(result.totalAmount)}.`;
    await refresh();
  } catch (error) {
    formMessage.textContent = error.message;
  }
});

ordersList.addEventListener("click", async event => {
  const orderId = event.target.dataset.updateId;
  if (!orderId) return;

  const select = ordersList.querySelector(`select[data-order-id="${orderId}"]`);
  await api(`/api/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: select.value })
  });
  await refresh();
});

document.querySelector("#addItemButton").addEventListener("click", addItemRow);
document.querySelector("#refreshButton").addEventListener("click", refresh);
statusFilter.addEventListener("input", loadOrders);
searchButton.addEventListener("click", loadOrders);
clearSearchButton.addEventListener("click", () => {
  statusFilter.value = "";
  searchFilter.value = "";
  garmentFilter.value = "";
  loadOrders();
});
[searchFilter, garmentFilter].forEach(input => {
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadOrders();
    }
  });
});

orderForm.elements.orderTakenDate.value = todayDate();
loadPrices().then(refresh).catch(error => {
  ordersList.innerHTML = `<div class="empty">${error.message}</div>`;
});
