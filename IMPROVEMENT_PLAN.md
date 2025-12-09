# Homelab Dashboard Improvement Plan

## Executive Summary

### Vision
Transform the homelab dashboard from a functional Flask-based prototype into a modern, performant, production-ready application that combines the **ease-of-use of Homarr**, the **customization depth of Dashy**, and the **security-first architecture of Homepage**—while maintaining its unique **military/tactical aesthetic** and **terminal integration** that no competitor offers.

### Key Problems Being Solved

1. **Performance Bottlenecks**: Settings loaded from disk on every request; synchronous URL status checks block request threads for up to 40+ seconds with many apps; no in-memory caching layer
2. **Security Gaps**: SSL verification disabled, API keys stored in plaintext, no CSRF protection, no authentication
3. **Code Quality Debt**: Bare `except` clauses throughout, no logging, inconsistent error handling patterns, code duplication
4. **Limited Scalability**: JSON file persistence, no database, thread pool blocking patterns
5. **UX Friction**: YAML/manual configuration required for many features; no drag-and-drop; limited mobile optimization

### Major Architectural Shifts Proposed

| Current State | Proposed State |
|--------------|----------------|
| Flask + Jinja2 templates | Flask API backend + React/Svelte frontend |
| HTMX polling (10+ requests) | WebSocket event bus with batched updates |
| JSON file storage | SQLite + Redis cache layer |
| No authentication | JWT/OAuth2 with role-based access |
| Three.js loading screen | CSS-only animations (faster load) |
| Synchronous status checks | Background job queue (Celery/RQ) |

---

## Current State Analysis

### What Exists Today

**Architecture Overview**
- **Backend**: Python 3.13, Flask 3.0.3 with 4 Blueprints (main, api, settings, widgets)
- **Frontend**: Tailwind CSS (CDN), HTMX 1.9.12, Three.js (loading), xterm.js (terminal)
- **Data Storage**: JSON files (`settings.json`, `apps.json`)
- **Deployment**: Docker container with socket mount for Docker API access
- **Integrations**: Pi-hole, Speedtest Tracker, Uptime Kuma, Portainer, Proxmox, Audiobookshelf

**Codebase Metrics**
- ~6,700 lines of production code
- 30+ API endpoints
- 8 widget modules, 6 integration modules
- ~50 template partials

### Specific Issues Identified

#### Performance Issues

| Issue | Location | Impact |
|-------|----------|--------|
| Settings read from disk every request | `settings.py:load_settings()` | Hundreds of disk I/O ops/minute |
| Synchronous URL status checks | `app_store.py:67-80` | 2-5s timeout × 10 apps = 20-50s blocking |
| GitHub API rate limiting | `icon_service.py` | 60 requests/hour limit hit frequently |
| HTMX polling storm | `index.html` | 10+ parallel polls every 2-120 seconds |
| Three.js library for loading screen | `loading/*.js` | ~500KB for 5-second animation |

#### Code Quality Issues

| Issue | Files Affected | Example |
|-------|----------------|---------|
| Bare `except` clauses | `pihole.py`, `docker_utils.py`, `terminal.py` | `except: pass` hides all errors |
| No structured logging | All modules | Errors silently swallowed |
| Duplicate weather logic | `widgets.py:24-44, 52-74` | Location retrieval copied twice |
| Inconsistent error returns | Widget modules | Some return `None`, others `{'error': ...}` |
| Missing type hints | 80% of functions | Makes refactoring risky |

#### Security Issues

| Issue | Risk Level | Location |
|-------|------------|----------|
| SSL verification disabled | High | `verify=False` in integrations |
| API keys in plaintext JSON | High | `settings.json` |
| No CSRF protection | Medium | All form endpoints |
| No authentication | Critical | Dashboard publicly accessible |
| Error messages expose internals | Low | Full exceptions returned to client |

#### UX/UI Issues

| Issue | User Impact |
|-------|-------------|
| No drag-and-drop app ordering | Manual JSON editing required |
| Audiobook marquee flickers | Multiple initialization attempts visible |
| Theme count mismatch | Docs say 9 themes, code has 6 |
| No mobile optimization | Cramped on small screens |
| No keyboard shortcuts | Power users frustrated |

### What Should Be Preserved

1. **Military/Tactical Aesthetic**: Unique differentiator; no competitor has this
2. **Terminal Integration (xterm.js)**: Valuable feature competitors lack
3. **Widget System Architecture**: Modular design is sound
4. **Blueprint Organization**: Clean separation of concerns
5. **Docker Integration**: Auto-detection of containers is valuable
6. **Open-Meteo Weather API**: Free, no API key required
7. **Integration Support**: Pi-hole, Proxmox, etc. integrations are useful

---

## Competitive Landscape

### Dashboard Comparison Matrix

| Feature | Current Dashboard | Homarr | Dashy | Homepage | Homer |
|---------|------------------|--------|-------|----------|-------|
| **Setup Method** | GUI + JSON | GUI Drag-Drop | YAML/UI | YAML | YAML |
| **Authentication** | None | OIDC/LDAP | None | None | None |
| **Built-in Widgets** | 8 | ~10 | 50+ | 25+ | 0 |
| **Real-time Status** | HTMX polling | Basic | Real-time | YAML-based | Ping only |
| **Docker Auto-Discovery** | Basic | Basic | None | Labels | None |
| **Terminal Access** | Full (xterm.js) | None | None | None | None |
| **Themes** | 6 (docs say 9) | 9+ | 10+ | Custom | 5+ |
| **Resource Usage** | Medium | Medium | Medium-High | Low | Very Low |
| **Unique Aesthetic** | Military/Tactical | Modern | Customizable | Clean | Minimal |

### Inspirations to Adopt

#### From Homarr
- **Drag-and-drop configuration**: Eliminate need for manual JSON editing
- **Deep *arr integration**: Sonarr, Radarr, Lidarr status widgets
- **Built-in authentication**: OIDC/LDAP support out-of-box
- **Icon library**: 10,000+ built-in icons

#### From Dashy
- **50+ widget library**: Comprehensive pre-built widgets
- **Status indicators with response time**: Hover to see latency
- **Theme editor**: Color palette customization UI
- **Custom widget support**: Vue.js components

#### From Homepage
- **Docker label auto-discovery**: `homepage.name`, `homepage.description` labels
- **API key proxy pattern**: Backend proxies requests, keys never exposed to frontend
- **YAML configuration**: Version-control friendly
- **Static frontend**: Instant page loads

#### From Homer
- **PWA/Offline support**: Works without network
- **Keyboard shortcuts**: Power-user efficiency
- **Single config file**: Simplicity

#### From Flame
- **GUI editors for everything**: No file editing required
- **15 themes with weather widget**: Popular combination
- **Lightweight**: Runs on Raspberry Pi

---

## Proposed Technical Stack

### Recommended Stack

| Layer | Current | Proposed | Justification |
|-------|---------|----------|---------------|
| **Backend Framework** | Flask 3.0 | Flask 3.0 + Flask-SocketIO | Keep Flask, add proper WebSocket |
| **Task Queue** | None | Celery + Redis | Async background jobs |
| **Database** | JSON files | SQLite + Redis cache | Proper persistence + caching |
| **Frontend Framework** | HTMX + vanilla JS | Svelte or React | Component-based, reactive UI |
| **Build Tool** | None (CDN) | Vite | Fast builds, tree-shaking |
| **CSS** | Tailwind CDN | Tailwind (compiled) | Smaller bundle, no runtime |
| **State Management** | None | Svelte stores / Zustand | Predictable state |
| **Real-time** | HTMX polling | WebSocket + SSE | Efficient updates |
| **Auth** | None | JWT + OAuth2 (optional) | Secure access |
| **Testing** | None | Pytest + Playwright | Quality assurance |
| **Type Safety** | None | TypeScript + Python type hints | Catch bugs early |

### Technology Justification

#### Keep Flask (Backend)
- Already working well
- Excellent ecosystem (Flask-SocketIO, Flask-Login)
- Team familiarity
- Blueprint architecture is clean
- Migration cost not worth switching to FastAPI

#### Add Svelte (Frontend)
**Why Svelte over React/Vue:**
- **Smaller bundles**: No virtual DOM runtime (~5KB vs ~40KB)
- **Simpler syntax**: Less boilerplate than React
- **Built-in reactivity**: No useState/useEffect ceremony
- **Faster initial load**: Compiles to vanilla JS
- **Perfect for dashboards**: Reactive stores ideal for real-time data

**Alternative: React**
- Larger ecosystem
- More developers available
- Better for complex UIs
- Choose if team prefers React experience

#### Add SQLite + Redis
**SQLite for persistence:**
- File-based (no server needed)
- ACID compliant
- Handles 100,000+ apps easily
- Built into Python

**Redis for caching:**
- Sub-millisecond reads
- TTL-based expiration
- Pub/sub for real-time events
- Session storage

#### Add Celery for Background Jobs
- URL status checks run async
- Integration API calls don't block requests
- Scheduled tasks (icon refresh, cache warming)
- Proper error handling and retries

### Migration Path

**Phase 1**: Keep current stack, fix critical issues
**Phase 2**: Add SQLite + Redis caching layer
**Phase 3**: Introduce Svelte frontend incrementally
**Phase 4**: Add Celery for background jobs
**Phase 5**: Full authentication implementation

---

## Architecture & Code Organization

### Proposed Project Structure

```
homelab-dashboard/
├── backend/
│   ├── app.py                    # Flask app factory
│   ├── config.py                 # Configuration management
│   ├── models/                   # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── app.py                # App/service model
│   │   ├── user.py               # User model (auth)
│   │   ├── settings.py           # Settings model
│   │   └── widget.py             # Widget configuration
│   ├── api/                      # API routes (Blueprints)
│   │   ├── __init__.py
│   │   ├── apps.py               # /api/apps endpoints
│   │   ├── stats.py              # /api/stats endpoints
│   │   ├── widgets.py            # /api/widgets endpoints
│   │   ├── settings.py           # /api/settings endpoints
│   │   ├── auth.py               # /api/auth endpoints
│   │   └── docker.py             # /api/docker endpoints
│   ├── services/                 # Business logic
│   │   ├── __init__.py
│   │   ├── docker_service.py     # Docker API interactions
│   │   ├── status_checker.py     # URL health checks
│   │   ├── icon_service.py       # Icon fetching
│   │   ├── cache_service.py      # Redis caching
│   │   └── auth_service.py       # Authentication logic
│   ├── integrations/             # External service integrations
│   │   ├── __init__.py
│   │   ├── base.py               # Base integration class
│   │   ├── pihole.py
│   │   ├── proxmox.py
│   │   ├── portainer.py
│   │   ├── speedtest.py
│   │   ├── uptime_kuma.py
│   │   └── audiobookshelf.py
│   ├── widgets/                  # Widget data fetchers
│   │   ├── __init__.py
│   │   ├── base.py               # Base widget class
│   │   ├── weather.py
│   │   ├── crypto.py
│   │   ├── news.py
│   │   ├── security.py
│   │   └── social.py
│   ├── tasks/                    # Celery background tasks
│   │   ├── __init__.py
│   │   ├── status_tasks.py       # URL health check tasks
│   │   ├── icon_tasks.py         # Icon refresh tasks
│   │   └── integration_tasks.py  # Integration polling tasks
│   ├── websocket/                # WebSocket handlers
│   │   ├── __init__.py
│   │   ├── events.py             # Event definitions
│   │   ├── terminal.py           # Terminal WebSocket
│   │   └── stats.py              # Stats broadcast
│   └── utils/                    # Utilities
│       ├── __init__.py
│       ├── logging.py            # Structured logging
│       ├── validators.py         # Input validation
│       └── errors.py             # Custom exceptions
├── frontend/
│   ├── src/
│   │   ├── App.svelte            # Root component
│   │   ├── main.ts               # Entry point
│   │   ├── lib/
│   │   │   ├── components/       # Reusable components
│   │   │   │   ├── ui/           # Base UI components
│   │   │   │   │   ├── Button.svelte
│   │   │   │   │   ├── Card.svelte
│   │   │   │   │   ├── Modal.svelte
│   │   │   │   │   └── Toast.svelte
│   │   │   │   ├── apps/         # App-related components
│   │   │   │   │   ├── AppCard.svelte
│   │   │   │   │   ├── AppGrid.svelte
│   │   │   │   │   ├── AppEditor.svelte
│   │   │   │   │   └── StatusIndicator.svelte
│   │   │   │   ├── widgets/      # Widget components
│   │   │   │   │   ├── WeatherWidget.svelte
│   │   │   │   │   ├── CryptoWidget.svelte
│   │   │   │   │   ├── StatsWidget.svelte
│   │   │   │   │   └── WidgetContainer.svelte
│   │   │   │   ├── terminal/     # Terminal components
│   │   │   │   │   ├── Terminal.svelte
│   │   │   │   │   └── TerminalTabs.svelte
│   │   │   │   └── layout/       # Layout components
│   │   │   │       ├── Header.svelte
│   │   │   │       ├── Sidebar.svelte
│   │   │   │       └── Footer.svelte
│   │   │   ├── stores/           # Svelte stores
│   │   │   │   ├── apps.ts       # App state
│   │   │   │   ├── settings.ts   # Settings state
│   │   │   │   ├── stats.ts      # System stats
│   │   │   │   ├── theme.ts      # Theme state
│   │   │   │   └── websocket.ts  # WebSocket connection
│   │   │   ├── services/         # API services
│   │   │   │   ├── api.ts        # Base API client
│   │   │   │   ├── apps.ts       # Apps API
│   │   │   │   ├── widgets.ts    # Widgets API
│   │   │   │   └── auth.ts       # Auth API
│   │   │   └── utils/            # Frontend utilities
│   │   │       ├── constants.ts
│   │   │       ├── helpers.ts
│   │   │       └── animations.ts
│   │   ├── routes/               # SvelteKit routes (if using SvelteKit)
│   │   │   ├── +page.svelte      # Dashboard
│   │   │   ├── settings/
│   │   │   └── login/
│   │   └── styles/
│   │       ├── global.css        # Global styles
│   │       ├── themes/           # Theme definitions
│   │       │   ├── military.css
│   │       │   ├── cyberpunk.css
│   │       │   └── ...
│   │       └── animations.css    # Animation keyframes
│   ├── public/
│   │   └── icons/                # Static icons
│   ├── package.json
│   ├── svelte.config.js
│   ├── vite.config.ts
│   └── tailwind.config.js
├── migrations/                   # Database migrations
│   └── versions/
├── tests/
│   ├── backend/
│   │   ├── test_api/
│   │   ├── test_services/
│   │   └── test_integrations/
│   └── frontend/
│       └── e2e/                  # Playwright tests
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── docker-compose.yml
├── docs/
│   ├── api.md                    # API documentation
│   ├── widgets.md                # Widget development guide
│   └── deployment.md             # Deployment guide
├── .env.example
├── pyproject.toml                # Python dependencies
└── README.md
```

### Module Breakdown Strategy

#### Small, Focused Modules

**Rule**: No file should exceed 200 lines. If it does, split it.

**Current Violations:**
- `security.py` (196 lines) → Split into `earthquakes.py`, `threats.py`, `reliefweb.py`
- `terminal.js` (230 lines) → Split into `terminal-core.ts`, `terminal-tabs.ts`, `terminal-websocket.ts`
- `apps.js` (206 lines) → Split into `app-crud.ts`, `app-detection.ts`, `app-modal.ts`

### Component Hierarchy

```
App
├── Layout
│   ├── Header
│   │   ├── Logo
│   │   ├── SearchBar
│   │   ├── NotificationBell
│   │   └── UserMenu
│   ├── Sidebar (collapsible)
│   │   ├── Navigation
│   │   └── QuickActions
│   └── Footer
│       └── StatusBar
├── Dashboard
│   ├── WidgetGrid (drag-and-drop)
│   │   ├── WeatherWidget
│   │   ├── StatsWidget
│   │   ├── CryptoWidget
│   │   └── CustomWidget[]
│   ├── AppGrid (drag-and-drop)
│   │   └── AppCard[]
│   └── TickerBar
│       ├── NewsTicker
│       └── CryptoTicker
├── Settings
│   ├── AppearanceTab
│   ├── WidgetsTab
│   ├── IntegrationsTab
│   └── SystemTab
└── Terminal
    ├── TerminalTabs
    └── TerminalPane
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Svelte)                     │
├─────────────────────────────────────────────────────────────┤
│  Stores                   │  Components                      │
│  ┌─────────────────────┐  │  ┌─────────────────────┐        │
│  │ apps: App[]         │──┼──│ AppGrid             │        │
│  │ stats: SystemStats  │  │  │ StatsWidget         │        │
│  │ settings: Settings  │  │  │ SettingsPage        │        │
│  │ theme: Theme        │  │  │ All components      │        │
│  └─────────────────────┘  │  └─────────────────────┘        │
│            ▲              │                                  │
│            │ WebSocket    │                                  │
└────────────┼──────────────┴──────────────────────────────────┘
             │
┌────────────┼──────────────────────────────────────────────────┐
│            │           Backend (Flask)                        │
├────────────┼──────────────────────────────────────────────────┤
│            ▼                                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐          │
│  │ WebSocket Handler   │    │ REST API            │          │
│  │ - stats broadcast   │    │ - /api/apps         │          │
│  │ - terminal I/O      │    │ - /api/settings     │          │
│  │ - status updates    │    │ - /api/widgets/*    │          │
│  └─────────────────────┘    └─────────────────────┘          │
│            │                          │                       │
│            ▼                          ▼                       │
│  ┌─────────────────────────────────────────────────┐         │
│  │              Service Layer                       │         │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │         │
│  │  │ Docker   │ │ Status   │ │ Integration      │ │         │
│  │  │ Service  │ │ Checker  │ │ Services         │ │         │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │         │
│  └─────────────────────────────────────────────────┘         │
│            │                          │                       │
│            ▼                          ▼                       │
│  ┌─────────────────────┐    ┌─────────────────────┐          │
│  │ Redis Cache         │    │ SQLite Database     │          │
│  │ - API responses     │    │ - Apps              │          │
│  │ - Session data      │    │ - Settings          │          │
│  │ - Rate limiting     │    │ - Users             │          │
│  └─────────────────────┘    └─────────────────────┘          │
└───────────────────────────────────────────────────────────────┘
             │
             ▼
┌───────────────────────────────────────────────────────────────┐
│                    Celery Workers                             │
├───────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │ Status Checker  │ │ Icon Fetcher    │ │ Integration     │ │
│  │ Task            │ │ Task            │ │ Poller Tasks    │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### State Management (Svelte Stores)

```typescript
// stores/apps.ts
import { writable, derived } from 'svelte/store';

interface App {
  id: string;
  name: string;
  url: string;
  icon: string;
  status: 'online' | 'offline' | 'checking';
  responseTime?: number;
  category?: string;
  position: number;
}

function createAppsStore() {
  const { subscribe, set, update } = writable<App[]>([]);

  return {
    subscribe,
    set,
    add: (app: App) => update(apps => [...apps, app]),
    remove: (id: string) => update(apps => apps.filter(a => a.id !== id)),
    updateStatus: (id: string, status: App['status'], responseTime?: number) =>
      update(apps => apps.map(a =>
        a.id === id ? { ...a, status, responseTime } : a
      )),
    reorder: (fromIndex: number, toIndex: number) =>
      update(apps => {
        const result = [...apps];
        const [removed] = result.splice(fromIndex, 1);
        result.splice(toIndex, 0, removed);
        return result.map((app, i) => ({ ...app, position: i }));
      }),
  };
}

export const apps = createAppsStore();

// Derived store for online count
export const onlineCount = derived(apps, $apps =>
  $apps.filter(a => a.status === 'online').length
);
```

---

## UI/UX Improvements

### Visual Design Direction

#### Design Principles
1. **Military Precision**: Clean lines, structured layouts, purposeful use of space
2. **Functional Aesthetics**: Every visual element serves a purpose
3. **Information Hierarchy**: Critical data immediately visible, details on demand
4. **Consistent Theming**: CSS variables for all colors, easy theme switching

#### Color System Enhancement

```css
/* Enhanced Military Theme */
:root {
  /* Base colors */
  --mil-black: #0a0a0a;
  --mil-dark: #121212;
  --mil-card: #1a1a1a;
  --mil-border: #2a2a2a;

  /* Text hierarchy */
  --mil-text-primary: #e5e5e5;
  --mil-text-secondary: #a3a3a3;
  --mil-text-muted: #737373;

  /* Accent colors */
  --mil-accent: #22c55e;           /* Primary action */
  --mil-accent-hover: #16a34a;
  --mil-accent-muted: rgba(34, 197, 94, 0.1);

  /* Status colors */
  --mil-success: #22c55e;
  --mil-warning: #f59e0b;
  --mil-error: #ef4444;
  --mil-info: #3b82f6;

  /* Semantic colors */
  --mil-online: var(--mil-success);
  --mil-offline: var(--mil-error);
  --mil-pending: var(--mil-warning);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
}
```

### Animation & Interaction Patterns

#### Micro-interactions
```css
/* Status indicator pulse */
.status-online {
  animation: pulse-green 2s ease-in-out infinite;
}

@keyframes pulse-green {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
}

/* Card hover effect */
.app-card {
  transition: transform var(--transition-fast),
              box-shadow var(--transition-fast);
}

.app-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* Loading skeleton */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--mil-card) 25%,
    var(--mil-border) 50%,
    var(--mil-card) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

#### Remove Three.js Loading Screen
Replace with pure CSS animation:

```css
/* Military-style CSS loading screen */
.loading-screen {
  display: grid;
  place-items: center;
  min-height: 100vh;
  background: var(--mil-black);
}

.loading-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.loading-cell {
  width: 16px;
  height: 16px;
  background: var(--mil-accent);
  animation: cell-pulse 1.5s ease-in-out infinite;
}

.loading-cell:nth-child(1) { animation-delay: 0ms; }
.loading-cell:nth-child(2) { animation-delay: 100ms; }
.loading-cell:nth-child(3) { animation-delay: 200ms; }
/* ... staggered delays */

@keyframes cell-pulse {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}
```

### Responsive Design Strategy

#### Breakpoints
```css
/* Mobile-first breakpoints */
--breakpoint-sm: 640px;   /* Mobile landscape */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Laptop */
--breakpoint-xl: 1280px;  /* Desktop */
--breakpoint-2xl: 1536px; /* Large screens */
```

#### Layout Adaptations

| Viewport | App Grid | Widgets | Sidebar | Terminal |
|----------|----------|---------|---------|----------|
| Mobile (<640px) | 2 columns | Stacked | Hidden (hamburger) | Full-screen modal |
| Tablet (640-1024px) | 3-4 columns | 2-column grid | Collapsible | Bottom sheet |
| Desktop (>1024px) | 5-6 columns | Side panel | Always visible | Side panel |

### Accessibility Considerations

1. **Keyboard Navigation**
   - Tab order follows visual layout
   - Focus indicators visible on all interactive elements
   - Escape closes modals/panels
   - Arrow keys navigate grid items

2. **Screen Reader Support**
   - Semantic HTML (`<nav>`, `<main>`, `<article>`)
   - ARIA labels for icon-only buttons
   - Live regions for status updates
   - Skip-to-content link

3. **Color Contrast**
   - All text meets WCAG AA (4.5:1 ratio)
   - Status indicators have text labels, not just color
   - Focus indicators high contrast

4. **Motion Preferences**
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

---

## Performance Optimization

### Backend Optimizations

#### 1. In-Memory Settings Cache

```python
# services/settings_service.py
from functools import lru_cache
from threading import Lock
import time

class SettingsService:
    _instance = None
    _lock = Lock()
    _cache: dict = {}
    _cache_ttl = 60  # seconds
    _last_load = 0

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def get(self, path: str = None, default=None):
        if time.time() - self._last_load > self._cache_ttl:
            self._reload()

        if path is None:
            return self._cache

        keys = path.split('.')
        value = self._cache
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key, default)
            else:
                return default
        return value

    def _reload(self):
        with self._lock:
            # Load from SQLite instead of JSON
            self._cache = self._load_from_db()
            self._last_load = time.time()
```

#### 2. Background Status Checks with Celery

```python
# tasks/status_tasks.py
from celery import Celery
from celery.schedules import crontab

celery = Celery('dashboard')

@celery.task(bind=True, max_retries=3)
def check_app_status(self, app_id: str, url: str):
    """Check single app status asynchronously."""
    try:
        response = requests.head(url, timeout=2, allow_redirects=True)
        status = 'online' if response.ok else 'offline'
        response_time = int(response.elapsed.total_seconds() * 1000)
    except requests.RequestException:
        status = 'offline'
        response_time = None

    # Update Redis cache
    redis.hset(f'app:{app_id}', mapping={
        'status': status,
        'response_time': response_time or '',
        'checked_at': time.time()
    })

    # Broadcast via WebSocket
    socketio.emit('app_status', {
        'id': app_id,
        'status': status,
        'responseTime': response_time
    })

@celery.task
def check_all_apps_status():
    """Scheduled task to check all apps."""
    apps = App.query.all()
    for app in apps:
        check_app_status.delay(app.id, app.url)

# Celery beat schedule
celery.conf.beat_schedule = {
    'check-apps-every-30s': {
        'task': 'tasks.status_tasks.check_all_apps_status',
        'schedule': 30.0,
    },
}
```

#### 3. Redis Caching Layer

```python
# services/cache_service.py
import redis
import json
from functools import wraps

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def cached(prefix: str, ttl: int = 300):
    """Decorator for caching function results."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = f"{prefix}:{hash(str(args) + str(kwargs))}"

            # Try cache first
            cached_value = redis_client.get(cache_key)
            if cached_value:
                return json.loads(cached_value)

            # Call function and cache result
            result = func(*args, **kwargs)
            redis_client.setex(cache_key, ttl, json.dumps(result))
            return result
        return wrapper
    return decorator

# Usage
@cached(prefix='weather', ttl=600)
def get_weather(lat: float, lon: float) -> dict:
    """Fetch weather data with 10-minute cache."""
    return fetch_from_open_meteo(lat, lon)
```

### Frontend Optimizations

#### 1. Code Splitting

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['svelte'],
          'terminal': ['xterm', 'xterm-addon-fit', 'xterm-addon-web-links'],
          'charts': ['chart.js'],  // If using charts
        }
      }
    }
  }
});
```

#### 2. Lazy Loading Widgets

```svelte
<!-- Dashboard.svelte -->
<script>
  import { onMount } from 'svelte';

  let WeatherWidget;
  let TerminalPane;

  onMount(async () => {
    // Lazy load heavy components
    WeatherWidget = (await import('./widgets/WeatherWidget.svelte')).default;

    // Only load terminal when tab is activated
    if (showTerminal) {
      TerminalPane = (await import('./terminal/TerminalPane.svelte')).default;
    }
  });
</script>

{#if WeatherWidget}
  <svelte:component this={WeatherWidget} />
{:else}
  <WidgetSkeleton />
{/if}
```

#### 3. Virtual Scrolling for Large Lists

```svelte
<!-- AppGrid.svelte with virtual scrolling -->
<script>
  import VirtualList from '@sveltejs/svelte-virtual-list';
  import { apps } from '$lib/stores/apps';
</script>

{#if $apps.length > 50}
  <VirtualList items={$apps} let:item>
    <AppCard app={item} />
  </VirtualList>
{:else}
  <div class="grid grid-cols-4 gap-4">
    {#each $apps as app}
      <AppCard {app} />
    {/each}
  </div>
{/if}
```

#### 4. WebSocket Batching

```typescript
// stores/websocket.ts
import { writable } from 'svelte/store';

class WebSocketManager {
  private ws: WebSocket;
  private messageBuffer: any[] = [];
  private flushInterval: number;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (event) => {
      this.messageBuffer.push(JSON.parse(event.data));
    };

    // Flush buffer every 100ms instead of processing each message
    this.flushInterval = setInterval(() => this.flush(), 100);
  }

  private flush() {
    if (this.messageBuffer.length === 0) return;

    const messages = this.messageBuffer;
    this.messageBuffer = [];

    // Batch update stores
    const statusUpdates = messages.filter(m => m.type === 'app_status');
    if (statusUpdates.length > 0) {
      apps.batchUpdateStatus(statusUpdates);
    }

    const statsUpdates = messages.filter(m => m.type === 'stats');
    if (statsUpdates.length > 0) {
      stats.set(statsUpdates[statsUpdates.length - 1].data);
    }
  }
}
```

### Performance Budget

| Metric | Current | Target | Strategy |
|--------|---------|--------|----------|
| First Contentful Paint | ~2.5s | <1s | Remove Three.js, lazy load |
| Time to Interactive | ~4s | <2s | Code splitting, async load |
| Bundle Size (JS) | ~800KB | <200KB | Tree shaking, Svelte |
| Bundle Size (CSS) | ~100KB | <30KB | Tailwind purge, no CDN |
| API Response (stats) | ~200ms | <50ms | Redis cache |
| App Status Check | 20-50s (blocking) | 0ms (async) | Celery background |

---

## Integration Strategy

### Docker Auto-Discovery Pattern

```python
# services/docker_service.py
DASHBOARD_LABEL_PREFIX = 'dashboard.'

def discover_apps_from_docker():
    """Auto-discover apps from Docker container labels."""
    client = docker.from_env()
    apps = []

    for container in client.containers.list():
        labels = container.labels

        # Check for dashboard labels
        if f'{DASHBOARD_LABEL_PREFIX}enable' in labels:
            if labels.get(f'{DASHBOARD_LABEL_PREFIX}enable', '').lower() != 'true':
                continue

            app = {
                'id': f'docker-{container.short_id}',
                'name': labels.get(f'{DASHBOARD_LABEL_PREFIX}name', container.name),
                'description': labels.get(f'{DASHBOARD_LABEL_PREFIX}description', ''),
                'url': labels.get(f'{DASHBOARD_LABEL_PREFIX}url', ''),
                'icon': labels.get(f'{DASHBOARD_LABEL_PREFIX}icon', ''),
                'category': labels.get(f'{DASHBOARD_LABEL_PREFIX}category', 'Docker'),
                'source': 'docker',
                'container_id': container.id,
            }

            # Auto-detect URL from port bindings if not specified
            if not app['url']:
                app['url'] = detect_container_url(container)

            apps.append(app)

    return apps

def detect_container_url(container) -> str:
    """Intelligently detect service URL from container config."""
    ports = container.ports

    # Check Traefik labels first
    traefik_host = container.labels.get('traefik.http.routers.*.rule', '')
    if 'Host(' in traefik_host:
        # Parse Traefik rule
        match = re.search(r'Host\(`([^`]+)`\)', traefik_host)
        if match:
            return f'https://{match.group(1)}'

    # Check exposed ports
    for container_port, host_bindings in ports.items():
        if host_bindings:
            host_port = host_bindings[0]['HostPort']
            return f'http://localhost:{host_port}'

    return ''
```

**Docker Compose Label Example:**
```yaml
services:
  my-app:
    image: my-app:latest
    labels:
      - "dashboard.enable=true"
      - "dashboard.name=My Application"
      - "dashboard.description=My awesome app"
      - "dashboard.url=http://localhost:8080"
      - "dashboard.icon=mdi-application"
      - "dashboard.category=Services"
```

### Integration Base Class

```python
# integrations/base.py
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class IntegrationError(Exception):
    """Custom exception for integration errors."""
    pass

class BaseIntegration(ABC):
    """Base class for all integrations."""

    name: str = "base"
    version: str = "1.0"

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.url = config.get('url', '').rstrip('/')
        self.api_key = config.get('api_key', '')
        self._session = None

    @property
    def session(self):
        if self._session is None:
            self._session = requests.Session()
            self._session.headers.update(self._get_headers())
            # Enable SSL verification in production
            self._session.verify = os.getenv('VERIFY_SSL', 'true').lower() == 'true'
        return self._session

    @abstractmethod
    def _get_headers(self) -> Dict[str, str]:
        """Return authentication headers."""
        pass

    @abstractmethod
    def test_connection(self) -> bool:
        """Test if integration is reachable and authenticated."""
        pass

    @abstractmethod
    def get_stats(self) -> Dict[str, Any]:
        """Get integration statistics."""
        pass

    def _request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make authenticated request with error handling."""
        url = f"{self.url}{endpoint}"
        try:
            response = self.session.request(method, url, timeout=10, **kwargs)
            response.raise_for_status()
            return response
        except requests.Timeout:
            logger.error(f"{self.name}: Request timeout for {endpoint}")
            raise IntegrationError(f"Timeout connecting to {self.name}")
        except requests.HTTPError as e:
            logger.error(f"{self.name}: HTTP error {e.response.status_code} for {endpoint}")
            raise IntegrationError(f"{self.name} returned {e.response.status_code}")
        except requests.RequestException as e:
            logger.error(f"{self.name}: Request failed - {str(e)}")
            raise IntegrationError(f"Failed to connect to {self.name}")

# Example implementation
class PiholeIntegration(BaseIntegration):
    name = "pihole"
    version = "6.0"

    def _get_headers(self) -> Dict[str, str]:
        return {'X-FTL-SID': self._get_session_id()}

    def _get_session_id(self) -> str:
        """Authenticate and get session ID for Pi-hole v6."""
        # Implementation...
        pass

    def test_connection(self) -> bool:
        try:
            response = self._request('GET', '/api/info/version')
            return response.ok
        except IntegrationError:
            return False

    def get_stats(self) -> Dict[str, Any]:
        response = self._request('GET', '/api/stats/summary')
        data = response.json()
        return {
            'blocked_today': data.get('ads_blocked_today', 0),
            'block_percentage': data.get('ads_percentage_today', 0),
            'total_queries': data.get('dns_queries_today', 0),
            'clients': data.get('unique_clients', 0),
        }
```

### WebSocket Event System

```python
# websocket/events.py
from flask_socketio import SocketIO, emit, join_room, leave_room
from functools import wraps
import logging

socketio = SocketIO()
logger = logging.getLogger(__name__)

# Event types
class Events:
    STATS_UPDATE = 'stats:update'
    APP_STATUS = 'app:status'
    APP_CREATED = 'app:created'
    APP_UPDATED = 'app:updated'
    APP_DELETED = 'app:deleted'
    INTEGRATION_UPDATE = 'integration:update'
    NOTIFICATION = 'notification'

def broadcast(event: str, data: dict, room: str = None):
    """Broadcast event to all connected clients or specific room."""
    if room:
        socketio.emit(event, data, room=room)
    else:
        socketio.emit(event, data)
    logger.debug(f"Broadcast {event} to {room or 'all'}")

@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    # Join default room for broadcasts
    join_room('dashboard')

@socketio.on('subscribe')
def handle_subscribe(data):
    """Subscribe to specific update channels."""
    channels = data.get('channels', [])
    for channel in channels:
        join_room(channel)
        logger.debug(f"Client {request.sid} subscribed to {channel}")

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")
```

### Authentication Implementation

```python
# api/auth.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity
)
from werkzeug.security import check_password_hash
from datetime import timedelta

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401

    access_token = create_access_token(
        identity=user.id,
        expires_delta=timedelta(hours=1)
    )
    refresh_token = create_refresh_token(
        identity=user.id,
        expires_delta=timedelta(days=30)
    )

    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'role': user.role
        }
    })

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)
    return jsonify({'access_token': access_token})

# Protected route example
@api_bp.route('/settings', methods=['PUT'])
@jwt_required()
def update_settings():
    user_id = get_jwt_identity()
    # Only admins can update settings
    user = User.query.get(user_id)
    if user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    # Update settings...
```

---

## Implementation Roadmap

### Phase 1: Foundation (2-3 weeks effort)

**Goal**: Fix critical issues without changing stack

#### Week 1-2: Backend Fixes
- [ ] Add in-memory settings cache with TTL
- [ ] Implement structured logging (replace bare `except`)
- [ ] Add consistent error response format
- [ ] Fix SSL verification (env-based toggle)
- [ ] Add type hints to core modules
- [ ] Add CSRF protection

#### Week 3: Database Migration
- [ ] Set up SQLite with SQLAlchemy
- [ ] Create migration scripts (JSON → SQLite)
- [ ] Implement App model
- [ ] Implement Settings model
- [ ] Add Redis for caching

**Deliverable**: Stable, performant current dashboard with proper data layer

### Phase 2: Background Processing (1-2 weeks effort)

**Goal**: Move blocking operations to background

- [ ] Set up Celery with Redis broker
- [ ] Implement status check background task
- [ ] Implement icon refresh background task
- [ ] Add Celery beat for scheduled tasks
- [ ] Update Docker Compose for Redis + Celery

**Deliverable**: Non-blocking dashboard with async status checks

### Phase 3: WebSocket Real-time (1-2 weeks effort)

**Goal**: Replace HTMX polling with WebSocket

- [ ] Set up Flask-SocketIO
- [ ] Implement stats broadcast (replace 2s polling)
- [ ] Implement app status broadcast
- [ ] Update terminal to use SocketIO
- [ ] Add reconnection logic on frontend

**Deliverable**: Real-time updates without polling overhead

### Phase 4: Frontend Modernization (3-4 weeks effort)

**Goal**: Svelte-based frontend

#### Week 1: Setup & Core
- [ ] Initialize Svelte project with Vite
- [ ] Set up Tailwind CSS (compiled)
- [ ] Create base UI components (Button, Card, Modal)
- [ ] Implement theme system with CSS variables
- [ ] Set up stores and API services

#### Week 2: Dashboard
- [ ] Implement AppGrid with drag-and-drop
- [ ] Implement AppCard with status indicator
- [ ] Implement StatsWidget
- [ ] Implement responsive layout

#### Week 3: Widgets & Terminal
- [ ] Port widgets to Svelte components
- [ ] Implement lazy loading
- [ ] Port terminal with xterm.js
- [ ] Implement terminal tabs

#### Week 4: Settings & Polish
- [ ] Implement Settings page
- [ ] Add loading states and skeletons
- [ ] Implement toast notifications
- [ ] Performance optimization
- [ ] CSS-only loading screen

**Deliverable**: Modern, fast Svelte frontend

### Phase 5: Authentication & Security (1-2 weeks effort)

**Goal**: Secure dashboard access

- [ ] Implement User model
- [ ] Add JWT authentication
- [ ] Create login page
- [ ] Add role-based access (admin/viewer)
- [ ] Implement API key proxy for integrations
- [ ] Security audit and penetration testing

**Deliverable**: Secure, multi-user dashboard

### Phase 6: Advanced Features (2-3 weeks effort)

**Goal**: Competitive feature parity

- [ ] Docker auto-discovery via labels
- [ ] Advanced widgets (GPU, temperatures)
- [ ] Keyboard shortcuts
- [ ] PWA support with offline mode
- [ ] Multi-language support
- [ ] Custom widget development guide

**Deliverable**: Feature-rich dashboard competitive with Homarr/Dashy

### Complexity Estimates

| Component | Complexity | Risk | Notes |
|-----------|------------|------|-------|
| Settings cache | Low | Low | Straightforward caching |
| SQLite migration | Medium | Medium | Data migration required |
| Celery setup | Medium | Low | Well-documented process |
| WebSocket migration | Medium | Medium | Testing real-time behavior |
| Svelte frontend | High | Medium | Largest change, but isolated |
| Authentication | Medium | High | Security-critical |
| Docker auto-discovery | Low | Low | Label parsing |

---

## Code Quality & Maintainability

### Linting & Formatting

**Python (Backend)**
```toml
# pyproject.toml
[tool.ruff]
line-length = 100
select = ["E", "F", "W", "I", "N", "UP", "B", "C4"]

[tool.ruff.isort]
known-first-party = ["homelab"]

[tool.mypy]
python_version = "3.11"
strict = true
ignore_missing_imports = true
```

**TypeScript (Frontend)**
```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:svelte/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "warn",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

**Pre-commit Hooks**
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.6
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.7.0
    hooks:
      - id: mypy
        additional_dependencies: [types-requests]

  - repo: local
    hooks:
      - id: eslint
        name: eslint
        entry: npm run lint
        language: system
        files: \.(ts|svelte)$
```

### Testing Strategy

**Backend Testing (Pytest)**
```python
# tests/conftest.py
import pytest
from app import create_app
from models import db

@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

# tests/test_api/test_apps.py
def test_get_apps(client):
    response = client.get('/api/apps')
    assert response.status_code == 200
    assert isinstance(response.json, list)

def test_create_app(client, auth_headers):
    response = client.post('/api/apps', json={
        'name': 'Test App',
        'url': 'http://localhost:8080'
    }, headers=auth_headers)
    assert response.status_code == 201
    assert response.json['name'] == 'Test App'
```

**Frontend Testing (Playwright)**
```typescript
// tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays app grid', async ({ page }) => {
    const grid = page.locator('[data-testid="app-grid"]');
    await expect(grid).toBeVisible();
  });

  test('can add new app', async ({ page }) => {
    await page.click('[data-testid="add-app-button"]');
    await page.fill('[name="name"]', 'New App');
    await page.fill('[name="url"]', 'http://localhost:3000');
    await page.click('[type="submit"]');

    await expect(page.locator('text=New App')).toBeVisible();
  });

  test('shows status indicators', async ({ page }) => {
    const indicator = page.locator('[data-testid="status-indicator"]').first();
    await expect(indicator).toHaveAttribute('data-status', /(online|offline)/);
  });
});
```

**Test Coverage Targets**
| Layer | Coverage Target |
|-------|-----------------|
| API endpoints | 90% |
| Services | 85% |
| Integrations | 80% |
| Frontend components | 70% |
| E2E critical paths | 100% |

### Documentation Standards

**Code Documentation**
```python
def check_app_status(app_id: str, url: str) -> StatusResult:
    """
    Check the health status of an application.

    Performs a HEAD request first (fast), falling back to GET if needed.
    Results are cached in Redis and broadcast via WebSocket.

    Args:
        app_id: Unique identifier for the app
        url: URL to check (will be normalized)

    Returns:
        StatusResult with online status and response time

    Raises:
        ValueError: If URL is invalid
        IntegrationError: If check fails after retries

    Example:
        >>> result = check_app_status('app-123', 'http://localhost:8080')
        >>> result.online
        True
        >>> result.response_time
        45
    """
```

**API Documentation (OpenAPI)**
```yaml
# docs/openapi.yaml
openapi: 3.0.3
info:
  title: Homelab Dashboard API
  version: 2.0.0

paths:
  /api/apps:
    get:
      summary: List all apps
      tags: [Apps]
      responses:
        200:
          description: List of apps
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/App'
    post:
      summary: Create new app
      tags: [Apps]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AppCreate'
      responses:
        201:
          description: App created
```

---

## Summary

This improvement plan transforms the homelab dashboard from a functional prototype into a production-ready application by:

1. **Fixing Critical Performance Issues**: In-memory caching, background job processing, WebSocket real-time updates
2. **Modernizing the Frontend**: Svelte-based SPA with reactive state management, code splitting, lazy loading
3. **Adding Security**: Authentication, CSRF protection, API key proxy pattern
4. **Improving Code Quality**: Structured logging, type hints, comprehensive testing
5. **Enhancing UX**: Drag-and-drop, keyboard shortcuts, responsive design, accessible UI

The phased approach allows incremental delivery while maintaining a working dashboard throughout the transformation. Each phase builds on the previous, minimizing risk while maximizing value delivery.

**Unique Differentiators to Maintain:**
- Military/tactical aesthetic (no competitor has this)
- Integrated terminal access (unique feature)
- Hybrid GUI + config approach
- Real-time system monitoring

**Competitive Positioning:**
Position as "Homarr's ease-of-use + Homepage's security + Dashy's customization" with a unique tactical aesthetic and terminal integration that no other dashboard offers.
