# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-02-14

### Added
- Auto-update mechanism via electron-updater
- Improved role-based access control with full permission matrix
- Dark/Light mode with persistent preference (localStorage)
- Language persistence (English/Czech) via localStorage
- Notification system with real-time updates (Supabase Realtime)
- Rich text editor with image upload, @mentions, and table of contents
- Comprehensive error boundary with i18n support
- Avatar upload with automatic resizing
- Unified design token system in Tailwind config (nokturo color palette)

### Fixed
- Auth loop on login (session not persisting after app restart)
- Create user changing current user's role (founder → client downgrade)
- Environment variables not loading correctly in production Electron build
- Dark mode resetting after app restart
- Profile fetch timeout causing auth state loss
- Session refresh preserving existing user role

### Changed
- Redesigned login screen with improved UX
- Unified input styling across all forms (INPUT_CLASS pattern)
- Consistent icon system using Lucide React throughout
- Improved error handling across all async operations
- Cleaned up debug console.log calls for production
- ErrorBoundary now supports i18n (was hardcoded Czech)
- Updated .env.example to remove exposed credentials

### Removed
- Debug ENV CHECK logging in production
- Redundant auth state change listeners
- Hardcoded color values replaced with Tailwind design tokens

### Security
- Removed hardcoded GitHub token from .env.example
- Improved Supabase RLS policies
- .env properly excluded from git via .gitignore
- Service role key kept out of client-side code

## [0.1.4] - 2025-xx-xx

### Added
- Initial application with basic authentication
- Project structure with Electron + React + Vite
- Supabase integration for auth and database
