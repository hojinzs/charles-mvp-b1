# Hybrid EC2 + ECS Auto-Scaling Architecture

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                      VPC (10.0.0.0/16)                       │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │           Public Subnet (10.0.1.0/24)                  │  │
│  │                                                         │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │         EC2 Instance (t3.large)                  │  │  │
│  │  │         Elastic IP: xxx.xxx.xxx.xxx              │  │  │
│  │  │                                                   │  │  │
│  │  │  Docker Compose Services:                        │  │  │
│  │  │  ┌──────────────────────────────────────────┐   │  │  │
│  │  │  │ API Server (Port 3000)                   │   │  │  │
│  │  │  │ - Express REST API                       │   │  │  │
│  │  │  │ - WebSocket (실시간 알림)                │   │  │  │
│  │  │  │ - /metrics 엔드포인트                    │   │  │  │
│  │  │  └──────────────────────────────────────────┘   │  │  │
│  │  │                                                   │  │  │
│  │  │  ┌──────────────────────────────────────────┐   │  │  │
│  │  │  │ Scheduler (Port 3002)                    │   │  │  │
│  │  │  │ - Cron 기반 작업 스케줄링               │   │  │  │
│  │  │  │ - 키워드 자동 큐잉                       │   │  │  │
│  │  │  └──────────────────────────────────────────┘   │  │  │
│  │  │                                                   │  │  │
│  │  │  ┌──────────────────────────────────────────┐   │  │  │
│  │  │  │ Redis (Port 6379)                        │   │  │  │
│  │  │  │ - Bull Queue Storage                     │   │  │  │
│  │  │  │ - Security Group: ECS에서 접근 허용      │   │  │  │
│  │  │  └──────────────────────────────────────────┘   │  │  │
│  │  │                                                   │  │  │
│  │  │  ┌──────────────────────────────────────────┐   │  │  │
│  │  │  │ PostgreSQL (Port 5432)                   │   │  │  │
│  │  │  │ - 크롤링 결과 저장                       │   │  │  │
│  │  │  │ - 키워드 관리                            │   │  │  │
│  │  │  └──────────────────────────────────────────┘   │  │  │
│  │  │                                                   │  │  │
│  │  │  ┌──────────────────────────────────────────┐   │  │  │
│  │  │  │ Base Workers (1-2개, 고정)               │   │  │  │
│  │  │  │ - WORKER_CONCURRENCY=2                   │   │  │  │
│  │  │  │ - 최소 처리량 보장                       │   │  │  │
│  │  │  └──────────────────────────────────────────┘   │  │  │
│  │  │                                                   │  │  │
│  │  │  ┌──────────────────────────────────────────┐   │  │  │
│  │  │  │ CloudWatch Agent                         │   │  │  │
│  │  │  │ - Queue 메트릭 수집 (매 1분)            │   │  │  │
│  │  │  │ - ECS Auto Scaling 트리거               │   │  │  │
│  │  │  └──────────────────────────────────────────┘   │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │      Private Subnet (10.0.2.0/24) - ECS Only          │  │
│  │                                                         │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │       ECS Cluster: crawler-workers               │  │  │
│  │  │                                                   │  │  │
│  │  │  ┌────────────────────────────────────────────┐  │  │  │
│  │  │  │  ECS Service: crawler-worker-service       │  │  │  │
│  │  │  │                                             │  │  │  │
│  │  │  │  Launch Type: FARGATE                      │  │  │  │
│  │  │  │  Task Definition: crawler-worker:latest    │  │  │  │
│  │  │  │                                             │  │  │  │
│  │  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │  │  │
│  │  │  │  │Worker 3  │ │Worker 4  │ │Worker N  │  │  │  │  │
│  │  │  │  │(동적 생성)│ │(동적 생성)│ │(동적)    │  │  │  │  │
│  │  │  │  └──────────┘ └──────────┘ └──────────┘  │  │  │  │
│  │  │  │                                             │  │  │  │
│  │  │  │  Desired Count: 0 (초기)                  │  │  │  │
│  │  │  │  Min: 0, Max: 50                          │  │  │  │
│  │  │  │  CPU: 1 vCPU, Memory: 2GB                 │  │  │  │
│  │  │  │                                             │  │  │  │
│  │  │  │  Command: ["--process=worker"]             │  │  │  │
│  │  │  │  WORKER_CONCURRENCY: 4 (EC2보다 높게)     │  │  │  │
│  │  │  └────────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              NAT Gateway (10.0.1.x)                    │  │
│  │  - ECS 워커가 인터넷 접근 (Puppeteer 크롤링용)        │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   CloudWatch (모니터링)                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Metric: CrawlerService/QueueWaitingJobs            │   │
│  │  - API에서 1분마다 퍼블리시                          │   │
│  │  - Namespace: CrawlerService                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Auto Scaling Policy (Target Tracking)               │   │
│  │  - Target: QueueWaitingJobs < 20                     │   │
│  │  - Scale Up: 대기 작업 > 20 → Worker +1             │   │
│  │  - Scale Down: 대기 작업 < 10 → Worker -1           │   │
│  │  - Cooldown: Scale Up 60s, Scale Down 300s          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 컴포넌트 역할

### EC2 Instance (고정 인프라)

| 컴포넌트 | 역할 | 항상 떠있는 이유 |
|---------|------|----------------|
| **API Server** | REST API + WebSocket | 클라이언트가 항상 접근해야 함 |
| **Scheduler** | Cron 작업 스케줄링 | 정해진 시간에 작업 큐잉 |
| **PostgreSQL** | 데이터 영속성 | DB는 항상 접근 가능해야 함 |
| **Redis** | Queue 저장소 | 워커들이 항상 접근해야 함 |
| **Base Workers** | 최소 처리량 보장 | 작업이 적어도 빠르게 처리 |
| **CloudWatch Agent** | 메트릭 수집 | ECS Auto Scaling 트리거 |

### ECS Fargate (동적 스케일링)

| 속성 | 값 | 이유 |
|-----|-----|------|
| **Min Tasks** | 0 | 작업 없을 때 비용 $0 |
| **Max Tasks** | 50 | 대량 크롤링 대응 |
| **vCPU** | 1 vCPU | Puppeteer 브라우저 실행 |
| **Memory** | 2 GB | Chrome 메모리 요구사항 |
| **Concurrency** | 4 | EC2보다 높게 (리소스 충분) |
| **Launch Type** | Fargate | 서버리스 (인프라 관리 불필요) |

---

## Auto Scaling 정책

### Metric-Based Scaling

**메트릭**: `CrawlerService/QueueWaitingJobs`

**수집 방법**:
```typescript
// API 서버에서 1분마다 실행
setInterval(async () => {
  const counts = await crawlQueue.getJobCounts();

  await cloudwatch.putMetricData({
    Namespace: 'CrawlerService',
    MetricData: [{
      MetricName: 'QueueWaitingJobs',
      Value: counts.waiting + counts.active,
      Unit: 'Count',
    }],
  }).promise();
}, 60000);
```

**스케일링 규칙**:

| 조건 | 동작 | Cooldown |
|------|------|----------|
| Queue > 20 jobs | Worker +1 | 60초 |
| Queue < 10 jobs | Worker -1 | 300초 (5분) |
| Queue > 200 jobs | Worker +10 (급증) | 30초 |
| Queue = 0 | Worker → 0 | 600초 (10분) |

**Target Tracking 설정**:
```json
{
  "TargetValue": 20.0,
  "PredefinedMetricType": "CustomMetric",
  "CustomizedMetricSpecification": {
    "MetricName": "QueueWaitingJobs",
    "Namespace": "CrawlerService",
    "Statistic": "Average",
    "Dimensions": []
  },
  "ScaleInCooldown": 300,
  "ScaleOutCooldown": 60
}
```

---

## 네트워크 설정

### Security Groups

**EC2 Security Group** (`sg-ec2-crawler`):
```
Inbound:
  - Port 3000: 0.0.0.0/0 (API 접근)
  - Port 22: YOUR_IP/32 (SSH)

Outbound:
  - All Traffic: 0.0.0.0/0
```

**ECS Security Group** (`sg-ecs-worker`):
```
Inbound:
  - 없음 (워커는 인바운드 불필요)

Outbound:
  - Port 6379: sg-ec2-crawler (Redis)
  - Port 5432: sg-ec2-crawler (PostgreSQL)
  - Port 443: 0.0.0.0/0 (크롤링 대상 사이트)
```

**Redis/PostgreSQL**: EC2 내부에서만 접근 가능
```
Inbound:
  - Port 6379: sg-ec2-crawler, sg-ecs-worker
  - Port 5432: sg-ec2-crawler, sg-ecs-worker
```

---

## 비용 분석

### EC2 고정 비용 (t3.large, Seoul Region)

| 항목 | 사양 | 월 비용 |
|------|------|---------|
| EC2 Instance | t3.large (2 vCPU, 8GB) | ~$60 |
| Elastic IP | 1개 | $3.6 |
| EBS Volume | 50 GB gp3 | $5 |
| Data Transfer | 100 GB/월 | $9 |
| **Total** | | **~$77/월** |

### ECS Fargate 변동 비용 (사용량 기반)

**시나리오 1: 평상시 (Queue < 20)**
- ECS Tasks: 0개
- **월 비용**: $0

**시나리오 2: 중간 부하 (Queue 50-100)**
- ECS Tasks: 평균 5개
- 실행 시간: 하루 4시간 × 30일 = 120시간
- 비용: 5 tasks × $0.05/시간 × 120시간 = **$30/월**

**시나리오 3: 고부하 (Queue 500+)**
- ECS Tasks: 평균 25개
- 실행 시간: 하루 8시간 × 30일 = 240시간
- 비용: 25 tasks × $0.05/시간 × 240시간 = **$300/월**

**CloudWatch 비용**:
- Custom Metrics: 1개 × $0.30 = $0.30/월
- API Requests: 1,440 requests/일 × $0.01/1000 = $0.43/월

**총 예상 비용**:
- 최소 (평상시): $77 + $0 = **$77/월**
- 중간: $77 + $30 = **$107/월**
- 최대: $77 + $300 = **$377/월**

---

## 배포 프로세스

### 1. EC2 초기 설정

```bash
# Docker 설치
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# CloudWatch Agent 설치
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U ./amazon-cloudwatch-agent.rpm

# 프로젝트 클론
git clone https://github.com/your-org/charles-mvp-b1.git
cd charles-mvp-b1

# 환경 변수 설정
cp .env.example .env
vi .env  # 실제 값 입력

# EC2용 Docker Compose 실행
docker-compose -f docker-compose.ec2.yaml up -d
```

### 2. ECR에 워커 이미지 푸시

```bash
# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com

# 이미지 빌드 및 푸시
cd backend
docker build -t crawler-worker .
docker tag crawler-worker:latest <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/crawler-worker:latest
docker push <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/crawler-worker:latest
```

### 3. ECS Cluster 및 Service 생성

```bash
# Terraform으로 인프라 프로비저닝
cd infrastructure/terraform
terraform init
terraform plan
terraform apply

# 또는 AWS CLI로 수동 생성
aws ecs create-cluster --cluster-name crawler-workers

aws ecs register-task-definition --cli-input-json file://ecs/task-definition.json

aws ecs create-service --cli-input-json file://ecs/service.json

# Auto Scaling 설정
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/crawler-workers/crawler-worker-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 0 \
  --max-capacity 50

aws application-autoscaling put-scaling-policy \
  --cli-input-json file://cloudwatch/autoscaling.json
```

### 4. 모니터링 대시보드 설정

```bash
# CloudWatch Dashboard 생성
aws cloudwatch put-dashboard \
  --dashboard-name CrawlerMonitoring \
  --dashboard-body file://cloudwatch/dashboard.json
```

---

## 모니터링 지표

### 주요 메트릭

| 메트릭 | 임계값 | 알림 |
|--------|--------|------|
| **Queue Waiting Jobs** | > 100 | Warning |
| **Queue Waiting Jobs** | > 500 | Critical |
| **ECS Running Tasks** | > 40 | Warning (비용 주의) |
| **EC2 CPU Usage** | > 80% | Warning |
| **Redis Memory** | > 80% | Critical |
| **Worker Error Rate** | > 10% | Warning |

### CloudWatch Alarms

```bash
# Queue 과부하 알림
aws cloudwatch put-metric-alarm \
  --alarm-name crawler-queue-high \
  --metric-name QueueWaitingJobs \
  --namespace CrawlerService \
  --statistic Average \
  --period 300 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:ap-northeast-2:123456789012:crawler-alerts

# ECS 비용 주의 알림
aws cloudwatch put-metric-alarm \
  --alarm-name crawler-ecs-high-cost \
  --metric-name RunningTasksCount \
  --namespace ECS/ContainerInsights \
  --statistic Average \
  --period 3600 \
  --threshold 40 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ap-northeast-2:123456789012:cost-alerts
```

---

## 장애 대응

### 시나리오 1: EC2 인스턴스 장애

**증상**: API 접근 불가, 전체 시스템 다운

**대응**:
1. Auto Scaling Group 사용 (권장)
   - EC2를 ASG에 넣어 자동 복구
   - Health Check 실패 시 자동 재시작
2. 수동 복구
   ```bash
   aws ec2 reboot-instances --instance-ids i-xxxxx
   ```

### 시나리오 2: ECS 워커 무한 증가

**증상**: Queue가 줄지 않고 워커만 계속 증가

**원인**: 크롤링 실패율 높음 → 재시도 반복

**대응**:
1. 즉시 Max Tasks 줄이기
   ```bash
   aws application-autoscaling register-scalable-target \
     --resource-id service/crawler-workers/crawler-worker-service \
     --max-capacity 10
   ```
2. Failed Jobs 확인
   ```bash
   curl http://EC2_IP:3000/api/jobs/queue
   ```
3. 실패 원인 분석 후 Queue 정리

### 시나리오 3: Redis 메모리 부족

**증상**: Queue 작업 추가 실패

**대응**:
1. Failed/Completed Jobs 정리
   ```bash
   docker exec -it redis redis-cli
   KEYS "bull:crawl-jobs:*"
   # 오래된 작업 수동 삭제
   ```
2. Redis maxmemory 정책 변경
   ```bash
   CONFIG SET maxmemory-policy allkeys-lru
   ```

---

## 추가 최적화 방안

### 1. RDS로 PostgreSQL 이전
- EC2 부하 감소
- 자동 백업 및 Multi-AZ 가용성

### 2. ElastiCache Redis 사용
- 관리형 서비스로 안정성 향상
- Redis Cluster 모드로 확장성 증대

### 3. CloudFront CDN 추가
- API 응답 캐싱
- 글로벌 latency 개선

### 4. Step Functions 통합
- 복잡한 크롤링 워크플로우 관리
- 재시도 로직 자동화

---

## 다음 단계

1. ✅ 아키텍처 설계 문서 작성 (현재 문서)
2. ⏳ Terraform 코드 작성
3. ⏳ ECS Task Definition 및 Service 설정
4. ⏳ CloudWatch 메트릭 퍼블리셔 구현
5. ⏳ 배포 스크립트 작성
6. ⏳ 모니터링 대시보드 구성
7. ⏳ 부하 테스트 및 튜닝
