# 웹/Electron 공존 아키텍처 제안서

## 📋 목차
1. [현재 Electron 의존성 분석](#1-현재-electron-의존성-분석)
2. [웹 대체 방법](#2-웹-대체-방법)
3. [Platform Adapter 아키텍처](#3-platform-adapter-아키텍처)
4. [구현 계획](#4-구현-계획)
5. [마이그레이션 가이드](#5-마이그레이션-가이드)

---

## 1. 현재 Electron 의존성 분석

### 1.1 핵심 Electron 기능 사용 현황

| 기능 | 사용 위치 | 중요도 | 웹 대체 가능성 |
|------|----------|--------|---------------|
| **IPC 통신** | preload.ts, SetupScreen.tsx | 🔴 HIGH | ✅ 완전 대체 가능 |
| **SQLite 로컬 DB** | db.ts, 키워드/랭킹 관리 | 🔴 HIGH | ✅ IndexedDB/Backend API |
| **Settings 저장** | electron-store, useSettingsStore | 🟡 MEDIUM | ✅ localStorage/Backend |
| **시스템 트레이** | index.ts | 🟢 LOW | ❌ 웹에서 불가능 |
| **네이티브 알림** | SocketListener.tsx | 🟡 MEDIUM | ✅ Web Notification API |
| **윈도우 관리** | BrowserWindow | 🟢 LOW | ⚠️ 제한적 대체 |
| **자동 업데이트** | electron-updater | 🟢 LOW | ✅ Service Worker |
| **파일 시스템 접근** | Excel import/export | 🟡 MEDIUM | ✅ File API |

### 1.2 주요 IPC 채널

```typescript
// 현재 Electron IPC API
window.electronAPI = {
  setBackendUrl: (url: string) => Promise<boolean>
  getBackendUrl: () => Promise<string>
  disconnect: () => Promise<boolean>
  showNotification: (notification) => Promise<boolean>
}
```

---

## 2. 웹 대체 방법

### 2.1 IPC 통신 → Platform Service

**Electron:**
```typescript
// Main Process
ipcMain.handle('backend:set_url', (_event, url) => {
  setBackendUrl(url);
  return true;
});

// Renderer
await window.electronAPI.setBackendUrl('http://localhost:3000');
```

**Web:**
```typescript
// Direct localStorage 사용
localStorage.setItem('backend_url', 'http://localhost:3000');
```

**✅ 통합 방법:** Platform Adapter가 런타임 환경 감지 후 적절한 구현 선택

---

### 2.2 SQLite → IndexedDB + Backend Sync

**현재 (Electron Only):**
```typescript
// client/src/main/db.ts
const db = new Database(path.join(app.getPath('userData'), 'database.sqlite'));
```

**제안 (Hybrid):**

#### Option A: IndexedDB (완전 로컬)
```typescript
// 웹 브라우저의 IndexedDB 사용
import Dexie from 'dexie';

const db = new Dexie('CharlesMVP');
db.version(1).stores({
  keywords: '++id, keyword, url, &naverPlaceId',
  rankings: '++id, keywordId, rank, date'
});
```

**장점:**
- 오프라인 동작 가능
- 빠른 로컬 쿼리
- 브라우저 간 데이터 격리

**단점:**
- 브라우저 간 데이터 공유 불가
- 쿼터 제한 (보통 50MB~500MB)
- 복잡한 쿼리 제한적

#### Option B: Backend API (서버 중심)
```typescript
// 모든 데이터를 Backend API로 이동
const keywords = await api.get('/keywords');
const rankings = await api.get('/rankings');
```

**장점:**
- 다중 디바이스 동기화
- 무제한 스토리지
- 강력한 쿼리 능력

**단점:**
- 오프라인 동작 불가
- 네트워크 레이턴시
- 서버 부하 증가

#### ✅ 권장: Hybrid (Local Cache + Backend Sync)
```typescript
// Local-first with background sync
class DataRepository {
  async getKeywords() {
    // 1. 로컬 캐시 먼저 반환
    const cached = await localDB.keywords.toArray();

    // 2. 백그라운드에서 서버 동기화
    this.syncInBackground();

    return cached;
  }

  async addKeyword(keyword) {
    // 1. 로컬에 즉시 저장
    await localDB.keywords.add(keyword);

    // 2. 서버에 동기화 (실패 시 retry queue)
    await api.post('/keywords', keyword).catch(err => {
      syncQueue.add({ type: 'keyword', data: keyword });
    });
  }
}
```

---

### 2.3 Settings 저장소

| 플랫폼 | 구현 방법 | 저장 위치 |
|--------|----------|----------|
| **Electron** | electron-store | `~/.config/Charles MVP/config.json` |
| **Web** | localStorage + Backend | `localStorage` + `/api/settings` |

**통합 인터페이스:**
```typescript
interface SettingsStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}
```

---

### 2.4 시스템 트레이

**현재:** Electron Tray API로 백그라운드 실행

**웹 대체:** ❌ **불가능** → Graceful Degradation

```typescript
// 웹에서는 기능 숨김
{!isElectron && (
  <div className="alert">
    💡 브라우저 버전에서는 백그라운드 실행이 지원되지 않습니다.
    데스크톱 앱을 설치하시면 더 많은 기능을 사용할 수 있습니다.
  </div>
)}
```

---

### 2.5 네이티브 알림

**Electron:**
```typescript
import { Notification } from 'electron';
new Notification({ title, body }).show();
```

**Web:**
```typescript
// Web Notification API (표준)
if ('Notification' in window && Notification.permission === 'granted') {
  new Notification(title, { body });
}
```

**✅ 통합:**
```typescript
class NotificationService {
  async show(title: string, body: string) {
    if (window.electronAPI?.showNotification) {
      // Electron native notification
      return window.electronAPI.showNotification({ title, body });
    }

    // Web Notification API
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      }
    }
  }
}
```

---

### 2.6 파일 시스템 (Excel Import/Export)

**현재:** `xlsx` 라이브러리 사용 (Electron/Web 모두 동작)

**웹에서:**
```typescript
// File API + xlsx (이미 동작 중)
<input type="file" accept=".xlsx" onChange={handleFileUpload} />

function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    // ... 기존 로직 그대로 사용 가능
  };
  reader.readAsArrayBuffer(file);
}
```

**✅ 변경 불필요** - 현재 구현이 웹과 호환됨

---

### 2.7 자동 업데이트

| 플랫폼 | 방법 |
|--------|------|
| **Electron** | electron-updater (현재 유지) |
| **Web** | Service Worker + Cache API |

**웹 PWA 업데이트:**
```typescript
// service-worker.ts
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('v1').then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/index.js',
        '/assets/index.css'
      ]);
    })
  );
  self.skipWaiting();
});

// 앱에서 업데이트 감지
navigator.serviceWorker.addEventListener('controllerchange', () => {
  toast.info('새 버전이 설치되었습니다. 새로고침하시겠습니까?');
});
```

---

## 3. Platform Adapter 아키텍처

### 3.1 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                    React Application                     │
│                  (플랫폼 무관 비즈니스 로직)                 │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ uses
                      ▼
┌─────────────────────────────────────────────────────────┐
│               Platform Adapter Layer                     │
│                  (추상 인터페이스)                         │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Storage    │  │ Notification │  │  FileSystem  │  │
│  │   Adapter    │  │   Adapter    │  │   Adapter    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└───────────┬──────────────────────────────────┬──────────┘
            │                                  │
    ┌───────┴────────┐                ┌───────┴────────┐
    │                │                │                │
    ▼                ▼                ▼                ▼
┌─────────┐    ┌─────────┐      ┌─────────┐    ┌─────────┐
│Electron │    │   Web   │      │Electron │    │   Web   │
│  Impl   │    │  Impl   │      │  Impl   │    │  Impl   │
└─────────┘    └─────────┘      └─────────┘    └─────────┘
     │              │                 │              │
     ▼              ▼                 ▼              ▼
┌─────────┐    ┌─────────┐      ┌─────────┐    ┌─────────┐
│electron-│    │localStorage     │Electron │    │   Web   │
│  store  │    │IndexedDB│      │Notification   │Notification
└─────────┘    └─────────┘      └─────────┘    └─────────┘
```

---

### 3.2 코드 구조

```
client/src/
├── main/                        # Electron Main Process (변경 없음)
│   ├── index.ts
│   ├── preload.ts
│   └── db.ts
│
├── renderer/
│   ├── platform/                # ✨ NEW: Platform Adapter Layer
│   │   ├── adapters/
│   │   │   ├── StorageAdapter.ts
│   │   │   ├── NotificationAdapter.ts
│   │   │   ├── DatabaseAdapter.ts
│   │   │   └── index.ts
│   │   ├── implementations/
│   │   │   ├── electron/
│   │   │   │   ├── ElectronStorageAdapter.ts
│   │   │   │   ├── ElectronNotificationAdapter.ts
│   │   │   │   └── ElectronDatabaseAdapter.ts
│   │   │   └── web/
│   │   │       ├── WebStorageAdapter.ts
│   │   │       ├── WebNotificationAdapter.ts
│   │   │       └── WebDatabaseAdapter.ts
│   │   ├── PlatformContext.tsx   # React Context Provider
│   │   └── runtime.ts            # 런타임 환경 감지
│   │
│   ├── components/              # 기존 컴포넌트 (어댑터 사용)
│   ├── features/
│   ├── hooks/
│   │   └── usePlatform.ts       # ✨ NEW: Platform adapter hook
│   ├── routes/
│   └── store/
│       └── useSettingsStore.ts  # 수정: Adapter 사용
│
├── web/                         # ✨ NEW: Web-only 엔트리 포인트
│   ├── index.html
│   └── main.tsx
│
└── shared/                      # 공통 타입/유틸
    └── types.ts
```

---

### 3.3 핵심 인터페이스 정의

#### 3.3.1 런타임 감지

```typescript
// platform/runtime.ts
export type RuntimeEnvironment = 'electron' | 'web';

export function detectRuntime(): RuntimeEnvironment {
  return window.electronAPI !== undefined ? 'electron' : 'web';
}

export const isElectron = detectRuntime() === 'electron';
export const isWeb = !isElectron;
```

---

#### 3.3.2 Storage Adapter

```typescript
// platform/adapters/StorageAdapter.ts
export interface IStorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

// platform/implementations/electron/ElectronStorageAdapter.ts
export class ElectronStorageAdapter implements IStorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    if (key === 'backend_url') {
      return (await window.electronAPI.getBackendUrl()) as T;
    }
    // 기타 설정은 localStorage 폴백
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (key === 'backend_url') {
      await window.electronAPI.setBackendUrl(value as string);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  async remove(key: string): Promise<void> {
    if (key === 'backend_url') {
      await window.electronAPI.disconnect();
    } else {
      localStorage.removeItem(key);
    }
  }

  async clear(): Promise<void> {
    await window.electronAPI.disconnect();
    localStorage.clear();
  }
}

// platform/implementations/web/WebStorageAdapter.ts
export class WebStorageAdapter implements IStorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    localStorage.clear();
  }
}
```

---

#### 3.3.3 Notification Adapter

```typescript
// platform/adapters/NotificationAdapter.ts
export interface INotificationAdapter {
  show(title: string, body: string): Promise<void>;
  requestPermission(): Promise<NotificationPermission>;
}

// platform/implementations/electron/ElectronNotificationAdapter.ts
export class ElectronNotificationAdapter implements INotificationAdapter {
  async show(title: string, body: string): Promise<void> {
    await window.electronAPI.showNotification({ title, body });
  }

  async requestPermission(): Promise<NotificationPermission> {
    return 'granted'; // Electron은 자동 허용
  }
}

// platform/implementations/web/WebNotificationAdapter.ts
export class WebNotificationAdapter implements INotificationAdapter {
  async show(title: string, body: string): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon.png' });
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      return await Notification.requestPermission();
    }
    return 'denied';
  }
}
```

---

#### 3.3.4 Database Adapter

```typescript
// platform/adapters/DatabaseAdapter.ts
export interface Keyword {
  id?: number;
  keyword: string;
  url: string;
  naverPlaceId: string | null;
  createdAt?: Date;
}

export interface Ranking {
  id?: number;
  keywordId: number;
  rank: number | null;
  date: Date;
}

export interface IDatabaseAdapter {
  // Keywords
  getKeywords(): Promise<Keyword[]>;
  addKeyword(keyword: Omit<Keyword, 'id'>): Promise<number>;
  deleteKeyword(id: number): Promise<void>;

  // Rankings
  getRankings(keywordId: number, limit?: number): Promise<Ranking[]>;
  addRanking(ranking: Omit<Ranking, 'id'>): Promise<number>;

  // Bulk operations
  bulkInsertKeywords(keywords: Omit<Keyword, 'id'>[]): Promise<void>;
}

// platform/implementations/web/WebDatabaseAdapter.ts
import Dexie, { Table } from 'dexie';

class CharlesDatabase extends Dexie {
  keywords!: Table<Keyword, number>;
  rankings!: Table<Ranking, number>;

  constructor() {
    super('CharlesMVP');
    this.version(1).stores({
      keywords: '++id, keyword, url, &naverPlaceId, createdAt',
      rankings: '++id, keywordId, rank, date'
    });
  }
}

export class WebDatabaseAdapter implements IDatabaseAdapter {
  private db = new CharlesDatabase();

  async getKeywords(): Promise<Keyword[]> {
    return await this.db.keywords.toArray();
  }

  async addKeyword(keyword: Omit<Keyword, 'id'>): Promise<number> {
    return await this.db.keywords.add({
      ...keyword,
      createdAt: new Date()
    });
  }

  async deleteKeyword(id: number): Promise<void> {
    await this.db.keywords.delete(id);
  }

  async getRankings(keywordId: number, limit = 30): Promise<Ranking[]> {
    return await this.db.rankings
      .where('keywordId')
      .equals(keywordId)
      .reverse()
      .limit(limit)
      .toArray();
  }

  async addRanking(ranking: Omit<Ranking, 'id'>): Promise<number> {
    return await this.db.rankings.add(ranking);
  }

  async bulkInsertKeywords(keywords: Omit<Keyword, 'id'>[]): Promise<void> {
    await this.db.keywords.bulkAdd(
      keywords.map(k => ({ ...k, createdAt: new Date() }))
    );
  }
}

// platform/implementations/electron/ElectronDatabaseAdapter.ts
// Electron에서는 기존 db.ts의 함수를 래핑
import * as db from '@/main/db';

export class ElectronDatabaseAdapter implements IDatabaseAdapter {
  async getKeywords(): Promise<Keyword[]> {
    // Electron IPC를 통해 main process의 DB 호출
    // 또는 preload에서 노출된 API 사용
    return db.getKeywords();
  }

  async addKeyword(keyword: Omit<Keyword, 'id'>): Promise<number> {
    return db.insertKeyword(keyword);
  }

  // ... 나머지 메서드 구현
}
```

---

#### 3.3.5 Platform Context

```typescript
// platform/PlatformContext.tsx
import { createContext, useContext, ReactNode } from 'react';
import { detectRuntime } from './runtime';
import { IStorageAdapter, INotificationAdapter, IDatabaseAdapter } from './adapters';
import {
  ElectronStorageAdapter,
  ElectronNotificationAdapter,
  ElectronDatabaseAdapter
} from './implementations/electron';
import {
  WebStorageAdapter,
  WebNotificationAdapter,
  WebDatabaseAdapter
} from './implementations/web';

interface PlatformAdapters {
  storage: IStorageAdapter;
  notification: INotificationAdapter;
  database: IDatabaseAdapter;
  runtime: 'electron' | 'web';
}

const PlatformContext = createContext<PlatformAdapters | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const runtime = detectRuntime();

  const adapters: PlatformAdapters = runtime === 'electron'
    ? {
        storage: new ElectronStorageAdapter(),
        notification: new ElectronNotificationAdapter(),
        database: new ElectronDatabaseAdapter(),
        runtime: 'electron'
      }
    : {
        storage: new WebStorageAdapter(),
        notification: new WebNotificationAdapter(),
        database: new WebDatabaseAdapter(),
        runtime: 'web'
      };

  return (
    <PlatformContext.Provider value={adapters}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatform must be used within PlatformProvider');
  }
  return context;
}
```

---

### 3.4 사용 예시

#### Before (Electron 전용)
```typescript
// SetupScreen.tsx
const handleConnect = async () => {
  await window.electronAPI.setBackendUrl(backendUrl);
  setIsConnected(true);
};
```

#### After (Platform Agnostic)
```typescript
// SetupScreen.tsx
import { usePlatform } from '@/platform/PlatformContext';

function SetupScreen() {
  const { storage } = usePlatform();

  const handleConnect = async () => {
    await storage.set('backend_url', backendUrl);
    setIsConnected(true);
  };

  // ...
}
```

#### Zustand Store 통합
```typescript
// store/useSettingsStore.ts (수정 후)
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { usePlatform } from '@/platform/PlatformContext';

// Platform adapter를 Zustand storage로 래핑
export function createPlatformStorage(adapter: IStorageAdapter) {
  return createJSONStorage(() => ({
    getItem: async (name: string) => {
      const value = await adapter.get(name);
      return value ? JSON.stringify(value) : null;
    },
    setItem: async (name: string, value: string) => {
      await adapter.set(name, JSON.parse(value));
    },
    removeItem: async (name: string) => {
      await adapter.remove(name);
    }
  }));
}

// App.tsx에서 초기화
function App() {
  const { storage } = usePlatform();

  const useSettingsStore = create(
    persist(
      (set) => ({
        backendUrl: '',
        setBackendUrl: (url) => set({ backendUrl: url })
      }),
      {
        name: 'settings',
        storage: createPlatformStorage(storage)
      }
    )
  );

  // ...
}
```

---

## 4. 구현 계획

### Phase 1: 기반 구조 구축 (1주)

**4.1 Platform Adapter Layer 생성**
- [ ] `platform/runtime.ts` - 런타임 환경 감지
- [ ] `platform/adapters/*.ts` - 인터페이스 정의
- [ ] `platform/implementations/electron/*.ts` - Electron 구현체
- [ ] `platform/implementations/web/*.ts` - Web 구현체
- [ ] `platform/PlatformContext.tsx` - React Context Provider

**4.2 타입 정의 통합**
- [ ] `shared/types.ts` - 공통 타입 정의
- [ ] Keyword, Ranking 등 도메인 모델 통합

**4.3 Dependencies 설치**
```bash
cd client
npm install dexie          # IndexedDB wrapper
npm install -D @types/dexie
```

---

### Phase 2: 기존 코드 마이그레이션 (1-2주)

**4.4 Storage 마이그레이션**
- [ ] `useSettingsStore.ts` - Platform adapter 사용하도록 수정
- [ ] `SetupScreen.tsx` - `window.electronAPI` 제거, `usePlatform()` 사용
- [ ] Backend URL 관리 로직 통합

**4.5 Database 마이그레이션**
- [ ] Web용 IndexedDB 래퍼 구현
- [ ] Electron의 `db.ts` API를 adapter로 래핑
- [ ] 키워드 관리 컴포넌트 수정
- [ ] 랭킹 히스토리 컴포넌트 수정

**4.6 Notification 마이그레이션**
- [ ] `SocketListener.tsx` - Platform adapter 사용
- [ ] Web Notification 권한 요청 UI 추가
- [ ] 알림 설정 페이지 추가

---

### Phase 3: 웹 빌드 설정 (3-5일)

**4.7 Vite 설정 분리**

```typescript
// vite.config.electron.ts (Electron용)
export default defineConfig({
  build: {
    outDir: 'dist/renderer',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  }
});

// vite.config.web.ts (Web용)
export default defineConfig({
  build: {
    outDir: 'dist/web',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/web/index.html')
      }
    }
  },
  define: {
    'process.env.PLATFORM': JSON.stringify('web')
  }
});
```

**4.8 엔트리 포인트 분리**

```typescript
// src/web/index.html (Web 전용)
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Charles MVP - Web</title>
    <link rel="manifest" href="/manifest.json" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/web/main.tsx"></script>
  </body>
</html>

// src/web/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { PlatformProvider } from '@/platform/PlatformContext';
import App from '@/renderer/App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlatformProvider>
      <App />
    </PlatformProvider>
  </React.StrictMode>
);
```

**4.9 Package.json 스크립트 추가**

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:vite\" \"npm run dev:electron\"",
    "dev:electron": "...",
    "dev:web": "vite --config vite.config.web.ts",

    "build:electron": "tsc && vite build --config vite.config.electron.ts && electron-builder",
    "build:web": "vite build --config vite.config.web.ts",
    "build:all": "npm run build:electron && npm run build:web",

    "preview:web": "vite preview --config vite.config.web.ts"
  }
}
```

---

### Phase 4: PWA 기능 추가 (3-5일)

**4.10 Service Worker 설정**

```typescript
// public/service-worker.js
const CACHE_NAME = 'charles-mvp-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/index.js',
  '/assets/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

**4.11 Web Manifest**

```json
// public/manifest.json
{
  "name": "Charles MVP",
  "short_name": "Charles",
  "description": "네이버 플레이스 키워드 모니터링 도구",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**4.12 Service Worker 등록**

```typescript
// src/web/main.tsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('SW registered:', registration);
      })
      .catch(error => {
        console.error('SW registration failed:', error);
      });
  });
}
```

---

### Phase 5: 테스트 및 최적화 (1주)

**4.13 크로스 플랫폼 테스트**
- [ ] Electron에서 모든 기능 정상 동작 확인
- [ ] 웹 브라우저에서 모든 기능 정상 동작 확인
- [ ] IndexedDB vs SQLite 데이터 일관성 테스트
- [ ] 오프라인 모드 테스트 (웹)

**4.14 성능 최적화**
- [ ] 번들 사이즈 최적화 (code splitting)
- [ ] Lazy loading 적용
- [ ] Service Worker 캐싱 전략 최적화

**4.15 에러 처리**
- [ ] Platform adapter 에러 핸들링
- [ ] Graceful degradation (기능 미지원 시)
- [ ] 사용자 피드백 메시지

---

## 5. 마이그레이션 가이드

### 5.1 개발자 가이드

**기존 코드 수정 시:**

```typescript
// ❌ Before
if (window.electronAPI) {
  await window.electronAPI.setBackendUrl(url);
}

// ✅ After
import { usePlatform } from '@/platform/PlatformContext';

const { storage } = usePlatform();
await storage.set('backend_url', url);
```

**새로운 기능 추가 시:**

1. Platform adapter 인터페이스 먼저 정의
2. Electron 구현체 작성
3. Web 구현체 작성
4. 컴포넌트에서 `usePlatform()` hook 사용

---

### 5.2 배포 전략

**Electron (기존 사용자):**
```bash
npm run build:electron
# release/ 폴더에 설치 파일 생성
```

**Web (신규 사용자):**
```bash
npm run build:web
# dist/web/ 폴더를 정적 호스팅 서비스에 배포
# Vercel, Netlify, Cloudflare Pages 등
```

**권장 배포 흐름:**
1. Electron 버전 먼저 안정화 (기존 사용자 영향 최소화)
2. Web 버전 베타 테스트
3. Web 버전 공식 출시
4. 두 버전 병행 유지

---

### 5.3 기능 비교표

| 기능 | Electron | Web |
|------|----------|-----|
| **키워드 모니터링** | ✅ | ✅ |
| **랭킹 히스토리** | ✅ | ✅ (IndexedDB) |
| **실시간 알림** | ✅ Native | ✅ Web Notification |
| **Excel Import/Export** | ✅ | ✅ |
| **시스템 트레이** | ✅ | ❌ |
| **백그라운드 실행** | ✅ | ❌ |
| **자동 업데이트** | ✅ | ✅ (Service Worker) |
| **오프라인 동작** | ✅ | ⚠️ (제한적) |
| **설치 필요** | ✅ | ❌ |
| **크로스 플랫폼** | ✅ | ✅ |

---

## 6. 예상 이슈 및 해결 방안

### 6.1 데이터 마이그레이션

**문제:** Electron 사용자가 웹으로 전환 시 기존 데이터 손실

**해결:**
1. Electron 버전에 "데이터 내보내기" 기능 추가
2. 내보낸 JSON을 웹 버전에서 가져오기
3. 또는 Backend API를 통한 클라우드 동기화

```typescript
// Export 기능
async function exportData() {
  const keywords = await db.getKeywords();
  const rankings = await db.getRankings();
  const data = { keywords, rankings };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'charles-data-export.json';
  a.click();
}

// Import 기능
async function importData(file: File) {
  const text = await file.text();
  const data = JSON.parse(text);
  await db.bulkInsertKeywords(data.keywords);
  await db.bulkInsertRankings(data.rankings);
}
```

---

### 6.2 브라우저 호환성

**문제:** 구형 브라우저에서 IndexedDB, Notification API 미지원

**해결:**
- Feature detection으로 지원 여부 확인
- 미지원 시 사용자에게 브라우저 업그레이드 안내
- Polyfill 제공 (idb-keyval 등)

```typescript
// Feature detection
if (!('indexedDB' in window)) {
  toast.error('이 브라우저는 지원하지 않습니다. Chrome, Firefox, Safari 최신 버전을 사용해주세요.');
}
```

---

### 6.3 CORS 이슈

**문제:** 웹 버전에서 Backend API 호출 시 CORS 에러

**해결:**
Backend에 CORS 헤더 추가

```typescript
// backend/src/app.ts
import cors from 'cors';

app.use(cors({
  origin: [
    'http://localhost:5173',        // Vite dev server
    'https://charles-app.com',      // 프로덕션 웹 도메인
    'file://'                        // Electron (로컬 파일)
  ],
  credentials: true
}));
```

---

## 7. 장기 로드맵

### 7.1 멀티 디바이스 동기화 (Phase 6)

Backend API에 사용자 인증 추가 후 클라우드 동기화:

```typescript
// 로그인 후 데이터 동기화
await syncService.push(localKeywords);  // 로컬 → 서버
const serverKeywords = await syncService.pull();  // 서버 → 로컬
```

### 7.2 모바일 대응 (Phase 7)

- React Native 또는 Progressive Web App
- 동일한 Platform Adapter 패턴 재사용

### 7.3 협업 기능 (Phase 8)

- 팀 단위 키워드 공유
- 실시간 협업 모니터링

---

## 8. 결론

### ✅ 제안 요약

1. **Platform Adapter Pattern** - 플랫폼 독립적 코드 작성
2. **Electron 유지** - 기존 사용자 경험 보존
3. **Web 확장** - 신규 사용자 진입 장벽 제거
4. **점진적 마이그레이션** - 단계별 안전한 전환
5. **미래 확장성** - 모바일, 클라우드 대응 준비

### 🎯 핵심 장점

- **코드 중복 최소화** - 비즈니스 로직 재사용
- **유지보수 용이** - 단일 코드베이스
- **점진적 전환** - 리스크 최소화
- **사용자 선택권** - Electron vs Web

### 📊 예상 효과

- 웹 버전으로 설치 없이 즉시 사용 가능
- 브라우저만 있으면 어디서나 접근
- 데스크톱 앱의 네이티브 기능은 Electron으로 제공
- 플랫폼별 최적화된 사용자 경험

---

**다음 단계:** 이 제안서를 검토 후 Phase 1부터 순차적으로 구현을 시작하시겠습니까?
