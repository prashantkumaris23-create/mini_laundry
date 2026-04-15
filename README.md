# Mini Laundry Order Management System

A simple order management app for a dry-cleaning or laundry shop.

The app helps store staff create laundry orders, calculate bills, update order status, search orders, and see dashboard summaries such as revenue, delivered orders, and orders taken by date.

## Project Summary

This project was built to be small, fast, and easy to review. It uses a Node.js backend with no external dependencies, stores data in a local JSON file, and includes a simple browser UI.

## What You Can Do

- Create a new laundry order.
- Add customer name and phone number.
- Add the date when the order was taken.
- Add garments such as Shirt, Pants, Saree, Coat, Suit, Dress, and Bedsheet.
- Automatically calculate the total bill.
- Get a unique order ID.
- Update order status.
- Search by customer name, phone number, or garment type.
- View active orders separately from delivered orders.
- See delivered orders in a separate delivered orders dashboard.
- View total orders, revenue, status counts, and daily order counts.

## Tech Stack

- Backend: Node.js built-in `http` module
- Frontend: HTML, CSS, and plain JavaScript
- Storage: JSON file at `data/orders.json`
- API collection: Postman collection included
- Dependencies: none

## Folder Structure

```text
mini laundry order/
  data/
    orders.json
  public/
    index.html
    styles.css
    app.js
  src/
    server.js
  postman_collection.json
  start-server.bat
  package.json
  README.md
```

## Setup Instructions

Install Node.js 18 or newer.

Then run:

```bash
npm start
```

Open the app in your browser:

```text
http://localhost:3000
```

On Windows, you can also double-click:

```text
start-server.bat
```

For development mode with auto-restart:

```bash
npm run dev
```

## How To Use The App

1. Open `http://localhost:3000`.
2. Fill in customer name, phone number, and order taken date.
3. Add one or more garments.
4. Select quantity for each garment.
5. Optionally select an estimated delivery date.
6. Click **Create Order**.
7. The order appears in the Orders section with total bill amount.
8. Change the status using the dropdown and click **Update Status**.
9. When an order becomes `DELIVERED`, it moves into the Delivered Orders dashboard.

## Order Statuses

Each order can have one of these statuses:

```text
RECEIVED
PROCESSING
READY
DELIVERED
```

By default, the main Orders list shows active orders only. Delivered orders are shown in the Delivered Orders dashboard. You can also select `DELIVERED` in the status filter to view delivered orders in the main list.

## Search And Filters

The UI includes:

- Status filter
- Customer name or phone search
- Garment type search
- Search button
- Clear button

Typing a search term can find both active and delivered orders. This makes it easy to find old delivered orders by customer name or phone number.

## Price List

The app uses a hardcoded price list:

| Garment | Price |
| --- | ---: |
| Shirt | 60 |
| Pants | 80 |
| Saree | 150 |
| Suit | 250 |
| Dress | 180 |
| Coat | 220 |
| Bedsheet | 120 |

## Dashboard

The dashboard shows:

- Total orders
- Total revenue
- Received orders count
- Ready orders count
- Delivered orders count
- Orders taken by date
- Delivered order details

Delivered order details include customer name, phone number, order ID, garments, total bill, order taken date, and delivered date.

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Check if the server is running |
| `GET` | `/api/prices` | Get garment price list |
| `POST` | `/api/orders` | Create a new order |
| `GET` | `/api/orders` | List active orders |
| `GET` | `/api/orders?status=DELIVERED` | List delivered orders |
| `GET` | `/api/orders?q=rohit` | Search by customer name or phone |
| `GET` | `/api/orders?garment=shirt` | Search by garment type |
| `GET` | `/api/orders/:id` | Get a single order |
| `PATCH` | `/api/orders/:id/status` | Update order status |
| `GET` | `/api/dashboard` | Get dashboard summary data |

## Create Order API Example

Request:

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Asha Kumar",
    "phone": "9876543210",
    "orderTakenDate": "2026-04-15",
    "estimatedDeliveryDate": "2026-04-18",
    "items": [
      { "garment": "Shirt", "quantity": 2 },
      { "garment": "Saree", "quantity": 1 }
    ]
  }'
```

Response:

```json
{
  "orderId": "LND-20260415-0001",
  "totalAmount": 270,
  "order": {
    "id": "LND-20260415-0001",
    "customerName": "Asha Kumar",
    "phone": "9876543210",
    "status": "RECEIVED",
    "orderTakenDate": "2026-04-15",
    "totalAmount": 270
  }
}
```

## Update Status API Example

```bash
curl -X PATCH http://localhost:3000/api/orders/LND-20260415-0001/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DELIVERED"
  }'
```

When an order is changed to `DELIVERED`, the app stores a delivered timestamp and shows the order in the Delivered Orders dashboard.

## Postman Collection

A Postman collection is included:

```text
postman_collection.json
```

Import this file into Postman and run the API requests locally with:

```text
http://localhost:3000
```

## Features Implemented

- Create orders
- Unique order IDs
- Bill calculation
- Order taken date
- Estimated delivery date
- Status update
- Active orders list
- Delivered orders dashboard
- Search by customer name or phone
- Search by garment type
- Filter by status
- Orders taken by date summary
- Dashboard totals
- JSON file persistence
- Simple frontend UI
- Postman collection

## AI Usage Report

AI tools used:

- ChatGPT / Codex

How AI was used:

- To plan the project structure.
- To scaffold the Node.js API.
- To build the simple HTML, CSS, and JavaScript UI.
- To improve search, dashboard behavior, and delivered order handling.
- To write and improve this README.
- To debug localhost and API behavior during development.

Sample prompts:

- "Build a Mini Laundry Order Management System with create order, status management, billing, order listing, filters, and dashboard."
- "Keep it simple and avoid over-engineering."
- "Add a simple frontend and Postman collection."
- "Move delivered orders to a separate dashboard."
- "Make the README easier to understand."

What AI got wrong or needed correction:

- It first suggested a larger framework, but this project needed a quick and simple implementation.
- It originally hid delivered orders from the default order list, which made search feel broken when searching for delivered customers.
- Some UI layouts became cramped, so the layout was adjusted to a cleaner two-column structure.

What was improved manually:

- Kept the app dependency-free.
- Added JSON persistence instead of only in-memory data.
- Improved the delivered orders dashboard.
- Added clearer search controls.
- Added validation for customer details, phone number, items, prices, dates, and statuses.
- Improved README structure for easier review.

## Tradeoffs

What was skipped:

- User login and authentication
- Database such as MongoDB, PostgreSQL, or SQLite
- Formal automated test suite
- Deployment
- Payment tracking
- Invoice or receipt PDF generation
- Strict status transition rules

Why these were skipped:

The assignment asked for a lightweight system and warned against over-engineering. JSON file storage and a simple Node.js server are enough to demonstrate the core workflow quickly.

What I would improve with more time:

- Add SQLite or PostgreSQL.
- Add login for store staff.
- Add automated tests.
- Add paid/unpaid billing status.
- Add printable receipts.
- Add customer order history.
- Deploy the app on Render, Railway, or another hosting platform.

CODED by Prashant Kumar