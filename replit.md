# Replit.md

## Overview

This is a **Campus Canteen Ordering System** — a full-stack web application that allows students to browse food products, add them to a cart, place orders, and track order status. Think of it as a simplified Swiggy/Zomato-style app designed for a college canteen.

The app uses a monorepo structure with a React frontend, Express backend, PostgreSQL database, and shared schema/route definitions between client and server.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure
- **`client/`** — React SPA (Single Page Application)
- **`server/`** — Express API server
- **`shared/`** — Shared TypeScript types, Zod schemas, and route definitions used by both client and server
- **`migrations/`** — Drizzle ORM migration files

### Frontend (`client/src/`)
- **Framework**: React with TypeScript
- **Routing**: `wouter` (lightweight alternative to React Router)
- **State Management**: 
  - Server state via `@tanstack/react-query`
  - Cart state via a custom hook (`use-cart.ts`) backed by `localStorage`
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (vibrant orange/red primary, Swiggy/Zomato inspired)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Theme**: Light/dark mode via `next-themes`
- **Forms**: React Hook Form with Zod validation via `@hookform/resolvers`
- **Build Tool**: Vite

**Key pages**: Home (product listing with category filter and search), Login, Register, Cart, Orders, Profile

### Backend (`server/`)
- **Framework**: Express 5 (ESM modules)
- **Authentication**: Passport.js with Local Strategy, session-based auth using `express-session`
- **Password Hashing**: Node.js `crypto.scrypt` with random salt
- **Session Store**: PostgreSQL via `connect-pg-simple`
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **API Pattern**: RESTful JSON API under `/api/` prefix

**Key endpoints**:
- `POST /api/login`, `POST /api/register`, `POST /api/logout`, `GET /api/user` — Auth
- `GET /api/products`, `GET /api/products/:id` — Products
- `POST /api/orders`, `GET /api/orders` — Orders (authenticated)

### Shared Layer (`shared/`)
- **`schema.ts`** — Drizzle ORM table definitions and Zod insert schemas for: `users`, `products`, `orders`, `orderItems`
- **`routes.ts`** — API route contract definitions with Zod schemas for request/response validation, used by both frontend and backend for type safety

### Database Schema
- **PostgreSQL** is required (connection via `DATABASE_URL` environment variable)
- **Tables**:
  - `users` — id, username (unique), password (hashed), role (student/admin), name
  - `products` — id, name, description, price, category, imageUrl, available
  - `orders` — id, userId, status (pending/preparing/ready/completed/cancelled), total, createdAt
  - `order_items` — id, orderId, productId, quantity, price (snapshot at order time)
- **Relations**: orders → user, orders → many orderItems, orderItems → product, orderItems → order
- **Schema push**: `npm run db:push` (uses `drizzle-kit push`)
- The server auto-seeds products if the database is empty on startup

### Dev vs Production
- **Development**: `npm run dev` runs the Express server with Vite dev middleware for HMR
- **Production**: `npm run build` bundles the client with Vite and server with esbuild into `dist/`, then `npm start` serves static files and the API

### Build System
- Client builds to `dist/public/` via Vite
- Server bundles to `dist/index.cjs` via esbuild
- Server dependencies in an allowlist are bundled to reduce cold start syscalls; others are left external

## External Dependencies

### Database
- **PostgreSQL** — Required. Connected via `DATABASE_URL` environment variable. Used for all data storage and session management.

### Key npm packages
- **drizzle-orm** + **drizzle-kit** — ORM and migration tooling for PostgreSQL
- **express** v5 — HTTP server
- **passport** + **passport-local** — Authentication
- **connect-pg-simple** — PostgreSQL session store
- **@tanstack/react-query** — Server state management on the client
- **shadcn/ui** components (Radix UI primitives) — Comprehensive UI component library
- **framer-motion** — Page transitions and animations
- **next-themes** — Dark/light theme switching
- **zod** + **drizzle-zod** — Schema validation shared between client and server
- **wouter** — Client-side routing
- **react-hook-form** — Form handling

### Replit-specific
- `@replit/vite-plugin-runtime-error-modal` — Error overlay in development
- `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner` — Dev tooling (only in development on Replit)

### Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — Session encryption secret (has a hardcoded fallback, but should be set in production)