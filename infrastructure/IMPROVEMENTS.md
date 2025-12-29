# 아키텍처 개선사항

제안받은 두 가지 개선 사항을 구현했습니다.

---

## 📌 개선 1: CloudWatch 메트릭 전송 전용 서비스 분리

### 문제점
- Scheduler에 CloudWatch 메트릭 퍼블리셔가 통합되어 있어 관심사가 혼재
- Scheduler의 책임이 과도하게 많음 (스케줄링 + 메트릭 수집)

### 해결책
**별도의 `metric-publisher` 서비스 생성**

```yaml
# docker-compose.ec2.yaml
services:
  metric-publisher:
    build: ./backend
    command: ["--process=metric-publisher"]
    environment:
      - CLOUDWATCH_METRICS_ENABLED=true
      - AWS_REGION=ap-northeast-2
      - METRIC_PUBLISH_INTERVAL_MS=60000
```

### 장점
✅ **관심사 분리 (Separation of Concerns)**
- Scheduler: 크론 기반 작업 스케줄링만 담당
- Metric Publisher: Queue 메트릭 수집 및 CloudWatch 전송만 담당

✅ **독립적인 재시작 가능**
- 메트릭 수집이 실패해도 Scheduler에 영향 없음
- 각 서비스를 독립적으로 스케일링 가능

✅ **설정 분리**
- 메트릭 수집 주기를 독립적으로 조정 가능 (`METRIC_PUBLISH_INTERVAL_MS`)
- Scheduler 설정(`SCHEDULER_CRON`)과 분리

✅ **경량 서비스**
- Redis만 의존하며 Database 연결 불필요
- 리소스 사용량 최소화

### 구현 파일
- `backend/src/cloudwatch/metric-publisher.ts` - 전용 메트릭 퍼블리셔
- `backend/src/index.ts` - `metric-publisher` 프로세스 타입 추가
- `docker-compose.ec2.yaml` - 별도 서비스로 실행

---

## 📌 개선 2: ECS 워커의 Prometheus 메트릭 수집 문제 해결

### 문제점
**Prometheus의 Pull 모델 vs ECS의 동적 특성**

1. Prometheus는 HTTP `/metrics` 엔드포인트를 스크래핑하는 **Pull 모델**
2. ECS Fargate는 Private Subnet에서 동적으로 생성/삭제됨
3. Prometheus가 ECS 워커들의 IP를 알 수 없음
4. 결과: ECS 워커의 메트릭 수집 불가능

### 해결책
**Push 모델로 전환: 각 워커가 CloudWatch에 직접 메트릭 전송**

```
┌─────────────────────────────────────────┐
│            EC2 Instance                  │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ API (/metrics)                   │   │
│  │ - Base Workers 메트릭만          │◄──┼─── Prometheus 스크래핑
│  └──────────────────────────────────┘   │    (EC2만)
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ Metric Publisher                 │   │
│  │ - Queue 메트릭 → CloudWatch      │───┼───┐
│  └──────────────────────────────────┘   │   │
└─────────────────────────────────────────┘   │
                                              ▼
┌─────────────────────────────────────────┐   CloudWatch
│         ECS Fargate Workers              │   - Queue 메트릭
│                                          │   - Worker 메트릭
│  각 워커가 독립적으로 CloudWatch에 Push  │   - 전체 시스템 통합
│  - Job Duration                          │
│  - Jobs Completed                        │
│  - Error Rate                            │
│  - Worker Heartbeat                      │
└─────────────────────────────────────────┘
```

### 구현 세부사항

#### 1. Worker 메트릭 CloudWatch 전송

```typescript
// backend/src/cloudwatch/worker-metrics.ts
export async function publishWorkerJobComplete(
  success: boolean,
  method: "axios" | "puppeteer",
  durationSeconds: number
)

export async function publishWorkerError(
  errorType: string,
  errorMessage: string
)

export async function publishWorkerHeartbeat()
```

#### 2. Worker에 통합

```typescript
// backend/src/worker/processor.ts
export const startProcessor = () => {
  // CloudWatch Heartbeat 시작 (5분마다)
  startWorkerMetrics();

  crawlQueue.process(concurrency, async (job) => {
    // 작업 완료 시
    await publishWorkerJobComplete(true, method, duration);

    // 작업 실패 시
    await publishWorkerError(errorType, errorMessage);
  });
}
```

#### 3. ECS Task Definition에 환경변수 추가

```json
{
  "environment": [
    {
      "name": "CLOUDWATCH_METRICS_ENABLED",
      "value": "true"
    },
    {
      "name": "AWS_REGION",
      "value": "ap-northeast-2"
    }
  ]
}
```

#### 4. IAM 권한 추가

```hcl
# Terraform: infrastructure/terraform/main.tf
resource "aws_iam_role_policy" "worker_cloudwatch_metrics" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = ["cloudwatch:PutMetricData"]
      Resource = "*"
      Condition = {
        StringEquals = {
          "cloudwatch:namespace" = "CrawlerService"
        }
      }
    }]
  })
}
```

### CloudWatch 메트릭 통합

| 메트릭 이름 | 타입 | 수집 위치 | 설명 |
|-----------|------|----------|------|
| **QueueWaitingJobs** | Gauge | Metric Publisher | 대기 중인 작업 수 (Auto Scaling 트리거) |
| **QueueActiveJobs** | Gauge | Metric Publisher | 실행 중인 작업 수 |
| **QueueFailedJobs** | Gauge | Metric Publisher | 실패한 작업 수 |
| **WorkerJobDuration** | Histogram | ECS/EC2 Workers | 작업 처리 시간 (Dimension: WorkerId, Status, Method) |
| **WorkerJobsCompleted** | Counter | ECS/EC2 Workers | 완료된 작업 수 (Dimension: WorkerId, Status) |
| **WorkerErrors** | Counter | ECS/EC2 Workers | 에러 발생 수 (Dimension: WorkerId, ErrorType) |
| **WorkerHeartbeat** | Counter | ECS/EC2 Workers | 워커 헬스 체크 (5분마다) |

### 장점

✅ **동적 스케일링 환경에 적합**
- ECS 워커가 생성되면 자동으로 메트릭 전송 시작
- IP나 Service Discovery 설정 불필요

✅ **통합 모니터링**
- CloudWatch에서 EC2 + ECS 워커 메트릭을 한 곳에서 확인
- 워커별 성능 비교 가능 (Dimension: WorkerId)

✅ **서버리스 친화적**
- Fargate의 철학에 부합 (인프라 관리 불필요)
- 워커가 자체적으로 메트릭 관리

✅ **이원화된 메트릭 수집**
- **Prometheus**: EC2 Base Workers + Queue 메트릭 (실시간 대시보드)
- **CloudWatch**: 전체 시스템 메트릭 (Auto Scaling + 장기 저장)

### 비용 영향

**CloudWatch 메트릭 비용:**
- Custom Metrics: $0.30/metric/월
- API Requests: $0.01/1,000 requests

**예상 비용 (50 워커 최대):**
- Queue 메트릭: 6개 × $0.30 = $1.8/월
- Worker 메트릭: 4개 × 50 워커 × $0.30 = $60/월 (최대)
- API Requests: 무시할 수준 (< $1/월)

**총 예상 비용:** $5-10/월 (평균 10 워커 기준)

---

## 📊 Prometheus vs CloudWatch 비교

| 항목 | Prometheus | CloudWatch |
|------|-----------|-----------|
| **수집 방식** | Pull (스크래핑) | Push (API 전송) |
| **수집 대상** | EC2 Base Workers | EC2 + ECS Workers |
| **용도** | 실시간 대시보드, 디버깅 | Auto Scaling, 장기 저장 |
| **보존 기간** | 15일 (기본) | 15개월 (무제한 가능) |
| **비용** | Self-hosted (무료) | 사용량 기반 과금 |
| **동적 스케일링** | ❌ Service Discovery 필요 | ✅ 워커가 자동 전송 |
| **AWS 통합** | ❌ 별도 연동 필요 | ✅ 네이티브 지원 |

### 권장 사용 패턴

1. **개발 환경**: Prometheus만 사용 (비용 절감)
   ```bash
   CLOUDWATCH_METRICS_ENABLED=false
   ```

2. **프로덕션 환경**: 둘 다 사용
   - Prometheus: 실시간 모니터링 + Grafana 대시보드
   - CloudWatch: Auto Scaling + 알림 + 장기 분석

---

## 🎯 구현 파일 목록

### 신규 파일
- `backend/src/cloudwatch/metric-publisher.ts` - Queue 메트릭 전용 퍼블리셔
- `backend/src/cloudwatch/worker-metrics.ts` - Worker 메트릭 전송 유틸리티

### 수정 파일
- `backend/src/index.ts` - `metric-publisher` 프로세스 타입 추가
- `backend/src/scheduler/scheduler.ts` - CloudWatch 메트릭 퍼블리셔 제거 (본래 역할로 복귀)
- `backend/src/worker/processor.ts` - CloudWatch 메트릭 전송 통합
- `docker-compose.ec2.yaml` - `metric-publisher` 서비스 추가
- `infrastructure/ecs/task-definition.json` - CloudWatch 환경변수 추가
- `infrastructure/terraform/main.tf` - CloudWatch 메트릭 퍼블리시 권한 추가

---

## 🚀 배포 영향

### 신규 배포 시

```bash
# 1. npm install (변경 없음, 기존에 @aws-sdk/client-cloudwatch 이미 추가됨)
cd backend
npm install

# 2. EC2에 배포 (metric-publisher 서비스 자동 시작)
docker-compose -f docker-compose.ec2.yaml up -d

# 3. ECS 재배포 (새 Task Definition)
cd ../infrastructure/scripts
./deploy.sh build
./deploy.sh update-task
```

### 기존 시스템 영향

- ✅ **무중단 업그레이드 가능**: 기존 서비스와 독립적
- ✅ **후방 호환성 유지**: `CLOUDWATCH_METRICS_ENABLED=false`로 비활성화 가능
- ✅ **점진적 롤아웃 가능**: Metric Publisher만 먼저 배포 후 ECS 워커 배포

---

## 📈 모니터링 개선

### CloudWatch Dashboard 추가 위젯

```json
{
  "type": "metric",
  "properties": {
    "metrics": [
      ["CrawlerService", "WorkerJobDuration", { "stat": "Average" }],
      [".", ".", { "stat": "p99" }]
    ],
    "title": "워커 작업 처리 시간 (전체)",
    "period": 60
  }
}
```

### CloudWatch Insights 쿼리

```sql
-- 워커별 성능 비교
SELECT WorkerId, AVG(WorkerJobDuration) as avg_duration
FROM CrawlerService
WHERE MetricName = 'WorkerJobDuration'
GROUP BY WorkerId
ORDER BY avg_duration DESC
LIMIT 10
```

---

## 🎯 결론

두 가지 개선 사항으로:
1. ✅ **관심사 분리**: 각 서비스가 명확한 책임을 가짐
2. ✅ **동적 스케일링 대응**: ECS 워커 메트릭 수집 가능
3. ✅ **통합 모니터링**: CloudWatch에서 전체 시스템 메트릭 확인
4. ✅ **유연한 아키텍처**: Prometheus와 CloudWatch를 상황에 맞게 선택 가능

**다음 단계:**
- Grafana 대시보드 구축 (Prometheus + CloudWatch 통합)
- CloudWatch Alarms 추가 설정
- 워커별 성능 분석 자동화
