# THREAD API - Decision Intelligence Backend

THREAD API is the backend service for THREAD, a full-stack decision intelligence platform designed to help teams capture important decisions, preserve their reasoning, understand relationships between decisions, and maintain a traceable history of how decisions evolve.

The API provides authentication, collaborative workspaces, project management, decision tracking, decision relationships, impact analysis, activity history, search, and role-based workspace access.

## Live API

**Production API:** https://thread-api-1kwd.onrender.com

**Health Check:** https://thread-api-1kwd.onrender.com/api/v1/health

**Frontend:** https://thread-client-two.vercel.app

**Frontend Repository:** https://github.com/FAVOUR-EGBUNA/thread-client

---

## Overview

THREAD is built around the idea that important decisions should not disappear into chat messages, documents, or disconnected notes.

The backend provides a structured data model for recording decisions within projects and workspaces while preserving context, reasoning, status changes, relationships, and activity history.

A decision can be connected to other decisions through relationships such as dependencies, conflicts, support, impact, or supersession. This allows THREAD to represent decisions as an interconnected system rather than isolated records.

---

## Core Features

### Authentication

THREAD provides JWT-based authentication for user accounts.

Supported authentication operations include:

- User registration
- User login
- Authenticated user retrieval
- Password hashing
- Protected API routes

### Workspaces

Users can create and participate in collaborative workspaces.

Workspace functionality includes:

- Create workspaces
- List accessible workspaces
- Retrieve workspace details
- Update workspace information
- View workspace members
- Add workspace members
- Change member roles
- Remove members

### Role-Based Workspace Access

Workspace membership supports three roles:

```text
OWNER
ADMIN
MEMBER
```

Workspace permissions are enforced by the backend to control access to workspace resources and administrative operations.

### Projects

Projects organise related decisions within a workspace.

The API supports:

- Project creation
- Project listing
- Project retrieval
- Project updates
- Project deletion
- Decision listing within a project
- Project graph generation

### Decisions

Decisions are the central domain entity in THREAD.

Each decision can contain:

- Title
- Context
- Decision
- Reasoning
- Status
- Project association
- Relationships
- Status history
- Creation and update timestamps

### Decision Lifecycle

THREAD tracks decisions through defined lifecycle states:

```text
PROPOSED
ACCEPTED
REJECTED
SUPERSEDED
```

Status changes are recorded separately so that the evolution of a decision remains traceable.

### Decision Status History

Each recorded status change stores:

- Previous status
- New status
- Decision
- User responsible for the change
- Timestamp

This creates an auditable history of how a decision progressed over time.

### Decision Relationships

Decisions can be connected to other decisions using typed relationships.

Supported relationship types include:

```text
DEPENDS_ON
AFFECTS
SUPPORTS
CONFLICTS_WITH
SUPERSEDES
RELATED_TO
```

These relationships allow THREAD to represent dependencies and interactions between decisions.

### Impact Analysis

The API exposes decision impact data that can be used to understand how an individual decision relates to other decisions in the system.

### Decision Graph

Project-level graph data allows the frontend to visualise decisions and their relationships as an interconnected network.

### Search

Authenticated users can search THREAD data through the API rather than manually navigating individual projects and decisions.

### Activity Logging

THREAD records workspace activity using structured activity logs.

Activity records can include:

- Action
- Entity type
- Entity identifier
- Metadata
- User
- Workspace
- Timestamp

This provides a historical view of meaningful activity within a workspace.

---

## Tech Stack

### Runtime and Language

- Node.js
- TypeScript
- Express 5

### Database

- PostgreSQL
- Prisma ORM

### Authentication and Security

- JSON Web Tokens
- bcryptjs
- Helmet
- CORS
- Express Rate Limit

### Validation

- Zod

### Development and Testing

- tsx
- TypeScript
- Vitest
- Supertest

### Deployment

- Render

---

## Architecture

THREAD follows a layered backend architecture.

```text
HTTP Request
     |
     v
Express Router
     |
     v
Authentication / Middleware
     |
     v
Controller
     |
     v
Service
     |
     v
Prisma
     |
     v
PostgreSQL
```

The main responsibilities are separated across:

```text
src/
|-- config/
|-- controllers/
|-- middlewares/
|-- prisma/
|-- routes/
|-- schemas/
|-- services/
|-- utils/
|-- app.ts
`-- server.ts
```

### Routes

Routes define the HTTP interface and connect incoming requests to controllers.

### Controllers

Controllers handle HTTP-level concerns such as request parameters, request bodies, status codes, and responses.

### Services

Services contain application and domain logic and interact with the persistence layer.

### Schemas

Zod schemas provide validation for incoming application data.

### Middleware

Middleware handles cross-cutting concerns including authentication and error handling.

### Prisma Layer

The Prisma layer defines the application's relational data contract and provides database access.

---

## Data Model

The primary entities in THREAD are:

```text
User
 |
 +---- WorkspaceMember ---- Workspace
                              |
                              +---- Project
                                      |
                                      +---- Decision
                                              |
                                              +---- DecisionRelation
                                              |
                                              +---- DecisionStatusHistory

User -------- ActivityLog -------- Workspace
```

### User

Represents an authenticated THREAD user.

A user can:

- Belong to multiple workspaces
- Make decision status changes
- Generate workspace activity

### Workspace

Represents a collaborative environment containing members, projects, and activity.

### WorkspaceMember

Connects users to workspaces and assigns a workspace role.

A unique constraint prevents duplicate membership for the same user and workspace.

### Project

Belongs to a workspace and contains decisions.

### Decision

Belongs to a project and stores the actual decision record, including its context, outcome, reasoning, and lifecycle status.

### DecisionRelation

Creates a typed connection between a source decision and a target decision.

A unique constraint prevents duplicate relationships with the same source, target, and relationship type.

### DecisionStatusHistory

Preserves the transition history of a decision.

### ActivityLog

Records significant workspace activity and associates that activity with both a user and workspace.

---

## API Base Path

All API endpoints use:

```text
/api/v1
```

---

## API Endpoints

### Health

```text
GET /api/v1/health
```

Returns the current health status of the THREAD API.

### Authentication

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

The `/me` endpoint requires authentication.

### Workspaces

```text
POST   /api/v1/workspaces
GET    /api/v1/workspaces
GET    /api/v1/workspaces/:workspaceId
PATCH  /api/v1/workspaces/:workspaceId
GET    /api/v1/workspaces/:workspaceId/members
POST   /api/v1/workspaces/:workspaceId/members
PATCH  /api/v1/workspaces/:workspaceId/members/:memberId/role
DELETE /api/v1/workspaces/:workspaceId/members/:memberId
```

### Projects

```text
POST   /api/v1/workspaces/:workspaceId/projects
GET    /api/v1/workspaces/:workspaceId/projects
GET    /api/v1/projects/:projectId
PATCH  /api/v1/projects/:projectId
DELETE /api/v1/projects/:projectId
GET    /api/v1/projects/:projectId/decisions
GET    /api/v1/projects/:projectId/graph
```

### Decisions

```text
POST  /api/v1/projects/:projectId/decisions
GET   /api/v1/decisions/:decisionId
GET   /api/v1/decisions/:decisionId/history
PATCH /api/v1/decisions/:decisionId
PATCH /api/v1/decisions/:decisionId/status
```

### Decision Relationships

```text
POST   /api/v1/decisions/:decisionId/relations
DELETE /api/v1/decision-relations/:relationId
GET    /api/v1/decisions/:decisionId/impact
```

### Search

```text
GET /api/v1/search
```

### Activity

```text
GET /api/v1/workspaces/:workspaceId/activity
```

With the exception of registration, login, and the health endpoint, application resources are protected by authentication.

---

## Security

THREAD includes several API-level security controls.

### JWT Authentication

Protected routes require an authenticated user.

### Password Hashing

User passwords are stored as hashes rather than plaintext passwords.

### Helmet

Helmet configures security-related HTTP response headers.

### CORS

The API accepts requests from configured frontend origins.

Local development supports:

```text
http://localhost:5173
```

A production client origin can be configured using the `CLIENT_URL` environment variable.

### Rate Limiting

General API requests are limited to:

```text
300 requests per 15 minutes
```

Authentication routes use a stricter limit:

```text
20 requests per 15 minutes
```

### Request Body Limit

JSON request bodies are limited to:

```text
100kb
```

---

## Environment Variables

Create a `.env` file in the project root.

Example:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secure_secret_with_at_least_32_characters
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

For the test environment:

```env
NODE_ENV=test
TEST_DATABASE_URL=your_test_postgresql_connection_string
JWT_SECRET=your_secure_test_secret_with_at_least_32_characters
JWT_EXPIRES_IN=7d
```

### Environment Rules

- `NODE_ENV` can be `development`, `test`, or `production`.
- `PORT` defaults to `5000`.
- `DATABASE_URL` is required outside the test environment.
- `TEST_DATABASE_URL` is required when `NODE_ENV=test`.
- `JWT_SECRET` must contain at least 32 characters.
- `JWT_EXPIRES_IN` defaults to `7d`.
- `CLIENT_URL` is optional.

Never commit production secrets or database credentials to the repository.

---

## Getting Started

### Prerequisites

Install:

- Node.js 24
- npm
- PostgreSQL
- Git

The project currently specifies:

```text
Node.js >=24 <25
```

### Clone the Repository

```bash
git clone https://github.com/FAVOUR-EGBUNA/thread-api.git
cd thread-api
```

### Install Dependencies

```bash
npm install
```

### Configure Environment

Create a `.env` file and provide the required environment variables.

At minimum for development:

```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secure_secret_with_at_least_32_characters
```

### Start Development Server

```bash
npm run dev
```

By default, the API runs on port:

```text
5000
```

The local health endpoint is:

```text
http://localhost:5000/api/v1/health
```

---

## Available Scripts

### Development

```bash
npm run dev
```

Runs the API using `tsx` in watch mode.

### Build

```bash
npm run build
```

Compiles TypeScript into JavaScript.

### Production

```bash
npm start
```

Runs the compiled application from:

```text
dist/server.js
```

### Type Check

```bash
npm run typecheck
```

Runs TypeScript validation without generating build files.

### Prisma Contract

```bash
npm run contract:emit
```

Emits the Prisma contract used by the application.

---

## Error Handling

THREAD uses centralized error handling.

Requests that do not match an existing endpoint are passed to a not-found handler, while application errors are processed by the global error middleware.

This keeps error responses consistent across the API.

---

## Quality Assurance

The THREAD backend has been tested across its core workflows, including authentication, workspace operations, project management, decisions, relationships, permissions, search, and related application behaviour.

The verified backend test suite contains:

```text
119 tests passed
```

TypeScript type checking has also been verified successfully.

---

## Production

The backend is deployed on Render.

**Production API:**

https://thread-api-1kwd.onrender.com

**Health Check:**

https://thread-api-1kwd.onrender.com/api/v1/health

A successful health request returns a response indicating that the THREAD API is running.

---

## Project Purpose

THREAD was built as a portfolio-grade full-stack engineering project focused on a problem beyond basic CRUD functionality.

The backend demonstrates:

- REST API architecture
- Relational data modelling
- Authentication and authorization
- Role-based workspace permissions
- PostgreSQL persistence
- Prisma ORM integration
- Schema validation
- Decision lifecycle modelling
- Historical state tracking
- Graph-based decision relationships
- Impact analysis
- Activity logging
- Search
- API security
- Rate limiting
- Centralized error handling
- Automated API testing
- Production deployment

---

## Author

**Favour Egbuna**

Full-Stack Developer

GitHub: https://github.com/FAVOUR-EGBUNA
