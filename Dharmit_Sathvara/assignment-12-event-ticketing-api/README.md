# Event Management & Ticketing API

A high-concurrency, production-ready Event Ticketing & Live Booking REST API built with Node.js, Express, and Firebase Firestore. Secured with JWT Role-Based Access Control (RBAC), hardened with rate-limiting against ticket-scalping bots, and documented with Swagger/OpenAPI 3.0.

---

## 📌 Features

- **ACID Transactions (`runTransaction`)**: Atomic ticket decrement and inventory management to prevent overselling under high concurrency.
- **Custom JWT Authentication & RBAC**: Secure authentication with `bcryptjs` password hashing and role enforcement (`organizer` vs `attendee`).
- **Anti-Bot Rate Limiting**: Max 10 booking requests/min per user on `POST /api/tickets/book` via `express-rate-limit`.
- **Interactive Swagger/OpenAPI 3.0**: Complete API documentation and interactive test console available at `/api-docs`.
- **Dual-Mode Firebase Admin Config**: Seamless switching between local `serviceAccountKey.json` and production `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable (for Render/cloud deployments).
- **Cascade Operations & Inventory Restores**: Event deletion cascade-cancels tickets, and ticket cancellation restores capacity atomically.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Firebase Firestore (`firebase-admin`)
- **Security & Auth**: `jsonwebtoken`, `bcryptjs`, `cors`
- **Rate Limiting**: `express-rate-limit`
- **Documentation**: `swagger-ui-express`, `swagger-jsdoc` (OpenAPI 3.0)
- **Environment**: `dotenv`

---

## 🗄️ Firestore Collections & Schemas

### `users` collection
```json
{
  "id": "usr_organizer_01",
  "name": "Dharmit Sathvara",
  "email": "dharmit@example.com",
  "passwordHash": "$2a$12$...",
  "role": "organizer",
  "createdAt": "2026-03-01T10:00:00.000Z"
}
```

### `events` collection
```json
{
  "id": "event_techconf_2026",
  "title": "Global Cloud & AI Summit 2026",
  "description": "Annual flagship backend conference",
  "category": "Technology",
  "eventDate": "2026-06-15T09:00:00.000Z",
  "venue": "Bandra Kurla Complex, Mumbai",
  "organizerId": "usr_organizer_01",
  "ticketPrice": 1499,
  "totalCapacity": 500,
  "availableTickets": 482,
  "createdAt": "2026-03-01T12:00:00.000Z"
}
```

### `tickets` collection
```json
{
  "id": "ticket_rec_88219",
  "eventId": "event_techconf_2026",
  "eventTitle": "Global Cloud & AI Summit 2026",
  "userId": "usr_attendee_99",
  "attendeeName": "Kunal Sharma",
  "attendeeEmail": "kunal@gmail.com",
  "quantity": 2,
  "totalPaid": 2998,
  "bookingRef": "TKT-2026-88219",
  "status": "confirmed",
  "bookedAt": "2026-03-02T16:20:00.000Z"
}
```

---

## 🏗️ Folder Structure

```
assignment-12-event-ticketing-api/
├── config/
│   ├── firebaseConfig.js     # Dual-mode Firebase Admin SDK setup
│   └── swagger.js            # Swagger/OpenAPI 3.0 specification
├── controllers/
│   ├── authController.js     # Register, login, profile logic
│   ├── eventController.js    # Event CRUD + attendee listings
│   └── ticketController.js   # ACID transactional booking & cancellation
├── middleware/
│   ├── auth.js               # JWT bearer verification middleware
│   ├── checkRole.js          # Role-based authorization middleware
│   └── rateLimiter.js        # Anti-scalping rate limiter (10 req/min)
├── routes/
│   ├── authRoutes.js         # Auth routes with Swagger JSDoc
│   ├── eventRoutes.js        # Event routes with Swagger JSDoc
│   └── ticketRoutes.js       # Ticket routes with Swagger JSDoc
├── .env.example              # Environment variables template
├── .gitignore                # Protects credentials and dependencies
├── package.json              # Project dependencies and npm scripts
├── server.js                 # App entry point & error handler
└── README.md                 # Complete documentation & testing guide
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- A [Firebase](https://console.firebase.google.com/) Project with Firestore Database created

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/dharmitsathvara29-max/assignment-12-event-management-ticketing-api.git

# Navigate into the project directory
cd assignment-12-event-management-ticketing-api/Dharmit_Sathvara/assignment-12-event-ticketing-api

# Install dependencies
npm install
```

### 3. Firebase Setup & Service Account
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Create or select your project.
3. In the sidebar, navigate to **Firestore Database** → **Create Database** (Start in production or test mode).
4. Go to **Project Settings** (gear icon) → **Service Accounts** tab.
5. Click **Generate new private key** → Download the JSON file.
6. Rename the downloaded file to `serviceAccountKey.json` and place it in the project root:
   ```
   assignment-12-event-ticketing-api/serviceAccountKey.json
   ```
   *(Note: This file is listed in `.gitignore` and must NEVER be committed to Git).*

### 4. Environment Variables
Create a `.env` file in the project root:
```env
PORT=5000
JWT_SECRET=your_super_secret_jwt_random_key_string_32chars
```

### 5. Running the Application
```bash
# Development mode (with auto-restart via nodemon)
npm run dev

# Production mode
npm start
```

Once started:
- API Server: `http://localhost:5000`
- Swagger UI Documentation: `http://localhost:5000/api-docs`

---

## 📋 API Endpoints Reference

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register as `organizer` or `attendee` |
| `POST` | `/api/auth/login` | Public | Authenticate and obtain JWT token |
| `GET` | `/api/auth/profile` | Authenticated | Get current authenticated user profile |

### 🎪 Events (`/api/events`)
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/events` | Public | Browse upcoming events (Filters: `?category=`, `?city=`) |
| `GET` | `/api/events/:id` | Public | Get event details with live `availableTickets` |
| `POST` | `/api/events` | `organizer` | Create a new event |
| `PUT` | `/api/events/:id` | `organizer` (Owner) | Update an event |
| `DELETE` | `/api/events/:id` | `organizer` (Owner) | Delete event & cascade-cancel tickets |
| `GET` | `/api/events/:id/attendees` | `organizer` (Owner) | List all registered attendees for event |

### 🎟️ Tickets (`/api/tickets`)
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/api/tickets/book` | `attendee` | **ACID Transaction Booking** (Rate limited: 10 req/min) |
| `GET` | `/api/tickets/my-tickets` | `attendee` | List tickets booked by current user |
| `POST` | `/api/tickets/:id/cancel` | `attendee` (Owner) | Cancel ticket & restore event capacity |

---

## 🧪 Testing & Verification Guide

### 1. Interactive Swagger UI
Visit `http://localhost:5000/api-docs`. You can authorize by clicking the **Authorize** button at the top right and typing `Bearer <your_token>`.

### 2. High-Concurrency Stress Test (ACID Verification)
To verify that Firestore ACID transactions prevent overselling:
1. Register an organizer and create an event with `totalCapacity: 5`.
2. Register an attendee and obtain their token.
3. Fire 10 concurrent requests booking 1 ticket each (e.g. using `curl` in background or a concurrent script).
4. **Expected Outcome**: Exactly 5 requests return `201 Created`, and 5 requests return `400 Insufficient tickets available`. The event's `availableTickets` in Firestore remains exactly `0` and never drops below zero.

### 3. Anti-Scalping Rate Limiter Test
1. Make 11 rapid booking requests within 60 seconds with an attendee token to `POST /api/tickets/book`.
2. **Expected Outcome**: The 11th request receives `429 Too Many Requests`:
```json
{
  "success": false,
  "message": "Too many booking requests, slow down."
}
```

---

## 🚀 Production Deployment (Render)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "feat: complete event ticketing API"
   git push origin main
   ```
2. **Create Web Service on Render**:
   - Connect your GitHub repository.
   - **Root Directory**: `Dharmit_Sathvara/assignment-12-event-ticketing-api`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. **Set Environment Variables on Render**:
   - `JWT_SECRET`: A secure random string
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: Paste the entire contents of your `serviceAccountKey.json` as a single raw JSON string.
4. **Deploy**: Render will automatically build, deploy, and expose your API with live Swagger docs at `https://<your-render-subdomain>.onrender.com/api-docs`.
