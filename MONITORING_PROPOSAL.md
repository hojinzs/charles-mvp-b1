# Charles Monitor MVP - 모니터링 제안서

## 📊 모니터링 주 목표

### 1. 서비스 안정성 보장
- 크롤링 서비스의 지속적인 가용성 확보
- 장애 발생 시 신속한 감지 및 대응
- 사용자 경험 저하 사전 방지

### 2. 성능 최적화
- 크롤링 작업의 처리 시간 및 처리량 추적
- 병목 구간 식별 및 개선
- 리소스 사용 최적화

### 3. 비즈니스 인사이트 확보
- 크롤링 성공률 및 실패 원인 분석
- 사용자 활동 패턴 파악
- 데이터 품질 관리

---

## 🎯 모니터링할 주요 지표

### A. 인프라 지표 (Infrastructure Metrics)

#### 1. 애플리케이션 Health
| 지표 | 설명 | 임계값 |
|------|------|--------|
| `app_uptime` | 서비스 가동 시간 | - |
| `app_restart_count` | 재시작 횟수 | 5회/시간 초과 시 알림 |
| `memory_usage` | 메모리 사용량 (MB) | 70% 초과 시 경고 |
| `cpu_usage` | CPU 사용률 (%) | 80% 초과 시 경고 |
| `heap_used` | Heap 메모리 사용량 | 80% 초과 시 경고 |

#### 2. 데이터베이스 성능
| 지표 | 설명 | 임계값 |
|------|------|--------|
| `db_connection_pool_size` | 현재 연결 수 | 최대치의 90% 초과 시 경고 |
| `db_query_duration` | 쿼리 실행 시간 (ms) | 1000ms 초과 시 slow query |
| `db_error_rate` | 데이터베이스 에러 비율 | 5% 초과 시 알림 |

#### 3. Redis 큐 상태
| 지표 | 설명 | 임계값 |
|------|------|--------|
| `redis_connection_status` | Redis 연결 상태 | 0이면 알림 |
| `redis_memory_usage` | Redis 메모리 사용량 | 80% 초과 시 경고 |

### B. 애플리케이션 지표 (Application Metrics)

#### 4. API 성능
| 지표 | 설명 | 임계값 |
|------|------|--------|
| `http_request_total` | HTTP 요청 수 (라벨: method, path, status) | - |
| `http_request_duration` | API 응답 시간 (ms) | p95 > 3000ms 시 경고 |
| `http_request_error_rate` | API 에러 비율 (%) | 5% 초과 시 알림 |
| `websocket_connections` | 활성 WebSocket 연결 수 | - |

#### 5. 크롤링 작업 지표
| 지표 | 설명 | 임계값 |
|------|------|--------|
| `crawl_jobs_total` | 크롤링 작업 수 (라벨: status) | - |
| `crawl_jobs_waiting` | 대기 중인 작업 수 | 100개 초과 시 경고 |
| `crawl_jobs_active` | 실행 중인 작업 수 | - |
| `crawl_jobs_completed` | 완료된 작업 수 | - |
| `crawl_jobs_failed` | 실패한 작업 수 | - |
| `crawl_job_duration` | 크롤링 소요 시간 (ms) | p95 > 30000ms 시 경고 |
| `crawl_success_rate` | 크롤링 성공률 (%) | 90% 미만 시 경고 |
| `crawl_retry_count` | 재시도 횟수 | - |

#### 6. Puppeteer 브라우저 지표
| 지표 | 설명 | 임계값 |
|------|------|--------|
| `browser_instance_count` | 브라우저 인스턴스 수 | 5개 초과 시 경고 (메모리 누수) |
| `browser_page_count` | 열린 페이지 수 | 10개 초과 시 경고 |
| `browser_context_count` | Incognito 컨텍스트 수 | 10개 초과 시 경고 |
| `browser_crash_count` | 브라우저 크래시 횟수 | 1회 이상 시 알림 |

#### 7. 스케줄러 지표
| 지표 | 설명 | 임계값 |
|------|------|--------|
| `scheduler_execution_count` | 스케줄러 실행 횟수 | - |
| `scheduler_keywords_processed` | 처리된 키워드 수 | - |
| `scheduler_last_run_timestamp` | 마지막 실행 시간 | 현재 시간 - 120초 초과 시 알림 |

### C. 비즈니스 지표 (Business Metrics)

#### 8. 키워드 관리
| 지표 | 설명 | 임계값 |
|------|------|--------|
| `keywords_total` | 등록된 총 키워드 수 | - |
| `keywords_active` | 활성 키워드 수 | - |
| `rank_alerts_sent` | 발송된 순위 알림 수 | - |
| `rank_changes_detected` | 순위 변동 감지 수 | - |

#### 9. 데이터 품질
| 지표 | 설명 | 임계값 |
|------|------|--------|
| `rank_null_rate` | 순위를 찾지 못한 비율 (%) | 20% 초과 시 크롤링 로직 점검 |
| `stale_keywords_count` | 24시간 이상 미확인 키워드 수 | 10% 초과 시 스케줄러 점검 |

---

## 🛠️ 모니터링 방안

### 1. 메트릭 수집 도구: Prometheus + Grafana (추천)

#### 선정 이유
- **오픈소스**: 무료, 커뮤니티 활성화
- **Node.js 지원**: `prom-client` 라이브러리 안정성 높음
- **Pull 방식**: 애플리케이션 부담 최소화
- **시각화**: Grafana 대시보드 강력함
- **알림**: Alertmanager 통합
- **Docker 지원**: 기존 docker-compose에 쉽게 추가

#### 아키텍처
```
┌─────────────────┐
│  API Server     │──┐
│  (Express)      │  │
└─────────────────┘  │
                     │
┌─────────────────┐  │   ┌──────────────┐    ┌──────────────┐
│  Worker x2      │──┼──>│  Prometheus  │───>│   Grafana    │
│  (Puppeteer)    │  │   │  (Metrics)   │    │ (Dashboard)  │
└─────────────────┘  │   └──────────────┘    └──────────────┘
                     │          │
┌─────────────────┐  │          │
│  Scheduler      │──┘          v
│  (Cron)         │       ┌──────────────┐
└─────────────────┘       │ Alertmanager │
                          │  (Alerts)    │
                          └──────────────┘
```

### 2. 로깅 개선: Winston 구조화 로깅

#### 현재 문제점
- console.log만 사용 중 (Winston 설치됐지만 미사용)
- 구조화되지 않은 로그
- 로그 레벨 구분 없음
- 중앙 집중식 로그 관리 불가

#### 개선 방안
```typescript
// Winston 로거 설정
// - JSON 형식 (구조화)
// - 타임스탬프 자동 추가
// - 레벨별 색상 구분 (development)
// - 파일 로테이션 (production)
// - 에러 스택 트레이스 포함
```

**로그 레벨 전략:**
- `error`: 즉시 대응 필요 (크롤링 실패, DB 에러)
- `warn`: 주의 필요 (재시도, 임계값 근접)
- `info`: 일반 정보 (작업 완료, 스케줄러 실행)
- `debug`: 디버깅 정보 (상세 크롤링 단계)

### 3. 추적 시스템: OpenTelemetry (선택사항)

분산 추적을 통해 크롤링 작업의 전체 라이프사이클 추적:
```
API Request → Queue Enqueue → Worker Processing → Crawling → DB Save → WebSocket Emit
    1ms           5ms              2000ms          25000ms     10ms        2ms
```

---

## 💻 코드 적용 샘플

### 샘플 1: Prometheus 메트릭 설정

#### `/backend/src/monitoring/metrics.ts` (신규 파일)

```typescript
import client from 'prom-client';

// 기본 메트릭 수집 (CPU, Memory, Event Loop 등)
client.collectDefaultMetrics({ timeout: 5000 });

// === 인프라 메트릭 ===
export const appUptime = new client.Gauge({
  name: 'app_uptime_seconds',
  help: 'Application uptime in seconds',
});

export const memoryUsage = new client.Gauge({
  name: 'app_memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'], // rss, heapTotal, heapUsed, external
});

export const dbConnectionPoolSize = new client.Gauge({
  name: 'db_connection_pool_size',
  help: 'Current number of database connections',
  labelNames: ['state'], // idle, active
});

export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_ms',
  help: 'Database query duration in milliseconds',
  labelNames: ['query_type'], // select, insert, update, delete
  buckets: [10, 50, 100, 300, 500, 1000, 3000, 5000],
});

export const redisConnectionStatus = new client.Gauge({
  name: 'redis_connection_status',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
});

// === API 메트릭 ===
export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'path'],
  buckets: [50, 100, 300, 500, 1000, 3000, 5000, 10000],
});

export const websocketConnections = new client.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
});

// === 크롤링 작업 메트릭 ===
export const crawlJobsTotal = new client.Counter({
  name: 'crawl_jobs_total',
  help: 'Total number of crawl jobs',
  labelNames: ['status'], // completed, failed, retried
});

export const crawlJobsWaiting = new client.Gauge({
  name: 'crawl_jobs_waiting',
  help: 'Number of jobs waiting in queue',
});

export const crawlJobsActive = new client.Gauge({
  name: 'crawl_jobs_active',
  help: 'Number of jobs currently being processed',
});

export const crawlJobDuration = new client.Histogram({
  name: 'crawl_job_duration_ms',
  help: 'Crawl job duration in milliseconds',
  labelNames: ['keyword_id'],
  buckets: [5000, 10000, 15000, 20000, 25000, 30000, 45000, 60000],
});

export const crawlSuccessRate = new client.Gauge({
  name: 'crawl_success_rate',
  help: 'Crawl job success rate (0-1)',
});

export const crawlRetryCount = new client.Counter({
  name: 'crawl_retry_total',
  help: 'Total number of crawl job retries',
  labelNames: ['keyword_id', 'attempt'],
});

// === Puppeteer 브라우저 메트릭 ===
export const browserInstanceCount = new client.Gauge({
  name: 'browser_instance_count',
  help: 'Number of Puppeteer browser instances',
});

export const browserPageCount = new client.Gauge({
  name: 'browser_page_count',
  help: 'Number of open browser pages',
});

export const browserContextCount = new client.Gauge({
  name: 'browser_context_count',
  help: 'Number of browser contexts',
});

export const browserCrashCount = new client.Counter({
  name: 'browser_crash_total',
  help: 'Total number of browser crashes',
});

// === 스케줄러 메트릭 ===
export const schedulerExecutionCount = new client.Counter({
  name: 'scheduler_execution_total',
  help: 'Total number of scheduler executions',
});

export const schedulerKeywordsProcessed = new client.Counter({
  name: 'scheduler_keywords_processed_total',
  help: 'Total number of keywords processed by scheduler',
});

export const schedulerLastRunTimestamp = new client.Gauge({
  name: 'scheduler_last_run_timestamp',
  help: 'Unix timestamp of last scheduler execution',
});

// === 비즈니스 메트릭 ===
export const keywordsTotal = new client.Gauge({
  name: 'keywords_total',
  help: 'Total number of registered keywords',
});

export const rankAlertsTotal = new client.Counter({
  name: 'rank_alerts_total',
  help: 'Total number of rank alerts sent',
  labelNames: ['keyword_id'],
});

export const rankNullRate = new client.Gauge({
  name: 'rank_null_rate',
  help: 'Rate of crawls that did not find ranking (0-1)',
});

// 메트릭 레지스트리 export
export const register = client.register;
```

---

### 샘플 2: API 서버에 Prometheus 엔드포인트 추가

#### `/backend/src/api/server.ts` 수정

```typescript
import express from "express";
import cors from "cors";
import { createServer } from "http";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./swagger";
import keywordsRouter from "./routes/keywords";
import rankingsRouter from "./routes/rankings";
import jobsRouter from "./routes/jobs";
import { pool } from "../db/connection";
import { register, httpRequestTotal, httpRequestDuration } from "../monitoring/metrics";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// === 모니터링 미들웨어 ===
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // HTTP 요청 카운터
    httpRequestTotal.inc({
      method: req.method,
      path: req.route?.path || req.path,
      status: res.statusCode,
    });

    // HTTP 요청 지속 시간
    httpRequestDuration.observe(
      {
        method: req.method,
        path: req.route?.path || req.path,
      },
      duration
    );
  });

  next();
});

// === API 라우트 ===
app.use("/api/keywords", keywordsRouter);
app.use("/api/rankings", rankingsRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// === Health Check ===
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      message: "Database connection failed"
    });
  }
});

// === Prometheus 메트릭 엔드포인트 ===
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// === 서버 시작 ===
const httpServer = createServer(app);

httpServer.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
  console.log(`Metrics available at http://localhost:${PORT}/metrics`);
});

export { app, httpServer };
```

---

### 샘플 3: Worker에서 크롤링 메트릭 수집

#### `/backend/src/worker/processor.ts` 수정

```typescript
import { Job } from "bull";
import { crawlQueue } from "../queue/crawlQueue";
import { crawlSearchResult } from "./crawler";
import { saveRanking } from "../db/queries";
import {
  crawlJobsTotal,
  crawlJobsActive,
  crawlJobDuration,
  crawlRetryCount,
} from "../monitoring/metrics";

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);

crawlQueue.process(CONCURRENCY, async (job: Job) => {
  const startTime = Date.now();
  const { keyword, targetUrl, keywordId } = job.data;

  // 활성 작업 수 증가
  crawlJobsActive.inc();

  try {
    console.log(`[Worker ${process.pid}] Processing job ${job.id}: ${keyword}`);

    // 진행률 10%
    await job.progress(10);

    // 크롤링 실행
    const rank = await crawlSearchResult(keyword, targetUrl);

    // 진행률 80%
    await job.progress(80);

    // 순위 저장
    await saveRanking(keywordId, rank);

    // 진행률 100%
    await job.progress(100);

    const duration = Date.now() - startTime;
    console.log(`[Worker ${process.pid}] Job ${job.id} completed. Rank: ${rank}, Duration: ${duration}ms`);

    // === 메트릭 기록 ===
    crawlJobsTotal.inc({ status: 'completed' });
    crawlJobDuration.observe({ keyword_id: keywordId }, duration);

    // 재시도 횟수 기록
    if (job.attemptsMade > 1) {
      crawlRetryCount.inc({
        keyword_id: keywordId,
        attempt: job.attemptsMade.toString(),
      });
      crawlJobsTotal.inc({ status: 'retried' });
    }

    return { rank, keywordId, keyword };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Worker ${process.pid}] Job ${job.id} failed:`, error);

    // === 실패 메트릭 기록 ===
    crawlJobsTotal.inc({ status: 'failed' });
    crawlJobDuration.observe({ keyword_id: keywordId }, duration);

    throw error;
  } finally {
    // 활성 작업 수 감소
    crawlJobsActive.dec();
  }
});

console.log(`Worker ${process.pid} started with concurrency ${CONCURRENCY}`);
```

---

### 샘플 4: Puppeteer 브라우저 메트릭 추적

#### `/backend/src/worker/crawler.ts` 수정

```typescript
import puppeteer, { Browser, Page } from "puppeteer";
import {
  browserInstanceCount,
  browserPageCount,
  browserContextCount,
  browserCrashCount,
} from "../monitoring/metrics";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    console.log("[Crawler] Launching new browser instance");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // 브라우저 인스턴스 카운트
    browserInstanceCount.inc();

    // 브라우저 크래시 감지
    browser.on('disconnected', () => {
      console.error("[Crawler] Browser crashed or disconnected");
      browserCrashCount.inc();
      browserInstanceCount.dec();
      browser = null;
    });
  }
  return browser;
}

export async function crawlSearchResult(
  keyword: string,
  targetUrl: string
): Promise<number | null> {
  const searchUrl = `https://m.ad.search.naver.com/search.naver?query=${encodeURIComponent(
    keyword
  )}`;

  const browserInstance = await getBrowser();
  const context = await browserInstance.createIncognitoBrowserContext();
  browserContextCount.inc();

  let page: Page | null = null;

  try {
    page = await context.newPage();
    browserPageCount.inc();

    // 모바일 User-Agent 설정
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15"
    );

    console.log(`[Crawler] Navigating to search result for: ${keyword}`);
    await page.goto(searchUrl, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const rank = await page.evaluate((url: string) => {
      const items = document.querySelectorAll("li.list_item");
      for (let i = 0; i < items.length; i++) {
        const titleEl = items[i].querySelector(".tit_area .tit") as HTMLElement;
        const urlEl = items[i].querySelector(".url_link") as HTMLElement;

        if (!titleEl || !urlEl) continue;

        const title = titleEl.innerText || "";
        const displayUrl = urlEl.innerText || "";

        if (displayUrl.includes(url) || title.includes(url)) {
          return i + 1;
        }
      }
      return null;
    }, targetUrl);

    console.log(`[Crawler] Rank for "${keyword}": ${rank}`);
    return rank;
  } catch (error) {
    console.error(`[Crawler] Error crawling keyword "${keyword}":`, error);
    throw error;
  } finally {
    if (page) {
      await page.close();
      browserPageCount.dec();
    }
    await context.close();
    browserContextCount.dec();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browserInstanceCount.dec();
    browser = null;
  }
}
```

---

### 샘플 5: 스케줄러 메트릭 추적

#### `/backend/src/scheduler/index.ts` 수정

```typescript
import cron from "node-cron";
import { getAllKeywords } from "../db/queries";
import { crawlQueue } from "../queue/crawlQueue";
import {
  schedulerExecutionCount,
  schedulerKeywordsProcessed,
  schedulerLastRunTimestamp,
  crawlJobsWaiting,
} from "../monitoring/metrics";

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "* * * * *";
const RECHECK_THRESHOLD_MS = 60000;

console.log(`[Scheduler] Starting with schedule: ${CRON_SCHEDULE}`);

cron.schedule(CRON_SCHEDULE, async () => {
  const executionStart = Date.now();
  console.log(`[Scheduler] Running at ${new Date().toISOString()}`);

  // 스케줄러 실행 카운트
  schedulerExecutionCount.inc();
  schedulerLastRunTimestamp.set(Date.now() / 1000); // Unix timestamp

  try {
    const keywords = await getAllKeywords();
    console.log(`[Scheduler] Found ${keywords.length} keywords to check.`);

    const now = Date.now();
    let enqueuedCount = 0;

    for (const kw of keywords) {
      const lastChecked = kw.last_checked_at
        ? new Date(kw.last_checked_at).getTime()
        : 0;

      if (now - lastChecked < RECHECK_THRESHOLD_MS) {
        continue;
      }

      let shouldEnqueue = false;
      const existingJob = await crawlQueue.getJob(kw.id);

      if (!existingJob) {
        shouldEnqueue = true;
      } else {
        const state = await existingJob.getState();
        if (state === "completed" || state === "failed") {
          shouldEnqueue = true;
        } else if (state === "stuck") {
          console.log(`[Scheduler] Removing stuck job for keyword ${kw.id}`);
          await existingJob.remove();
          shouldEnqueue = true;
        }
      }

      if (shouldEnqueue) {
        await crawlQueue.add(
          {
            keywordId: kw.id,
            keyword: kw.keyword,
            targetUrl: kw.url,
          },
          {
            jobId: kw.id,
            priority: 10,
          }
        );
        enqueuedCount++;
      }
    }

    // 대기 중인 작업 수 업데이트
    const waitingJobs = await crawlQueue.getWaiting();
    crawlJobsWaiting.set(waitingJobs.length);

    // 처리된 키워드 수 기록
    schedulerKeywordsProcessed.inc(enqueuedCount);

    const duration = Date.now() - executionStart;
    console.log(
      `[Scheduler] Enqueued ${enqueuedCount} jobs in ${duration}ms. Waiting: ${waitingJobs.length}`
    );
  } catch (error) {
    console.error("[Scheduler] Error during execution:", error);
  }
});
```

---

### 샘플 6: Winston 구조화 로깅 설정

#### `/backend/src/monitoring/logger.ts` (신규 파일)

```typescript
import winston from "winston";

const isProduction = process.env.NODE_ENV === "production";

// 커스텀 포맷: 타임스탬프 + 레벨 + 메시지 + 메타데이터
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console 출력 포맷 (개발 환경)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaString = Object.keys(meta).length
      ? `\n${JSON.stringify(meta, null, 2)}`
      : "";
    return `${timestamp} [${service || "app"}] ${level}: ${message}${metaString}`;
  })
);

// 로거 생성
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  format: customFormat,
  defaultMeta: { service: "charles-monitor" },
  transports: [
    // Console 출력
    new winston.transports.Console({
      format: isProduction ? customFormat : consoleFormat,
    }),

    // 파일 출력 (production)
    ...(isProduction
      ? [
          // 모든 로그
          new winston.transports.File({
            filename: "logs/combined.log",
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),

          // 에러 로그만
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            maxsize: 10485760,
            maxFiles: 5,
          }),
        ]
      : []),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: "logs/exceptions.log" }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: "logs/rejections.log" }),
  ],
});

// console.log 대체 헬퍼 함수
export const log = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
};
```

#### 사용 예시: `/backend/src/worker/processor.ts`

```typescript
// Before
console.log(`[Worker ${process.pid}] Processing job ${job.id}: ${keyword}`);

// After
import { log } from "../monitoring/logger";

log.info("Processing crawl job", {
  service: "worker",
  workerId: process.pid,
  jobId: job.id,
  keyword,
  keywordId,
  attemptsMade: job.attemptsMade,
});
```

---

### 샘플 7: Docker Compose에 Prometheus & Grafana 추가

#### `/docker-compose.yml` 수정

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: charles_monitor
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: npm run start:api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/charles_monitor
      REDIS_URL: redis://redis:6379
      PORT: 3000
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: npm run start:worker
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/charles_monitor
      REDIS_URL: redis://redis:6379
      WORKER_CONCURRENCY: 2
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
      - api
    deploy:
      replicas: 2  # 워커 2개 인스턴스

  scheduler:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: npm run start:scheduler
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/charles_monitor
      REDIS_URL: redis://redis:6379
      CRON_SCHEDULE: "* * * * *"
      NODE_ENV: production
    depends_on:
      - postgres
      - redis

  # === 모니터링 스택 ===
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--web.console.libraries=/usr/share/prometheus/console_libraries"
      - "--web.console.templates=/usr/share/prometheus/consoles"
    depends_on:
      - api
      - worker
      - scheduler

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: admin
      GF_INSTALL_PLUGINS: grafana-piechart-panel
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    depends_on:
      - prometheus

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    command:
      - "--config.file=/etc/alertmanager/alertmanager.yml"
      - "--storage.path=/alertmanager"
    depends_on:
      - prometheus

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
  alertmanager_data:
```

---

### 샘플 8: Prometheus 설정 파일

#### `/monitoring/prometheus.yml` (신규 파일)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

# Alertmanager 설정
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

# 알림 규칙 파일
rule_files:
  - "/etc/prometheus/alerts.yml"

# 스크랩 대상
scrape_configs:
  # API 서버 메트릭
  - job_name: "api"
    static_configs:
      - targets: ["api:3000"]
    metrics_path: "/metrics"

  # Worker 메트릭 (2개 인스턴스)
  - job_name: "worker"
    static_configs:
      - targets:
          - "worker:3000"  # Docker Compose는 자동으로 로드밸런싱
    metrics_path: "/metrics"

  # Scheduler 메트릭
  - job_name: "scheduler"
    static_configs:
      - targets: ["scheduler:3000"]
    metrics_path: "/metrics"

  # Prometheus 자체 메트릭
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]
```

---

### 샘플 9: Alertmanager 알림 규칙

#### `/monitoring/alerts.yml` (신규 파일)

```yaml
groups:
  - name: charles_monitor_alerts
    interval: 30s
    rules:
      # API 서버 다운
      - alert: APIServerDown
        expr: up{job="api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "API 서버가 다운되었습니다"
          description: "API 서버가 1분 이상 응답하지 않습니다."

      # 크롤링 성공률 저하
      - alert: LowCrawlSuccessRate
        expr: crawl_success_rate < 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "크롤링 성공률이 낮습니다"
          description: "크롤링 성공률이 {{ $value }}% 입니다 (목표: 90%)."

      # 대기 작업 수 과다
      - alert: HighQueueWaiting
        expr: crawl_jobs_waiting > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "대기 중인 크롤링 작업이 많습니다"
          description: "{{ $value }}개의 작업이 대기 중입니다."

      # API 응답 시간 지연
      - alert: SlowAPIResponse
        expr: histogram_quantile(0.95, http_request_duration_ms_bucket) > 3000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API 응답 시간이 느립니다"
          description: "95 백분위 응답 시간이 {{ $value }}ms입니다."

      # 메모리 사용률 높음
      - alert: HighMemoryUsage
        expr: (process_resident_memory_bytes / 1024 / 1024) > 512
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "메모리 사용량이 높습니다"
          description: "메모리 사용량이 {{ $value }}MB입니다."

      # 브라우저 크래시 발생
      - alert: BrowserCrashed
        expr: increase(browser_crash_total[5m]) > 0
        labels:
          severity: critical
        annotations:
          summary: "Puppeteer 브라우저가 크래시했습니다"
          description: "최근 5분간 {{ $value }}회 크래시가 발생했습니다."

      # 스케줄러 실행 지연
      - alert: SchedulerNotRunning
        expr: (time() - scheduler_last_run_timestamp) > 120
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "스케줄러가 실행되지 않고 있습니다"
          description: "마지막 실행 후 {{ $value }}초가 경과했습니다."

      # 데이터베이스 연결 풀 부족
      - alert: DatabaseConnectionPoolExhausted
        expr: db_connection_pool_size{state="active"} > 8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "데이터베이스 연결 풀이 부족합니다"
          description: "활성 연결 수가 {{ $value }}개입니다 (최대: 10)."
```

---

### 샘플 10: Alertmanager 알림 전송 설정

#### `/monitoring/alertmanager.yml` (신규 파일)

```yaml
global:
  resolve_timeout: 5m

# 알림 라우팅
route:
  group_by: ["alertname", "severity"]
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: "default"
  routes:
    - match:
        severity: critical
      receiver: "critical"
      repeat_interval: 1h

    - match:
        severity: warning
      receiver: "warning"
      repeat_interval: 4h

# 알림 수신자 설정
receivers:
  # 기본 수신자 (콘솔 출력)
  - name: "default"
    webhook_configs:
      - url: "http://localhost:5001/webhook"

  # Critical 알림 (슬랙, 이메일 등)
  - name: "critical"
    # Slack 예시
    slack_configs:
      - api_url: "${SLACK_WEBHOOK_URL}"
        channel: "#alerts-critical"
        title: "🚨 Critical Alert"
        text: "{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}\n{{ end }}"

    # Email 예시
    # email_configs:
    #   - to: "team@example.com"
    #     from: "alertmanager@example.com"
    #     smarthost: "smtp.gmail.com:587"
    #     auth_username: "your-email@gmail.com"
    #     auth_password: "${SMTP_PASSWORD}"
    #     headers:
    #       Subject: "Critical Alert: {{ .GroupLabels.alertname }}"

  # Warning 알림
  - name: "warning"
    slack_configs:
      - api_url: "${SLACK_WEBHOOK_URL}"
        channel: "#alerts-warning"
        title: "⚠️ Warning Alert"
        text: "{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}\n{{ end }}"

# 알림 억제 규칙 (중복 방지)
inhibit_rules:
  - source_match:
      severity: "critical"
    target_match:
      severity: "warning"
    equal: ["alertname"]
```

---

## 📈 Grafana 대시보드 예시

### 대시보드 구성

1. **System Overview**
   - CPU, Memory, Disk 사용률
   - API 서버 Uptime
   - Redis & PostgreSQL 연결 상태

2. **API Performance**
   - 요청 수 (QPS)
   - 응답 시간 (p50, p95, p99)
   - 에러율 (4xx, 5xx)
   - WebSocket 연결 수

3. **Crawling Jobs**
   - 작업 상태별 분포 (Waiting, Active, Completed, Failed)
   - 작업 처리 시간 히스토그램
   - 성공률 트렌드
   - 재시도 횟수

4. **Browser Health**
   - 브라우저 인스턴스 수
   - 페이지/컨텍스트 수
   - 크래시 횟수

5. **Business Metrics**
   - 등록된 키워드 수
   - 순위 알림 발송 수
   - 순위 변동 감지 수
   - Null 순위 비율

---

## 🚀 구현 로드맵

### Phase 1: 기본 모니터링 (1-2일)
- [ ] Prometheus 메트릭 라이브러리 설치 (`prom-client`)
- [ ] 기본 메트릭 수집 코드 작성
- [ ] API `/metrics` 엔드포인트 추가
- [ ] Winston 로거 설정 및 console.log 교체

### Phase 2: 인프라 설정 (1일)
- [ ] Docker Compose에 Prometheus, Grafana 추가
- [ ] Prometheus 스크랩 설정
- [ ] Grafana 데이터소스 연결

### Phase 3: 대시보드 & 알림 (1-2일)
- [ ] Grafana 대시보드 생성
- [ ] Alertmanager 알림 규칙 작성
- [ ] Slack/Email 알림 연동 테스트

### Phase 4: 고도화 (선택사항)
- [ ] OpenTelemetry 분산 추적 추가
- [ ] ELK Stack 로그 집계 (Elasticsearch, Logstash, Kibana)
- [ ] APM 도구 연동 (New Relic, Datadog 등)

---

## 📚 참고 자료

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [prom-client GitHub](https://github.com/siimon/prom-client)
- [Winston Documentation](https://github.com/winstonjs/winston)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)

---

## 💡 추가 권장사항

### 1. 로그 집계 (향후 고려)
MVP 단계에서는 Winston 파일 로깅으로 충분하지만, 서비스 확장 시 ELK Stack 또는 Loki 도입을 권장합니다.

### 2. APM (Application Performance Monitoring)
프로덕션 환경에서는 New Relic, Datadog 같은 APM 도구를 통해:
- 자동 에러 추적
- 트랜잭션 추적
- 성능 병목 분석

### 3. 비용 고려사항
- Prometheus + Grafana: 오픈소스 (무료)
- Grafana Cloud: 무료 티어 제공 (50GB logs, 10k series)
- Self-hosted 비용: 서버 리소스만 필요

### 4. 보안
- Grafana 기본 패스워드 변경 필수
- Prometheus `/metrics` 엔드포인트 접근 제한 (IP 화이트리스트)
- Alertmanager Webhook URL 환경 변수 사용

---

**작성일:** 2025-12-27
**버전:** 1.0
**작성자:** Claude (Anthropic)
