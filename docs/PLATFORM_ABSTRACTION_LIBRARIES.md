# Platform Abstraction Libraries 분석

웹/Electron 공존을 위한 기존 라이브러리 분석 및 직접 구현 대비 비교

---

## 📋 목차

1. [Storage Abstraction Libraries](#1-storage-abstraction-libraries)
2. [Full Platform Abstraction Frameworks](#2-full-platform-abstraction-frameworks)
3. [직접 구현 vs 라이브러리 비교](#3-직접-구현-vs-라이브러리-비교)
4. [현재 프로젝트 요구사항 분석](#4-현재-프로젝트-요구사항-분석)
5. [추천 및 선택 가이드](#5-추천-및-선택-가이드)

---

## 1. Storage Abstraction Libraries

### 1.1 localForage ⭐ (가장 인기)

**개요:**
- IndexedDB/WebSQL/localStorage를 통합한 간단한 key-value 스토리지
- localStorage 스타일의 동기 API를 비동기로 제공
- 자동 fallback (IndexedDB → WebSQL → localStorage)

**기본 사용법:**
```typescript
import localforage from 'localforage';

// 설정
await localforage.setItem('backend_url', 'http://localhost:3000');

// 조회
const url = await localforage.getItem('backend_url');

// 삭제
await localforage.removeItem('backend_url');

// 모든 데이터
await localforage.clear();
```

**장점:**
- ✅ **간단한 API** - localStorage와 유사하여 학습 곡선 낮음
- ✅ **자동 fallback** - 브라우저 호환성 우수 (IE8+)
- ✅ **다양한 데이터 타입** - String, Number, Object, Array, Blob 모두 지원
- ✅ **성숙한 생태계** - 10년+ 개발, 24k+ GitHub stars
- ✅ **플러그인 시스템** - 사용자 정의 storage driver 추가 가능

**단점:**
- ❌ **복잡한 쿼리 불가** - Key-value만 지원, WHERE 절 등 없음
- ❌ **인덱싱 제한** - 단순 키 기반 조회만 가능
- ❌ **번들 사이즈** - ~7KB (압축 시), idb-keyval 대비 큼
- ❌ **관계형 데이터 미지원** - JOIN 불가능
- ❌ **Electron 네이티브 연동 없음** - electron-store 별도 필요

**현재 지원 수준 (2025):**
- npm: 26M+ weekly downloads
- GitHub: 24.8k stars, 마지막 릴리즈 2024년 12월
- 브라우저 호환성: 모든 모던 브라우저 + IE8
- TypeScript: 공식 타입 정의 제공

**프로젝트 적용 시:**
```typescript
// Settings Storage
await localforage.setItem('backend_url', url);

// ❌ Keyword Storage - 복잡한 쿼리 불가능
// localForage는 key-value만 지원하므로 키워드 검색, 필터링 어려움
await localforage.setItem('keyword_1', { keyword: '강남 맛집', url: '...' });
await localforage.setItem('keyword_2', { keyword: '서초 카페', url: '...' });
// → 모든 키워드 조회 시 keys()로 전체 순회 필요
```

**적합성:** ⚠️ **부분 적합** - Settings 저장에는 적합하나, Keyword/Ranking DB 대체는 불가능

---

### 1.2 idb-keyval (초경량)

**개요:**
- IndexedDB를 래핑한 초미니멀 key-value 스토어
- Promise 기반, 단 573 bytes (brotli 압축 시)

**기본 사용법:**
```typescript
import { get, set, del, clear } from 'idb-keyval';

// 설정
await set('backend_url', 'http://localhost:3000');

// 조회
const url = await get('backend_url');

// 삭제
await del('backend_url');

// 전체 삭제
await clear();
```

**장점:**
- ✅ **극도로 작음** - 573 bytes, localForage의 1/12 크기
- ✅ **Tree-shakeable** - get/set만 쓰면 295 bytes
- ✅ **Promise 기반** - async/await 완벽 지원
- ✅ **TypeScript 우선** - 타입 안전성 보장

**단점:**
- ❌ **모던 브라우저만** - IE 미지원
- ❌ **Fallback 없음** - IndexedDB 없으면 에러
- ❌ **단순 key-value만** - 쿼리, 인덱싱 불가능
- ❌ **복잡한 작업 불가** - iteration, batch 등 미지원

**현재 지원 수준 (2025):**
- npm: 2.5M+ weekly downloads
- GitHub: 2.4k stars, 마지막 릴리즈 2024년 10월
- 브라우저 호환성: Chrome 58+, Firefox 54+, Safari 10+
- TypeScript: 완벽 지원

**프로젝트 적용 시:**
```typescript
// ✅ Settings Storage - 완벽 적합
await set('backend_url', url);

// ❌ Keyword Storage - 불가능
// idb-keyval은 iteration도 제한적
```

**적합성:** ⚠️ **부분 적합** - Settings만 가능, DB 대체 불가능

---

### 1.3 Dexie.js (IndexedDB 전문)

**개요:**
- IndexedDB를 위한 강력한 래퍼
- SQL-like 쿼리, 인덱싱, 트랜잭션 지원
- 복잡한 데이터 모델링 가능

**기본 사용법:**
```typescript
import Dexie from 'dexie';

// DB 정의
class CharlesDB extends Dexie {
  keywords!: Dexie.Table<Keyword, number>;
  rankings!: Dexie.Table<Ranking, number>;

  constructor() {
    super('CharlesMVP');
    this.version(1).stores({
      keywords: '++id, keyword, url, naverPlaceId',
      rankings: '++id, keywordId, rank, date'
    });
  }
}

const db = new CharlesDB();

// CRUD
await db.keywords.add({ keyword: '강남 맛집', url: '...' });
const keywords = await db.keywords.where('keyword').startsWithIgnoreCase('강남').toArray();
await db.keywords.where('id').equals(1).delete();

// 관계형 쿼리
const keyword = await db.keywords.get(1);
const rankings = await db.rankings.where('keywordId').equals(keyword.id).toArray();
```

**장점:**
- ✅ **강력한 쿼리** - WHERE, ORDER BY, LIMIT 지원
- ✅ **인덱싱** - 빠른 검색 성능
- ✅ **TypeScript 우수** - 타입 안전한 쿼리
- ✅ **트랜잭션** - ACID 보장
- ✅ **Observable** - 데이터 변경 감지 (React 연동 우수)
- ✅ **마이그레이션** - 스키마 버전 관리
- ✅ **Bulk 연산** - bulkAdd, bulkPut 최적화

**단점:**
- ❌ **번들 사이즈** - ~20KB (gzipped), idb-keyval 대비 큼
- ❌ **Electron 연동 없음** - SQLite 대체 불가능
- ❌ **서버 동기화 없음** - 별도 구현 필요
- ❌ **학습 곡선** - API가 많아 초기 학습 필요

**현재 지원 수준 (2025):**
- npm: 1.3M+ weekly downloads
- GitHub: 11.2k stars, 마지막 릴리즈 2024년 12월
- 브라우저 호환성: 모든 모던 브라우저
- TypeScript: 완벽 지원, Generic 타입 안전성

**프로젝트 적용 시:**
```typescript
// ✅ Keyword & Ranking Storage - 완벽 대체 가능
class CharlesDB extends Dexie {
  keywords!: Dexie.Table<Keyword, number>;
  rankings!: Dexie.Table<Ranking, number>;

  constructor() {
    super('CharlesMVP');
    this.version(1).stores({
      keywords: '++id, keyword, url, naverPlaceId',
      rankings: '++id, keywordId, rank, date'
    });
  }
}

// 기존 SQLite 쿼리와 유사
const keywords = await db.keywords.toArray();
const recentRankings = await db.rankings
  .where('keywordId').equals(1)
  .reverse()
  .limit(30)
  .toArray();
```

**적합성:** ✅ **높음** - 웹에서 SQLite 완전 대체 가능, 단 Electron 연동은 별도 필요

---

### 1.4 RxDB (Offline-First Database)

**개요:**
- Offline-first, Local-first NoSQL 데이터베이스
- Electron, Web, React Native 모두 지원
- 실시간 동기화, 암호화, 압축 내장

**기본 사용법:**
```typescript
import { createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

// DB 생성
const db = await createRxDatabase({
  name: 'charlesmvp',
  storage: getRxStorageDexie() // 웹에서는 Dexie 사용
});

// Collection 정의
await db.addCollections({
  keywords: {
    schema: {
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string', maxLength: 100 },
        keyword: { type: 'string' },
        url: { type: 'string' }
      }
    }
  }
});

// CRUD (Reactive)
await db.keywords.insert({ id: '1', keyword: '강남 맛집', url: '...' });
const keywords$ = db.keywords.find().$.subscribe(keywords => {
  console.log('Keywords changed:', keywords);
});
```

**Electron 통합:**
```typescript
// Main Process - SQLite 사용
import { getRxStorageSQLite } from 'rxdb-premium/plugins/storage-sqlite';

const db = await createRxDatabase({
  name: 'charlesmvp',
  storage: getRxStorageSQLite({
    sqliteBasicsNode: require('better-sqlite3')
  })
});

// Renderer Process - Remote Storage
import { getRxStorageRemote } from 'rxdb/plugins/storage-remote';
const db = await createRxDatabase({
  storage: getRxStorageRemote({
    remote: remoteStorage,
    mode: 'storage'
  })
});
```

**장점:**
- ✅ **완벽한 크로스 플랫폼** - Electron, Web, React Native 동일 API
- ✅ **Reactive** - Observable 기반, React 연동 우수
- ✅ **Offline-First** - 자동 sync, conflict resolution
- ✅ **플러그인 생태계** - 암호화, 압축, 리더 선출 등
- ✅ **Storage Adapter** - IndexedDB, SQLite, Memory, OPFS 등 교체 가능
- ✅ **Electron 전용 플러그인** - Main/Renderer 분리 지원
- ✅ **실시간 동기화** - CouchDB, GraphQL, HTTP 등 백엔드 연동

**단점:**
- ❌ **복잡도 높음** - 학습 곡선 steep
- ❌ **번들 사이즈 큼** - 최소 50KB+
- ❌ **Premium 기능** - SQLite, 암호화 일부 유료 ($)
- ❌ **오버스펙** - 단순 앱에는 과함
- ❌ **성능 오버헤드** - Reactive layer 추가 비용

**현재 지원 수준 (2025):**
- npm: 200k+ weekly downloads
- GitHub: 21.5k stars, 활발한 개발 (주간 업데이트)
- 브라우저 호환성: 모든 모던 브라우저
- Electron: 공식 지원, 전용 플러그인
- TypeScript: 완벽 지원

**프로젝트 적용 시:**
```typescript
// ✅✅ 완벽한 Electron/Web 통합
// Electron Main: SQLite 사용
// Electron Renderer: Remote Storage
// Web: IndexedDB (Dexie) 사용

// 장점: 단일 코드베이스
const keywords = await db.keywords.find().exec();

// Reactive 업데이트
db.keywords.find().$
  .subscribe(keywords => {
    setKeywords(keywords);
  });
```

**적합성:** ✅✅ **최고** - Electron/Web 완벽 통합, 단 복잡도와 번들 사이즈 trade-off

---

### 1.5 Capacitor Storage Plugin

**개요:**
- Ionic/Capacitor의 공식 Storage API
- iOS, Android, Web, Electron 크로스 플랫폼
- Key-value 스토리지 (단순)

**기본 사용법:**
```typescript
import { Preferences } from '@capacitor/preferences';

// 설정
await Preferences.set({ key: 'backend_url', value: 'http://localhost:3000' });

// 조회
const { value } = await Preferences.get({ key: 'backend_url' });

// 삭제
await Preferences.remove({ key: 'backend_url' });
```

**Community SQLite Plugin:**
```typescript
import { CapacitorSQLite } from '@capacitor-community/sqlite';

// Electron, Web 모두 지원
const db = await CapacitorSQLite.createConnection({
  database: 'charlesmvp',
  encrypted: false,
  mode: 'no-encryption',
  version: 1
});

await db.execute('CREATE TABLE IF NOT EXISTS keywords ...');
```

**장점:**
- ✅ **모바일 확장성** - 향후 iOS/Android 앱 고려 시 유리
- ✅ **공식 지원** - Ionic 팀의 적극적 유지보수
- ✅ **플러그인 생태계** - 파일 시스템, 카메라 등 100+ 플러그인
- ✅ **Electron 지원** - @capacitor-community/electron

**단점:**
- ❌ **Capacitor 전체 설치 필요** - 오버킬
- ❌ **Electron 플러그인 제한적** - V4부터 web plugin만 동작
- ❌ **SQLite는 Community 플러그인** - 공식 아님
- ❌ **모바일 중심** - Desktop에는 부자연스러움

**현재 지원 수준 (2025):**
- npm: Capacitor 700k+ weekly downloads
- GitHub: Capacitor 5.4k stars
- Electron: @capacitor-community/electron (실험적)
- Web: ✅ 완벽 지원
- SQLite: Community 플러그인 (별도 설치)

**프로젝트 적용 시:**
```typescript
// Settings: Preferences API 사용
await Preferences.set({ key: 'backend_url', value: url });

// Database: Community SQLite 플러그인
// → Electron에서 동작하나, 직접 better-sqlite3 사용이 더 나음
```

**적합성:** ⚠️ **낮음** - 모바일 앱 계획 없으면 오버킬, Electron 지원 제한적

---

## 2. Full Platform Abstraction Frameworks

### 2.1 Capacitor (Ionic)

**개요:**
- "Electron for Mobile" - Web → Mobile/Desktop 크로스 플랫폼
- 웹 코드를 iOS, Android, Electron으로 배포

**장점:**
- ✅ **모바일 확장** - 향후 모바일 앱 계획 시 최적
- ✅ **플러그인 생태계** - 100+ 공식/커뮤니티 플러그인
- ✅ **웹 우선** - React 앱 그대로 사용

**단점:**
- ❌ **Electron이 우선 순위 아님** - 모바일 중심 설계
- ❌ **추가 레이어** - Capacitor 런타임 오버헤드
- ❌ **현재 Electron만 필요하면 불필요**

**적합성:** ❌ **낮음** - 모바일 앱 계획 없으면 오버킬

---

### 2.2 Tauri (Electron 대체)

**개요:**
- Rust 기반 Electron 대체제
- 시스템 WebView 사용 (Chromium 번들 안 함)
- 번들 사이즈 1/40, 메모리 1/3

**기본 개념:**
```typescript
// Frontend (React) - 변경 없음
import { invoke } from '@tauri-apps/api';

const url = await invoke('get_backend_url');
await invoke('set_backend_url', { url: 'http://localhost:3000' });

// Backend (Rust)
#[tauri::command]
fn get_backend_url(state: State<AppState>) -> String {
  state.backend_url.lock().unwrap().clone()
}
```

**장점:**
- ✅ **극도로 작음** - 2.5MB vs Electron 80MB
- ✅ **빠름** - Rust 네이티브 성능
- ✅ **보안 우수** - 기본 샌드박스, 최소 권한
- ✅ **웹 배포 가능** - 프론트엔드는 일반 웹으로도 배포 가능

**단점:**
- ❌ **완전한 재작성 필요** - 기존 Electron 코드 버림
- ❌ **Rust 학습** - 백엔드를 Rust로 작성해야 함
- ❌ **생태계 작음** - Electron 대비 플러그인 부족
- ❌ **WebView 차이** - Windows(Chromium), macOS(WebKit) 차이
- ❌ **SQLite 직접 연동 어려움** - Rust 코드 필요

**현재 지원 수준 (2025):**
- GitHub: 88k+ stars (Electron의 2배!)
- 채택률 증가: 2024년 35% YoY 성장
- 성숙도: v2.0 출시 (2024년 후반), 프로덕션 Ready
- 커뮤니티: 급성장 중

**프로젝트 적용 시:**
```typescript
// ❌ 마이그레이션 비용 엄청남
// 1. Main Process (Node.js) → Rust로 재작성
// 2. better-sqlite3 → Rust SQLite 바인딩
// 3. electron-store → Rust serde
// 4. IPC API 전부 재정의

// ✅ 장점: 이후 웹 배포 시 프론트엔드만 분리하면 됨
```

**적합성:** ❌ **낮음** - 기존 Electron 앱 유지 필요, 마이그레이션 비용 너무 큼

---

## 3. 직접 구현 vs 라이브러리 비교

### 3.1 비교표

| 항목 | 직접 구현 (Adapter Pattern) | localForage | Dexie.js | RxDB | Capacitor | Tauri |
|------|---------------------------|-------------|----------|------|-----------|-------|
| **번들 사이즈** | ~5KB (코드만) | 7KB | 20KB | 50KB+ | 500KB+ | N/A (Rust) |
| **Electron 지원** | ✅ 완벽 제어 | ❌ 별도 구현 | ❌ 별도 구현 | ✅ 공식 플러그인 | ⚠️ 제한적 | ✅ (재작성) |
| **Web 지원** | ✅ IndexedDB 직접 | ✅ 자동 fallback | ✅ IndexedDB | ✅ 다양한 storage | ✅ | ✅ |
| **SQLite 대체** | ✅ 가능 | ❌ 불가능 | ✅ 가능 | ✅ 가능 | ⚠️ 커뮤니티 | ✅ (Rust) |
| **Settings 저장** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **복잡한 쿼리** | 직접 구현 | ❌ | ✅ | ✅ | ⚠️ | ✅ |
| **TypeScript** | ✅ 완전 제어 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **학습 곡선** | 중간 | 낮음 | 중간 | 높음 | 중간 | 매우 높음 |
| **유지보수** | 직접 유지 | 성숙함 | 활발함 | 매우 활발함 | 활발함 | 급성장 |
| **모바일 확장** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **기존 코드 재사용** | ✅ 100% | ⚠️ 50% | ⚠️ 50% | ⚠️ 60% | ⚠️ 40% | ❌ 0% |

---

### 3.2 세부 비교

#### A. Storage (Settings) 계층

**요구사항:** Backend URL, 기타 설정값 저장

| 솔루션 | 구현 난이도 | 적합성 |
|--------|-----------|--------|
| **직접 구현** | ⭐⭐ (쉬움) | ✅ 완벽 |
| **localForage** | ⭐ (매우 쉬움) | ✅ 완벽 |
| **idb-keyval** | ⭐ (매우 쉬움) | ✅ 완벽 |
| **Dexie** | ⭐⭐ (중간) - 오버킬 | ✅ 가능하나 불필요 |
| **RxDB** | ⭐⭐⭐ (복잡) - 오버킬 | ✅ 가능하나 불필요 |

**추천:** localForage 또는 idb-keyval

---

#### B. Database (Keywords/Rankings) 계층

**요구사항:** CRUD, 인덱싱, 복잡한 쿼리 (최근 30개 순위 등)

| 솔루션 | 구현 난이도 | 적합성 |
|--------|-----------|--------|
| **직접 구현** (IndexedDB) | ⭐⭐⭐⭐ (어려움) | ✅ 가능하나 힘듦 |
| **localForage** | ❌ 불가능 | ❌ |
| **Dexie** | ⭐⭐ (쉬움) | ✅✅ 최적 |
| **RxDB** | ⭐⭐⭐ (중간) | ✅ 가능, 오버스펙 |

**추천:** Dexie.js

---

#### C. Notification 계층

**요구사항:** Electron Native + Web Notification API 통합

| 솔루션 | 구현 난이도 | 적합성 |
|--------|-----------|--------|
| **직접 구현** | ⭐⭐ (쉬움) | ✅ 완벽 |
| **라이브러리** | 없음 | ❌ |

**추천:** 직접 구현 (10줄 미만)

---

#### D. Electron ↔ Web 통합

**요구사항:** 단일 코드베이스, 런타임 분기

| 솔루션 | 구현 난이도 | 적합성 |
|--------|-----------|--------|
| **직접 구현** (Adapter Pattern) | ⭐⭐⭐ (중간) | ✅ 완전 제어 |
| **RxDB** | ⭐⭐⭐⭐ (복잡) | ✅ 통합 우수 |
| **Capacitor** | ⭐⭐⭐ (중간) | ⚠️ 제한적 |
| **Tauri** | ⭐⭐⭐⭐⭐ (매우 복잡) | ❌ 재작성 필요 |

**추천:** 직접 구현 (Adapter) 또는 RxDB

---

## 4. 현재 프로젝트 요구사항 분석

### 4.1 현재 사용 중인 기술

**Electron:**
- better-sqlite3 (SQLite)
- electron-store (Settings)
- IPC 통신

**Web:**
- React 19.2.3
- Zustand 5.0.9 (상태 관리)
- TanStack Query (API)
- Vite (번들러)

### 4.2 필요한 Adapter

| 계층 | Electron 구현 | Web 구현 | 복잡도 |
|------|--------------|----------|--------|
| **Storage** | electron-store → IPC | localStorage | ⭐ 쉬움 |
| **Database** | better-sqlite3 | IndexedDB (Dexie) | ⭐⭐⭐ 중간 |
| **Notification** | Electron Notification | Web Notification API | ⭐ 쉬움 |

### 4.3 Database 스키마

```sql
-- 기존 SQLite (Electron)
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  url TEXT NOT NULL,
  naverPlaceId TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rankings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keywordId INTEGER NOT NULL,
  rank INTEGER,
  date DATETIME NOT NULL,
  FOREIGN KEY (keywordId) REFERENCES keywords(id)
);
```

**Dexie 변환:**
```typescript
class CharlesDB extends Dexie {
  keywords!: Table<Keyword, number>;
  rankings!: Table<Ranking, number>;

  constructor() {
    super('CharlesMVP');
    this.version(1).stores({
      keywords: '++id, keyword, url, naverPlaceId, createdAt',
      rankings: '++id, keywordId, rank, date'
    });
  }
}
```

**RxDB 변환:**
```typescript
const keywordsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string' },
    keyword: { type: 'string' },
    url: { type: 'string' },
    naverPlaceId: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' }
  },
  indexes: ['keyword', 'naverPlaceId']
};
```

---

## 5. 추천 및 선택 가이드

### 5.1 시나리오별 최적 솔루션

#### 📌 시나리오 A: 빠른 구현 + 최소 의존성

**추천:** 직접 구현 (Adapter Pattern) + Dexie

**이유:**
- ✅ 기존 Electron 코드 90% 재사용
- ✅ 번들 사이즈 최소 (~25KB 추가)
- ✅ 완전한 제어권
- ✅ 학습 곡선 낮음

**구현 범위:**
```
PlatformAdapter (직접 구현)
├── StorageAdapter - localStorage vs electron-store (30줄)
├── NotificationAdapter - Web API vs Electron API (20줄)
└── DatabaseAdapter - Dexie vs better-sqlite3 (100줄)
```

**총 작업량:** ~150줄 + Dexie 설정

---

#### 📌 시나리오 B: 최고 수준의 통합 + 미래 확장성

**추천:** RxDB

**이유:**
- ✅ Electron/Web 완벽 통합
- ✅ Reactive 데이터 흐름 (React 친화적)
- ✅ 향후 실시간 동기화 추가 용이
- ✅ 모바일 확장 가능

**단점:**
- ❌ 학습 곡선 높음 (2-3일 소요)
- ❌ 번들 사이즈 증가 (50KB+)
- ❌ SQLite Premium 기능 유료

**적합한 경우:**
- 실시간 멀티 디바이스 동기화 계획
- 모바일 앱 계획
- 팀 협업 기능 추가 예정

---

#### 📌 시나리오 C: 극단적 성능 최적화

**추천:** Tauri 마이그레이션

**이유:**
- ✅ 번들 사이즈 1/40 (2.5MB)
- ✅ 메모리 1/3 (30MB)
- ✅ 보안 우수

**단점:**
- ❌ 완전한 재작성 (1-2개월)
- ❌ Rust 학습 필요
- ❌ 기존 Node.js 백엔드 재작성

**적합한 경우:**
- 장기 프로젝트 (1년+)
- 성능이 절대적으로 중요
- Rust 학습 의지

---

### 5.2 최종 추천 (현재 프로젝트 기준)

#### 🏆 1순위: 직접 구현 + Dexie

**구성:**
- **Storage:** 직접 구현 (localStorage vs electron-store)
- **Database:** Dexie (웹) vs better-sqlite3 (Electron)
- **Notification:** 직접 구현

**장점:**
- ✅ 기존 코드 최대한 재사용
- ✅ 번들 사이즈 최소 (~20KB)
- ✅ 빠른 구현 (1-2주)
- ✅ 완전한 제어
- ✅ 의존성 최소

**패키지 추가:**
```json
{
  "dependencies": {
    "dexie": "^4.0.0"  // 웹 DB
  }
}
```

**작업량:**
- Platform Adapter 구현: 150줄
- Dexie 스키마 정의: 50줄
- 기존 컴포넌트 수정: 10개 파일 (각 5-10줄)
- **총 예상 시간: 1-2주**

---

#### 🥈 2순위: RxDB (미래 확장성 고려 시)

**구성:**
- **모든 계층:** RxDB로 통합

**장점:**
- ✅ Electron/Web 완벽 통합
- ✅ Reactive 데이터 흐름
- ✅ 향후 기능 확장 용이

**단점:**
- ❌ 학습 곡선 높음
- ❌ 번들 사이즈 큼 (50KB)
- ❌ SQLite Premium 기능 유료 ($200/년)

**패키지 추가:**
```json
{
  "dependencies": {
    "rxdb": "^15.0.0",
    "rxdb/plugins/storage-dexie": "*",  // 웹
    "rxdb-premium/plugins/storage-sqlite": "*"  // Electron (유료)
  }
}
```

**작업량:**
- RxDB 설정: 100줄
- 스키마 정의: 100줄
- 기존 컴포넌트 수정: 15개 파일 (각 10-20줄)
- **총 예상 시간: 2-3주**

---

#### 🥉 3순위: localForage + 직접 구현

**구성:**
- **Storage:** localForage
- **Database:** 직접 IndexedDB 또는 Dexie
- **Notification:** 직접 구현

**장점:**
- ✅ Settings 저장 매우 간단
- ✅ 성숙한 localForage 생태계

**단점:**
- ⚠️ 여전히 DB는 별도 구현 필요

**적합성:** 1순위와 거의 유사, localForage만 추가

---

### 5.3 의사결정 트리

```
Electron 앱 유지 필요?
├─ Yes
│  │
│  ├─ 빠른 구현 원함?
│  │  ├─ Yes → ✅ 직접 구현 + Dexie (1순위)
│  │  └─ No
│  │     │
│  │     └─ 미래 확장성 중요?
│  │        ├─ Yes → ✅ RxDB (2순위)
│  │        └─ No → ✅ 직접 구현 + Dexie (1순위)
│  │
│  └─ 모바일 앱 계획?
│     ├─ Yes → RxDB 또는 Capacitor
│     └─ No → 직접 구현 + Dexie
│
└─ No (Electron 버릴 수 있음)
   │
   └─ 성능 최우선?
      ├─ Yes → Tauri (완전 재작성)
      └─ No → 직접 구현 + Dexie
```

---

### 5.4 구체적 실행 계획 (1순위 기준)

#### Phase 1: Dexie 설정 (1일)

```bash
npm install dexie
```

```typescript
// src/renderer/platform/web/CharlesDB.ts
import Dexie, { Table } from 'dexie';

export class CharlesDB extends Dexie {
  keywords!: Table<Keyword, number>;
  rankings!: Table<Ranking, number>;

  constructor() {
    super('CharlesMVP');
    this.version(1).stores({
      keywords: '++id, keyword, url, naverPlaceId, createdAt',
      rankings: '++id, keywordId, rank, date'
    });
  }
}

export const webDB = new CharlesDB();
```

#### Phase 2: Adapter 인터페이스 (1일)

```typescript
// src/renderer/platform/adapters/DatabaseAdapter.ts
export interface IDatabaseAdapter {
  getKeywords(): Promise<Keyword[]>;
  addKeyword(keyword: Omit<Keyword, 'id'>): Promise<number>;
  // ... 나머지 메서드
}
```

#### Phase 3: 구현체 작성 (2-3일)

**Electron 구현체:**
```typescript
// src/renderer/platform/implementations/electron/ElectronDatabaseAdapter.ts
export class ElectronDatabaseAdapter implements IDatabaseAdapter {
  // 기존 better-sqlite3 코드 래핑
}
```

**Web 구현체:**
```typescript
// src/renderer/platform/implementations/web/WebDatabaseAdapter.ts
export class WebDatabaseAdapter implements IDatabaseAdapter {
  async getKeywords() {
    return await webDB.keywords.toArray();
  }
  // ... Dexie API 사용
}
```

#### Phase 4: Context Provider (1일)

```typescript
// src/renderer/platform/PlatformContext.tsx
export function PlatformProvider({ children }) {
  const adapters = detectRuntime() === 'electron'
    ? { database: new ElectronDatabaseAdapter() }
    : { database: new WebDatabaseAdapter() };

  return <PlatformContext.Provider value={adapters}>{children}</PlatformContext.Provider>;
}
```

#### Phase 5: 컴포넌트 마이그레이션 (3-5일)

```typescript
// Before
const keywords = await db.getKeywords();

// After
const { database } = usePlatform();
const keywords = await database.getKeywords();
```

#### Phase 6: 테스트 및 디버깅 (2-3일)

**총 예상 시간: 10-14일 (2주)**

---

## 6. 결론

### ✅ 최종 추천: 직접 구현 + Dexie

**이유:**
1. **기존 코드 재사용 최대화** - Electron 코드 90% 유지
2. **최소 의존성** - Dexie 1개만 추가 (20KB)
3. **빠른 구현** - 2주 내 완료 가능
4. **완전한 제어** - 커스터마이징 자유로움
5. **학습 곡선 낮음** - 팀원 온보딩 용이

### 📊 비용 효과 분석

| 솔루션 | 구현 시간 | 번들 증가 | 학습 곡선 | 유지보수 | 확장성 | 총점 |
|--------|---------|----------|----------|---------|--------|------|
| **직접 구현 + Dexie** | 2주 | +20KB | 낮음 | 직접 | 중간 | ⭐⭐⭐⭐⭐ |
| RxDB | 3주 | +50KB | 높음 | 라이브러리 | 높음 | ⭐⭐⭐⭐ |
| Tauri | 8주 | -80MB | 매우 높음 | 라이브러리 | 높음 | ⭐⭐⭐ |
| Capacitor | 3주 | +500KB | 중간 | 라이브러리 | 높음 | ⭐⭐⭐ |

---

## Sources

- [localForage GitHub](https://github.com/localForage/localForage)
- [localForage vs idb-keyval vs Dexie Comparison](https://npm-compare.com/dexie,idb-keyval,localforage)
- [Best library for IndexedDB Guide](https://www.paultman.com/posts/best-library-for-indexeddb-localforage-idb-keyval-or-idb/)
- [Dexie vs localForage Comparison](https://www.libtrends.info/npm-compare/dexie-vs-indexeddb-vs-localforage-vs-react-native)
- [RxDB Electron Database Support](https://rxdb.info/electron-database.html)
- [RxDB GitHub](https://github.com/pubkey/rxdb)
- [Capacitor Storage Documentation](https://capacitorjs.com/docs/v3/apis/storage)
- [Capacitor SQLite Community Plugin](https://github.com/capacitor-community/sqlite)
- [Tauri vs Electron 2025 Comparison](https://codeology.co.nz/articles/tauri-vs-electron-2025-desktop-development.html)
- [Electron vs Tauri - DoltHub Blog](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/)
- [Tauri Performance Comparison](https://www.gethopp.app/blog/tauri-vs-electron)
