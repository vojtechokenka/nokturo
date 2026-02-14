# Nokturo

Internal PLM/ERP application for high-end fashion product lifecycle management.

## Features

- **User authentication** with Supabase Auth (email/password, session persistence)
- **Role-based access control** (Founder, Engineer, Client, Viewer)
- **Brand management** – Strategy & Identity pages
- **Prototyping** – Moodboards & Ideas
- **Production** – Materials, Components, Labels, Products, Sampling
- **Business** – Costing, Suppliers, Accounting
- **Communication** – Chat & Comments with @mentions
- **Rich text editor** with image upload, table of contents, and commenting
- **Dark / Light mode** with persistence
- **Bilingual** – English & Czech with persistent language preference
- **Desktop app** – Electron with auto-update support
- **Notifications** – Real-time via Supabase Realtime

## Tech Stack

- **Electron** – Desktop shell with auto-updater
- **React 18** + **Vite** – Fast SPA bundling
- **Supabase** – Auth, PostgreSQL database, Edge Functions, Storage, Realtime
- **TypeScript** – Full type safety
- **Tailwind CSS** – Utility-first styling with custom design tokens
- **Zustand** – Lightweight state management
- **React Router** (HashRouter) – Client-side routing
- **react-i18next** – Internationalization (EN / CS)
- **Lucide React** – Consistent icon library

## Installation

### Prerequisites

- Node.js 18+
- npm

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/vojtechokenka/nokturo.git
   cd nokturo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase credentials and GitHub token.

4. Run in development:
   ```bash
   npm run dev              # Vite dev server only
   npm run electron:dev     # Full Electron + Vite
   ```

5. Build for production:
   ```bash
   npm run electron:build
   ```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `VITE_DEV_BYPASS_AUTH` | Skip login in development (true/false) |
| `VITE_REDIRECT_URL` | OAuth redirect URL |
| `GH_TOKEN` | GitHub token for auto-update publishing |

> **Security:** Never commit `.env` files. The `.gitignore` already excludes them.

## User Roles

| Role | Access |
|---|---|
| **Founder** | Full access, can create/manage users |
| **Engineer** | Project and task management, production |
| **Client** | View assigned projects and brand materials |
| **Viewer** | Read-only access |

## Build & Deploy

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run electron:dev` | Full Electron + Vite dev |
| `npm run electron:build` | Production build → `dist-electron/` |
| `npm run electron:build:publish` | Build + publish to GitHub Releases |

## Project Structure

```
src/
├── components/     # Reusable UI components
├── i18n/           # Translations (en.json, cs.json)
├── layouts/        # App layout with sidebar
├── lib/            # Utilities (supabase, rbac, storage, etc.)
├── pages/          # Route pages organized by feature
├── stores/         # Zustand stores (auth, theme)
├── App.tsx         # Root component with auth init
├── router.tsx      # Route definitions
└── main.tsx        # Entry point
electron/
├── main.js         # Electron main process
└── preload.js      # Preload script
```

## Version History

- **2.0.0** – Complete redesign, stability fixes, unified design system
- **0.1.4** – Early development release
