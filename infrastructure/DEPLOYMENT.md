# Hybrid EC2 + ECS Deployment Guide

이 가이드는 EC2에 고정 스택을 배포하고, ECS Fargate로 워커를 동적 스케일링하는 하이브리드 아키텍처 배포 방법을 설명합니다.

---

## 📋 사전 준비사항

### 1. AWS 계정 및 권한

필요한 AWS 서비스:
- ✅ EC2 (t3.large 이상)
- ✅ VPC (Public/Private Subnet, NAT Gateway)
- ✅ ECS Fargate
- ✅ ECR (Elastic Container Registry)
- ✅ CloudWatch
- ✅ Secrets Manager
- ✅ IAM

### 2. 로컬 환경 도구

```bash
# AWS CLI 설치 확인
aws --version

# Docker 설치 확인
docker --version

# Terraform 설치 확인 (옵션)
terraform --version

# Git 설치 확인
git --version
```

### 3. AWS 자격증명 설정

```bash
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region name: ap-northeast-2
# Default output format: json
```

---

## 🏗️ Step 1: VPC 및 네트워크 설정

### 1.1 VPC 생성 (이미 있다면 건너뛰기)

```bash
# VPC 생성
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=crawler-vpc}]'

# VPC ID 저장
export VPC_ID=vpc-xxxxxxxxx
```

### 1.2 서브넷 생성

```bash
# Public Subnet (EC2용)
aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ap-northeast-2a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=crawler-public-subnet}]'

export PUBLIC_SUBNET_ID=subnet-xxxxxxxxx

# Private Subnet 1 (ECS용)
aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ap-northeast-2a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=crawler-private-subnet-1}]'

export PRIVATE_SUBNET_ID_1=subnet-yyyyyyyyy

# Private Subnet 2 (ECS용 - 고가용성)
aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.3.0/24 \
  --availability-zone ap-northeast-2c \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=crawler-private-subnet-2}]'

export PRIVATE_SUBNET_ID_2=subnet-zzzzzzzzz
```

### 1.3 Internet Gateway 및 NAT Gateway 설정

```bash
# Internet Gateway 생성
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=crawler-igw}]'
export IGW_ID=igw-xxxxxxxxx

# VPC에 Internet Gateway 연결
aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $IGW_ID

# Elastic IP 할당 (NAT Gateway용)
aws ec2 allocate-address --domain vpc
export NAT_EIP_ALLOC_ID=eipalloc-xxxxxxxxx

# NAT Gateway 생성 (Public Subnet에 배치)
aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_ID \
  --allocation-id $NAT_EIP_ALLOC_ID \
  --tag-specifications 'ResourceType=natgateway,Tags=[{Key=Name,Value=crawler-nat}]'

export NAT_GW_ID=nat-xxxxxxxxx

# NAT Gateway 상태 확인 (available 될 때까지 대기)
aws ec2 describe-nat-gateways --nat-gateway-ids $NAT_GW_ID
```

### 1.4 Route Table 설정

```bash
# Public Route Table
aws ec2 create-route-table --vpc-id $VPC_ID --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=crawler-public-rt}]'
export PUBLIC_RT_ID=rtb-xxxxxxxxx

# Public Subnet → Internet Gateway 라우팅
aws ec2 create-route --route-table-id $PUBLIC_RT_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 associate-route-table --route-table-id $PUBLIC_RT_ID --subnet-id $PUBLIC_SUBNET_ID

# Private Route Table
aws ec2 create-route-table --vpc-id $VPC_ID --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=crawler-private-rt}]'
export PRIVATE_RT_ID=rtb-yyyyyyyyy

# Private Subnet → NAT Gateway 라우팅
aws ec2 create-route --route-table-id $PRIVATE_RT_ID --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $NAT_GW_ID
aws ec2 associate-route-table --route-table-id $PRIVATE_RT_ID --subnet-id $PRIVATE_SUBNET_ID_1
aws ec2 associate-route-table --route-table-id $PRIVATE_RT_ID --subnet-id $PRIVATE_SUBNET_ID_2
```

---

## 🖥️ Step 2: EC2 인스턴스 배포

### 2.1 Security Group 생성

```bash
# EC2 Security Group
aws ec2 create-security-group \
  --group-name crawler-ec2-sg \
  --description "Security group for EC2 crawler instance" \
  --vpc-id $VPC_ID

export EC2_SG_ID=sg-xxxxxxxxx

# SSH 접근 (본인 IP로 제한)
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr YOUR_IP/32

# API 접근 (0.0.0.0/0 또는 특정 IP)
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 3000 \
  --cidr 0.0.0.0/0

# Redis 접근 (ECS에서)
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 6379 \
  --source-group $EC2_SG_ID

# PostgreSQL 접근 (ECS에서)
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 5432 \
  --source-group $EC2_SG_ID
```

### 2.2 EC2 인스턴스 생성

```bash
# Key Pair 생성
aws ec2 create-key-pair \
  --key-name crawler-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/crawler-key.pem

chmod 400 ~/.ssh/crawler-key.pem

# EC2 인스턴스 시작 (Amazon Linux 2023)
aws ec2 run-instances \
  --image-id ami-0c9c942bd7bf113a2 \
  --instance-type t3.large \
  --key-name crawler-key \
  --subnet-id $PUBLIC_SUBNET_ID \
  --security-group-ids $EC2_SG_ID \
  --associate-public-ip-address \
  --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=50,VolumeType=gp3}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=crawler-ec2}]' \
  --iam-instance-profile Name=EC2CloudWatchRole  # CloudWatch 메트릭 퍼블리시용

export EC2_INSTANCE_ID=i-xxxxxxxxx

# Public IP 확인
aws ec2 describe-instances --instance-ids $EC2_INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text
export EC2_PUBLIC_IP=xxx.xxx.xxx.xxx
```

### 2.3 EC2 초기 설정

```bash
# SSH 접속
ssh -i ~/.ssh/crawler-key.pem ec2-user@$EC2_PUBLIC_IP

# Docker 설치
sudo yum update -y
sudo yum install -y docker git
sudo service docker start
sudo usermod -a -G docker ec2-user

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 재접속 (그룹 권한 적용)
exit
ssh -i ~/.ssh/crawler-key.pem ec2-user@$EC2_PUBLIC_IP
```

### 2.4 프로젝트 배포

```bash
# 프로젝트 클론
git clone https://github.com/your-org/charles-mvp-b1.git
cd charles-mvp-b1

# 환경 변수 설정
cp backend/.env.example backend/.env
vi backend/.env

# .env 파일 예시:
# DATABASE_URL=postgresql://crawler:crawler123@postgres:5432/crawler_db
# REDIS_URL=redis://redis:6379
# CLOUDWATCH_METRICS_ENABLED=true
# AWS_REGION=ap-northeast-2
# AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
# AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY

# Docker 이미지 빌드 및 실행
docker-compose -f docker-compose.ec2.yaml up -d

# 로그 확인
docker-compose -f docker-compose.ec2.yaml logs -f
```

### 2.5 동작 확인

```bash
# API 헬스 체크
curl http://localhost:3000/health

# Prometheus 메트릭 확인
curl http://localhost:3000/metrics | grep crawling_queue_jobs

# Queue 상태 확인
curl http://localhost:3000/api/jobs/queue
```

---

## 🐳 Step 3: ECR 레포지토리 생성 및 이미지 푸시

### 3.1 ECR 레포지토리 생성

```bash
# ECR 레포지토리 생성
aws ecr create-repository \
  --repository-name crawler-worker \
  --region ap-northeast-2

export ECR_REPO_URI=123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/crawler-worker
```

### 3.2 Docker 이미지 빌드 및 푸시

```bash
# 로컬에서 실행 (또는 EC2에서 실행 가능)
cd backend

# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin $ECR_REPO_URI

# Docker 이미지 빌드
docker build -t crawler-worker:latest .

# 태그 지정
docker tag crawler-worker:latest $ECR_REPO_URI:latest

# ECR에 푸시
docker push $ECR_REPO_URI:latest

# 이미지 확인
aws ecr describe-images --repository-name crawler-worker
```

---

## 🔐 Step 4: Secrets Manager에 환경 변수 저장

```bash
# DATABASE_URL 저장
aws secretsmanager create-secret \
  --name crawler/database-url \
  --description "PostgreSQL connection URL" \
  --secret-string "postgresql://crawler:crawler123@EC2_PRIVATE_IP:5432/crawler_db"

export DB_SECRET_ARN=$(aws secretsmanager describe-secret --secret-id crawler/database-url --query ARN --output text)

# REDIS_URL 저장
aws secretsmanager create-secret \
  --name crawler/redis-url \
  --description "Redis connection URL" \
  --secret-string "redis://EC2_PRIVATE_IP:6379"

export REDIS_SECRET_ARN=$(aws secretsmanager describe-secret --secret-id crawler/redis-url --query ARN --output text)

# 프록시 정보 저장 (옵션)
aws secretsmanager create-secret \
  --name crawler/proxy-host \
  --secret-string "brd.superproxy.io"

aws secretsmanager create-secret \
  --name crawler/proxy-port \
  --secret-string "33335"

aws secretsmanager create-secret \
  --name crawler/proxy-user \
  --secret-string "YOUR_PROXY_USER"

aws secretsmanager create-secret \
  --name crawler/proxy-pass \
  --secret-string "YOUR_PROXY_PASSWORD"
```

---

## 🚀 Step 5: Terraform으로 ECS 인프라 배포

### 5.1 Terraform 변수 설정

```bash
cd infrastructure/terraform

# terraform.tfvars 파일 생성
cp terraform.tfvars.example terraform.tfvars

# 변수 입력
vi terraform.tfvars
```

**terraform.tfvars 예시:**
```hcl
aws_region = "ap-northeast-2"
project_name = "crawler"
environment = "production"

vpc_id = "vpc-xxxxxxxxx"  # 위에서 생성한 VPC ID
private_subnet_ids = [
  "subnet-yyyyyyyyy",
  "subnet-zzzzzzzzz"
]

ec2_security_group_id = "sg-xxxxxxxxx"
ec2_private_ip = "10.0.1.100"  # EC2 Private IP

container_image = "123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/crawler-worker:latest"

database_url_secret_arn = "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:crawler/database-url-AbCdEf"
redis_url_secret_arn = "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:crawler/redis-url-XyZaBc"

min_capacity = 0
max_capacity = 50
target_queue_size = 20
```

### 5.2 Terraform 실행

```bash
# Terraform 초기화
terraform init

# 실행 계획 확인
terraform plan

# 인프라 프로비저닝
terraform apply

# 확인 후 'yes' 입력
```

### 5.3 배포 확인

```bash
# ECS 클러스터 확인
aws ecs list-clusters

# ECS 서비스 확인
aws ecs describe-services \
  --cluster crawler-workers \
  --services crawler-worker-service

# CloudWatch 메트릭 확인
aws cloudwatch get-metric-statistics \
  --namespace CrawlerService \
  --metric-name QueueWaitingJobs \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

---

## 📊 Step 6: 모니터링 설정

### 6.1 CloudWatch Dashboard 확인

```bash
# Terraform에서 생성한 대시보드 URL
https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#dashboards:name=crawler-monitoring
```

### 6.2 SNS 알림 설정 (옵션)

```bash
# SNS 토픽 생성
aws sns create-topic --name crawler-alerts

export SNS_TOPIC_ARN=arn:aws:sns:ap-northeast-2:123456789012:crawler-alerts

# 이메일 구독
aws sns subscribe \
  --topic-arn $SNS_TOPIC_ARN \
  --protocol email \
  --notification-endpoint your-email@example.com

# 구독 확인 이메일에서 승인

# CloudWatch Alarm에 SNS 연결 (Terraform에서 주석 해제)
```

---

## 🧪 Step 7: 부하 테스트

### 7.1 테스트 키워드 대량 등록

```bash
# API를 통해 100개 키워드 등록
curl -X POST http://$EC2_PUBLIC_IP:3000/api/keywords/batch \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": [
      {"keyword": "테스트1", "url": "https://example.com"},
      {"keyword": "테스트2", "url": "https://example.com"},
      ...
    ]
  }'
```

### 7.2 Auto Scaling 동작 확인

```bash
# 1분마다 큐 상태와 ECS 워커 수 확인
watch -n 60 '
  echo "=== Queue Status ==="
  curl -s http://$EC2_PUBLIC_IP:3000/api/jobs/queue | jq

  echo -e "\n=== ECS Running Tasks ==="
  aws ecs describe-services \
    --cluster crawler-workers \
    --services crawler-worker-service \
    --query "services[0].runningCount"
'
```

**예상 동작:**
1. Queue에 100개 작업이 쌓이면 → ECS 워커 5개 시작 (100 / 20 = 5)
2. 작업이 처리되면서 Queue가 줄어들면 → ECS 워커 감소
3. Queue가 비면 → 5분 후 ECS 워커 0개로 축소 (비용 $0)

---

## 💰 Step 8: 비용 최적화 팁

### 8.1 Spot Instances 사용 (비용 70% 절감)

Terraform에서 ECS Service에 Capacity Provider 추가:

```hcl
# Fargate Spot 사용
resource "aws_ecs_capacity_provider" "fargate_spot" {
  name = "FARGATE_SPOT"
}

resource "aws_ecs_service" "crawler_worker" {
  # ... 기존 설정

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
    base              = 0
  }
}
```

### 8.2 Reserved Instances (EC2)

```bash
# EC2를 1년 약정하면 약 30% 할인
aws ec2 purchase-reserved-instances-offering \
  --reserved-instances-offering-id <offering-id> \
  --instance-count 1
```

### 8.3 CloudWatch Logs 보존 기간 단축

```bash
# 7일 → 3일로 변경하여 비용 절감
aws logs put-retention-policy \
  --log-group-name /ecs/crawler-worker \
  --retention-in-days 3
```

---

## 🔧 Troubleshooting

### 문제 1: ECS 워커가 시작되지 않음

**원인**: Secrets Manager 접근 권한 부족

**해결**:
```bash
# ECS Task Execution Role에 권한 확인
aws iam get-role-policy \
  --role-name crawler-ecsTaskExecutionRole \
  --policy-name crawler-ecs-secrets-access
```

### 문제 2: CloudWatch 메트릭이 보이지 않음

**원인**: EC2 IAM Role에 CloudWatch 권한 없음

**해결**:
```bash
# EC2 IAM Role 생성 및 연결
aws iam create-role \
  --role-name EC2CloudWatchRole \
  --assume-role-policy-document file://ec2-trust-policy.json

aws iam attach-role-policy \
  --role-name EC2CloudWatchRole \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

# EC2 인스턴스에 Role 연결
aws ec2 associate-iam-instance-profile \
  --instance-id $EC2_INSTANCE_ID \
  --iam-instance-profile Name=EC2CloudWatchRole
```

### 문제 3: ECS 워커가 EC2 Redis에 접근 불가

**원인**: Security Group 설정 누락

**해결**:
```bash
# ECS Security Group ID 확인
export ECS_SG_ID=$(terraform output -raw ecs_security_group_id)

# EC2 Security Group에 ECS 접근 허용 추가
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 6379 \
  --source-group $ECS_SG_ID

aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 5432 \
  --source-group $ECS_SG_ID
```

---

## 🎯 다음 단계

1. ✅ 기본 배포 완료
2. ⏳ 프로덕션 데이터베이스 RDS로 이전
3. ⏳ Redis ElastiCache로 이전
4. ⏳ CI/CD 파이프라인 구축 (GitHub Actions)
5. ⏳ Blue/Green Deployment 설정
6. ⏳ Multi-Region 배포 (고가용성)

---

## 📚 참고 자료

- [AWS ECS Fargate 가격](https://aws.amazon.com/fargate/pricing/)
- [AWS Auto Scaling 문서](https://docs.aws.amazon.com/autoscaling/)
- [CloudWatch 메트릭 사용자 정의](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/publishingMetrics.html)
- [Terraform ECS 모듈](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecs_service)
