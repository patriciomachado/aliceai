# Alice - API Documentation (API v1) 📡

This document describes all Express REST API endpoints, including JSON schemas, expected parameters, and HTTP responses.

---

## 🔐 Autenticação (Clerk JWT)

All endpoints (except Webhooks and Public checks) require session validation via Clerk tokens passed in the header:
```http
Authorization: Bearer <clerk_jwt_token>
```

---

## 👥 Clientes (CRM)

### `GET /api/customers`
- **Description**: Returns all customers matching optional queries.
- **Query Params**:
  - `search` (string): Text filter on name, email, or phone.
  - `tag` (string): Filters customers having specific tag.
- **Response (200 OK)**:
```json
[
  {
    "id": "c1a2b3c4-...",
    "workspace_id": "...",
    "name": "Juliana Silva",
    "email": "juliana@gmail.com",
    "phone": "11988887777",
    "whatsapp": "11988887777",
    "tags": ["vip", "lead-quente"],
    "lifetime_value": 1250.00,
    "created_at": "2026-05-15T..."
  }
]
```

### `POST /api/customers`
- **Description**: Creates customer profile.
- **Request Body (Zod Validated)**:
```json
{
  "name": "Camila Fernandes",
  "email": "camila@yahoo.com",
  "phone": "31966665555",
  "whatsapp": "31966665555",
  "tags": ["novo-lead"]
}
```
- **Response (201 Created)**: Customer object.

### `PUT /api/customers/:id`
- **Description**: Updates customer specifications.
- **Response (200 OK)**: Updated customer object.

### `DELETE /api/customers/:id`
- **Description**: Removes customer.
- **Response (200 OK)**: `{ "success": true, "message": "Customer deleted successfully" }`

---

## 💬 Conversas & Inbox

### `GET /api/conversations`
- **Description**: Retrieves all active or archived threads.
- **Query Params**:
  - `status` (active, closed, archived)
  - `assigned_to` (UUID operator)
- **Response (200 OK)**: Array of conversations with nested customer details.

### `PUT /api/conversations/:id/status`
- **Description**: Assigns operators or toggles conversation state.
- **Request Body**:
```json
{
  "status": "closed",
  "assigned_to": "agent-uuid-here"
}
```

### `GET /api/conversations/:id/messages`
- **Description**: Historical list of messages inside a thread.
- **Response (200 OK)**: Array of messages.

### `POST /api/conversations/:id/messages`
- **Description**: Sends a message (agent replies or simulates inbound customer webhooks).
- **Request Body**:
```json
{
  "content": "Olá! Qual o prazo de entrega?",
  "sender_type": "agent"
}
```
- **Response (201 Created)**: Saved message.

---

## 📦 Produtos

### `GET /api/products`
- **Description**: Lists SKU catalog.
- **Query Params**:
  - `category` (string)
  - `search` (string)

### `POST /api/products`
- **Description**: Creates product item.
- **Request Body (Zod Validated)**:
```json
{
  "name": "Pack de Templates Premium",
  "price": 97.00,
  "stock": 500,
  "category": "Infoprodutos",
  "sku": "TMP-PRE-03"
}
```

---

## 🛒 Pedidos

### `POST /api/orders`
- **Description**: Compiles items prices and builds a dynamic Stripe Checkout Session link.
- **Request Body (Zod Validated)**:
```json
{
  "customer_id": "customer-uuid-here",
  "items": [
    { "product_id": "product-uuid-here", "quantity": 1 }
  ],
  "payment_method": "credit_card"
}
```
- **Response (201 Created)**:
```json
{
  "order": { "id": "...", "total_amount": 97.00, "status": "pending" },
  "stripeSessionId": "cs_test_...",
  "paymentUrl": "https://checkout.stripe.com/..."
}
```

---

## 📅 Agendamentos

### `GET /api/appointments/availability`
- **Description**: Simulates Google Calendar time-slots search.
- **Response (200 OK)**: `{ "date": "2026-05-23", "availableSlots": [...] }`

### `POST /api/appointments`
- **Description**: Creates appointment.
- **Request Body**:
```json
{
  "customer_id": "customer-uuid-here",
  "service_type": "Mentoria VIP",
  "scheduled_date": "2026-05-24",
  "scheduled_time": "14:00"
}
```

---

## 🔌 Integrações & Webhooks

### `POST /api/webhooks/meta`
- **Description**: Entrypoint for Meta Graph API triggers. Parses inbound WhatsApp messages, saves them in the database, and adds tasks to the background Bull queue to trigger AI-responses.

### `POST /api/webhooks/stripe`
- **Description**: Stripe webhook triggers listener. Resolves completed sessions and marks corresponding database orders as `completed`/`confirmed`.
