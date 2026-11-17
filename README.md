# MentorMinutes 🎯
### Full-Stack Mentoring Session & Progress Management Platform with Automatic Action Carry-Forward

MentorMinutes is a centralized, production-grade mentoring platform built for mentors and learners to plan sessions, record structured discussions, track multi-stage goals, and maintain accountability across sessions with **Automatic Action Carry-Forward**.

---

## 🌟 The Core Innovation: Automatic Action Carry-Forward

A common failure mode in mentoring relationships is **forgotten commitments**: tasks agreed upon in one session are overlooked when the next session arrives.

MentorMinutes solves this with an **idempotent Automatic Action Carry-Forward engine**:
1. When a new session is scheduled, the backend queries the previous session for all unfinished action items (`pending` or `in-progress`).
2. Completed and cancelled items remain in their original session.
3. Unfinished items are automatically duplicated into the new session follow-up agenda with:
   - Preserved original session references (`originalSession`).
   - Self-referencing lineage (`carriedForwardFrom`).
   - Incremented carry counter (`carryCount`, displayed as `Carried x1`, `Carried x2`, etc.).
   - Full carry audit history (`carryHistory`: timestamp, fromSession, toSession, reason).
4. The previous items are marked `carried: true` so they are **never duplicated** on repeated calls or page refreshes.
5. In the UI, mentors can preview and review carried items before confirming the new session.

---

## 🚀 Key Modules & Capabilities

- **Role-Based Authentication**: Secure JWT authentication with bcrypt password hashing for **Mentor** and **Learner** roles.
- **Invitation System**: Mentors generate unique invite codes (e.g., `MM-ARCH99`) allowing learners to join in one click.
- **Session Management**: Session title, date, duration, agenda, topics discussed, key takeaways, and shared summaries.
- **Strict Private Notes Separation**: Confidential `mentorPrivateNotes` are strictly scrubbed in backend API responses before ever reaching learner accounts.
- **Dynamic Goals & Milestones**: Multi-category goals (Technical, Career, Project, Soft Skills, Academic) with interactive milestone checklists that dynamically recalculate progress percentages in real time.
- **Centralized Action Items Board**: Filter by status, priority, due date, overdue alerts, and view complete carry-forward lineage.
- **Chronological Journey Timeline**: Unified timeline capturing sessions, goals achieved, and tasks carried forward.
- **Analytics & Exportable Reports**: Printable / PDF-ready summary reports featuring session attendance, action completion efficiency, and carry-forward audits.
- **In-App Notification Center**: Read/unread notifications for session bookings, task assignments, and goal completions.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, React Router 6, Tailwind CSS, Lucide React, Recharts, Axios |
| **Backend** | Node.js, Express.js, REST API architecture, Helmet, CORS, Morgan, express-validator |
| **Database** | MongoDB (Mongoose models & indexing) with zero-config in-memory fallback for instant dev/tests |
| **Testing** | Node test runner, Supertest, automated carry-forward & privacy isolation suites |

---

## ⚡ Quick Start Guide

### Prerequisites
- Node.js 18+ (tested on Node 24)
- npm 9+

### 1. Installation

From the project root:
```bash
# Install root orchestration tools
npm install

# Install server dependencies
cd server
npm install
cp .env.example .env

# Install client dependencies
cd ../client
npm install
cp .env.example .env
```

### 2. Seed Demonstration Data

The project includes realistic demonstration data (2 Mentors, 4 Learners, 4 Mentoring Relationships, multi-session carry-forwards, and goals):

```bash
cd server
npm run seed
```

*(Note: The server also auto-seeds demonstration data on first launch if the database is empty!)*

### 3. Run the Application

From the project root:
```bash
# Starts both Backend (port 5000) and Frontend (port 5173) concurrently
npm run dev
```

Or run each service individually:
```bash
# Terminal 1 - Backend API (http://localhost:5000)
cd server
npm run dev

# Terminal 2 - Frontend UI (http://localhost:5173)
cd client
npm run dev
```

Open your browser at **http://localhost:5173**.

---

## 🔑 Demonstration Accounts

All demonstration accounts use the password: **`Password123!`**

| Persona | Role | Email | Highlights |
|---|---|---|---|
| **Dr. Sarah Mitchell** | **Mentor** | `sarah.mitchell@mentorminutes.dev` | Principal Architect, Invite Code: `MM-ARCH99`, 2 mentees |
| **Alex Rivera** | **Mentor** | `alex.rivera@mentorminutes.dev` | Lead Full-Stack Engineer, Invite Code: `MM-CODE42` |
| **Emily Chen** | **Learner** | `emily.chen@mentorminutes.dev` | Junior Developer with carried-forward tasks from Session 1 & 2 |
| **Marcus Johnson** | **Learner** | `marcus.j@mentorminutes.dev` | Associate Backend Engineer |
| **Priya Sharma** | **Learner** | `priya.sharma@mentorminutes.dev` | CS Senior Student |
| **David Kim** | **Learner** | `david.kim@mentorminutes.dev` | Career Switcher |

*(You can also use the **1-Click Demo persona buttons** directly on the Login page!)*

---

## 📡 REST API Reference

### Health
- `GET /api/health` — Service status, database connection state, and uptime.

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Create a new mentor or learner account.
- `POST /api/auth/login` — Sign in and receive JWT token.
- `GET /api/auth/me` — Retrieve active authenticated user profile.
- `PUT /api/auth/profile` — Update bio, title, avatar, and settings.
- `PUT /api/auth/password` — Change password.

### Relationships (`/api/relationships`)
- `GET /api/relationships` — List all mentoring relationships for user.
- `GET /api/relationships/:id` — View single relationship (strictly authorized).
- `POST /api/relationships` — Mentors create a relationship with a learner.
- `POST /api/relationships/join-by-code` — Learners join a mentorship via mentor's invite code.
- `PUT /api/relationships/:id` — Update status, topic, or meeting cadence.

### Sessions & Carry-Forward (`/api/sessions`)
- `GET /api/sessions` — List sessions (private mentor notes stripped for learners).
- `GET /api/sessions/preview-carry-forward?relationshipId=...` — Preview tasks to be carried forward before creating a new session.
- `GET /api/sessions/:id` — Session workspace with associated action items.
- `POST /api/sessions` — Schedule session; **triggers automatic carry-forward**.
- `PUT /api/sessions/:id` — Update notes, takeaways, feedback, and status.
- `DELETE /api/sessions/:id` — Delete session (un-carries items so nothing is lost).

### Action Items (`/api/actions`)
- `GET /api/actions` — Filter by relationship, session, status, priority, or overdue.
- `GET /api/actions/:id` — Detailed action item with full carry-forward lineage.
- `POST /api/actions` — Create new action item for a session.
- `PATCH /api/actions/:id/status` — Update status (`pending`, `in-progress`, `completed`, `cancelled`).
- `PUT /api/actions/:id` — Update title, priority, due date, or assignee.
- `DELETE /api/actions/:id` — Remove action item.

### Goals & Milestones (`/api/goals`)
- `GET /api/goals` — List goals filtered by category, status, or priority.
- `POST /api/goals` — Create goal with target date and milestones.
- `PUT /api/goals/:id` — Edit goal details.
- `PATCH /api/goals/:id/milestones/:milestoneId` — Toggle milestone completion; recalculates goal progress %.
- `POST /api/goals/:id/milestones` — Add a milestone to an existing goal.
- `DELETE /api/goals/:id` — Remove goal.

### Reports & Timeline (`/api/reports`)
- `GET /api/reports/dashboard` — Aggregated dashboard statistics and distribution metrics.
- `GET /api/reports/timeline` — Unified chronological event stream.

### Notifications (`/api/notifications`)
- `GET /api/notifications` — In-app alerts with unread counter.
- `PATCH /api/notifications/:id/read` — Mark individual or all notifications as read.
- `DELETE /api/notifications/:id` — Dismiss notification.

---

## 🧪 Automated Testing

MentorMinutes includes automated integration test suites:
- **Carry-Forward Idempotency Test**: Verifies unfinished items carry forward with incremented counters and prevents duplicate creation.
- **Privacy Guard Test**: Confirms private mentor notes are accessible by mentors and strictly stripped from learner responses.
- **Cross-User Access Restriction Test**: Verifies unrelated users are forbidden (403) from accessing private mentoring workspaces.

Run the tests:
```bash
cd server
npm test
```

---

## 🌐 Production Deployment Guide

### Frontend Deployment (Vercel)
1. Build command: `npm run build`
2. Output directory: `dist`
3. Environment variables: `VITE_API_URL=https://your-backend.onrender.com/api`

### Backend Deployment (Render)
1. Build command: `npm install`
2. Start command: `node src/index.js`
3. Environment variables:
   - `PORT=5000`
   - `NODE_ENV=production`
   - `MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/mentorminutes?retryWrites=true&w=majority`
   - `JWT_SECRET=<strong-random-key>`
   - `CLIENT_URL=https://your-frontend.vercel.app`

### Database (MongoDB Atlas)
1. Create a free shared M0 cluster on MongoDB Atlas.
2. Under Network Access, allow IP access (e.g. `0.0.0.0/0` for cloud deployment).
3. Under Database Access, create a database user with read/write privileges.
4. Copy the connection string into the backend's `MONGODB_URI`.

---

## 📄 License
MIT License. Built for professional mentoring excellence, demonstration, and portfolio presentation.
