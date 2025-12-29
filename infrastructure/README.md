# Hybrid EC2 + ECS Infrastructure

크롤링 시스템을 위한 하이브리드 클라우드 인프라 설정 및 배포 가이드입니다.

## 📁 파일 구조

```
infrastructure/
├── ARCHITECTURE.md              # 아키텍처 설계 문서
├── DEPLOYMENT.md                # 상세 배포 가이드
├── README.md                    # 이 파일
├── ecs/
│   ├── task-definition.json    # ECS Task Definition
│   └── service.json             # ECS Service 설정
├── cloudwatch/
│   ├── autoscaling-policy.json # Auto Scaling 정책
│   └── dashboard.json           # CloudWatch 대시보드
├── terraform/
│   ├── main.tf                  # Terraform 메인 파일
│   └── terraform.tfvars.example # 변수 예시
└── scripts/
    └── deploy.sh                # 자동 배포 스크립트
```

## 🏗️ 아키텍처 개요

### EC2 (고정 인프라)
- **API Server**: Express REST API + WebSocket
- **Scheduler**: Cron 기반 작업 스케줄링
- **PostgreSQL**: 데이터 저장
- **Redis**: Queue 관리
- **Base Workers**: 최소 2개 (항상 실행)

### ECS Fargate (동적 스케일링)
- **Worker Tasks**: 큐 크기에 따라 자동 증감
- **Min**: 0개 (작업 없을 때)
- **Max**: 50개 (대량 크롤링 시)
- **비용**: 사용한 만큼만 과금

## 🚀 빠른 시작

### 1. 사전 준비

```bash
# AWS CLI 설정
aws configure

# 필요한 도구 설치 확인
docker --version
terraform --version
```

### 2. ECR 레포지토리 생성

```bash
cd infrastructure/scripts
./deploy.sh ecr
```

### 3. Docker 이미지 빌드 및 푸시

```bash
./deploy.sh build
```

### 4. Secrets Manager에 환경 변수 저장

```bash
# backend/.env 파일 먼저 생성
./deploy.sh secrets
```

### 5. Terraform으로 인프라 배포

```bash
# terraform.tfvars 파일 먼저 생성
cd ../terraform
cp terraform.tfvars.example terraform.tfvars
vi terraform.tfvars  # 변수 입력

# 배포 실행
cd ../scripts
./deploy.sh terraform
```

### 6. 상태 확인

```bash
./deploy.sh status
```

## 📊 모니터링

### CloudWatch Dashboard

Terraform 배포 후 출력되는 URL로 접속:

```bash
terraform output cloudwatch_dashboard_url
```

### 실시간 로그 확인

```bash
./deploy.sh logs
```

### 주요 메트릭

| 메트릭 | 설명 | 임계값 |
|--------|------|--------|
| `QueueWaitingJobs` | 대기 중인 작업 수 | > 20 (Scale Up) |
| `RunningTasksCount` | 실행 중인 ECS 워커 | < 40 (비용 주의) |
| `JobDurationSeconds` | 작업 처리 시간 | < 60초 (정상) |

## 🔧 운영 명령어

### ECS 수동 스케일링

```bash
./deploy.sh scale
# Desired task count 입력: 10
```

### Task Definition 업데이트

```bash
# 코드 변경 후 새 이미지 빌드
./deploy.sh build

# Task Definition 업데이트 및 재배포
./deploy.sh update-task
```

### 시스템 상태 확인

```bash
./deploy.sh status
```

### 로그 확인

```bash
./deploy.sh logs
```

## 💰 비용 예상

### 월 예상 비용 (서울 리전)

| 항목 | 사양 | 월 비용 (USD) |
|------|------|--------------|
| **EC2 (t3.large)** | 2 vCPU, 8GB | $60 |
| **EBS (50GB gp3)** | 50GB | $5 |
| **Elastic IP** | 1개 | $3.6 |
| **NAT Gateway** | 1개 | $32 |
| **Data Transfer** | 100GB/월 | $9 |
| **ECS Fargate (평균 5 tasks, 4시간/일)** | 1 vCPU, 2GB | $30 |
| **CloudWatch** | Metrics + Logs | $5 |
| **총계** | | **~$144/월** |

**비용 최적화 팁:**
- 평상시 Queue가 비어있으면 ECS 비용 $0
- EC2 Reserved Instance 구매 시 30% 할인
- Fargate Spot 사용 시 70% 할인

## 🛡️ 보안 설정

### Security Groups

**EC2 Security Group:**
```
Inbound:
  - SSH (22): YOUR_IP/32
  - HTTP (3000): 0.0.0.0/0 (또는 특정 IP)
  - Redis (6379): ECS SG
  - PostgreSQL (5432): ECS SG

Outbound:
  - All Traffic
```

**ECS Security Group:**
```
Inbound:
  - 없음

Outbound:
  - Redis (6379): EC2 SG
  - PostgreSQL (5432): EC2 SG
  - HTTPS (443): 0.0.0.0/0 (크롤링용)
```

### Secrets Manager

민감한 정보는 Secrets Manager에 저장:
- `crawler/database-url`
- `crawler/redis-url`
- `crawler/proxy-user`
- `crawler/proxy-pass`

## 🔄 CI/CD 파이프라인 (향후)

```yaml
# .github/workflows/deploy.yml
name: Deploy to ECS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and push Docker image
        run: |
          infrastructure/scripts/deploy.sh build
      - name: Update ECS task
        run: |
          infrastructure/scripts/deploy.sh update-task
```

## 📚 참고 문서

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 상세 아키텍처 설계
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 단계별 배포 가이드
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/intro.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

## ❓ Troubleshooting

### ECS 워커가 시작되지 않음

**원인**: Secrets Manager 접근 권한 부족

**해결**:
```bash
# IAM Role 확인
aws iam get-role --role-name crawler-ecsTaskExecutionRole
```

### CloudWatch 메트릭이 보이지 않음

**원인**: EC2에서 메트릭 퍼블리시 실패

**해결**:
```bash
# EC2 로그 확인
ssh ec2-user@EC2_IP
docker-compose -f docker-compose.ec2.yaml logs scheduler
```

### Auto Scaling이 동작하지 않음

**원인**: CloudWatch 메트릭 데이터 부족

**해결**:
```bash
# 메트릭 확인
aws cloudwatch get-metric-statistics \
  --namespace CrawlerService \
  --metric-name QueueWaitingJobs \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

## 🧹 인프라 제거

**⚠️ 주의**: 모든 리소스가 삭제됩니다!

```bash
./deploy.sh destroy
```

## 🤝 기여

이슈 및 PR은 언제나 환영합니다!

## 📄 라이선스

ISC License
