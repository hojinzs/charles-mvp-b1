#!/bin/bash
set -e

# ===========================================
# Crawler Hybrid EC2+ECS 배포 스크립트
# ===========================================

# 색상 출력
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

# ===========================================
# 환경 변수 확인
# ===========================================

if [ -z "$AWS_REGION" ]; then
  export AWS_REGION="ap-northeast-2"
  warn "AWS_REGION not set, using default: $AWS_REGION"
fi

if [ -z "$AWS_ACCOUNT_ID" ]; then
  export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  info "AWS Account ID: $AWS_ACCOUNT_ID"
fi

if [ -z "$ECR_REPO_NAME" ]; then
  export ECR_REPO_NAME="crawler-worker"
fi

export ECR_REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"

# ===========================================
# 배포 타입 선택
# ===========================================

usage() {
  echo "Usage: $0 [COMMAND]"
  echo ""
  echo "Commands:"
  echo "  ecr          - ECR 레포지토리 생성"
  echo "  build        - Docker 이미지 빌드 및 ECR 푸시"
  echo "  secrets      - Secrets Manager에 환경 변수 저장"
  echo "  terraform    - Terraform으로 ECS 인프라 배포"
  echo "  update-task  - ECS Task Definition 업데이트"
  echo "  scale        - ECS Service 수동 스케일링"
  echo "  logs         - ECS 워커 로그 확인"
  echo "  status       - 전체 시스템 상태 확인"
  echo "  destroy      - 인프라 제거 (주의!)"
  echo ""
  echo "Example:"
  echo "  $0 build"
  echo "  $0 terraform"
  exit 1
}

if [ $# -eq 0 ]; then
  usage
fi

COMMAND=$1

# ===========================================
# ECR 레포지토리 생성
# ===========================================

create_ecr() {
  info "Creating ECR repository: $ECR_REPO_NAME"

  if aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $AWS_REGION >/dev/null 2>&1; then
    warn "ECR repository already exists: $ECR_REPO_NAME"
  else
    aws ecr create-repository \
      --repository-name $ECR_REPO_NAME \
      --region $AWS_REGION \
      --image-scanning-configuration scanOnPush=true \
      --tags Key=Project,Value=crawler

    info "ECR repository created: $ECR_REPO_URI"
  fi
}

# ===========================================
# Docker 이미지 빌드 및 푸시
# ===========================================

build_and_push() {
  info "Building and pushing Docker image to ECR"

  # ECR 로그인
  info "Logging in to ECR..."
  aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin $ECR_REPO_URI

  # 이미지 빌드
  info "Building Docker image..."
  cd ../../backend
  docker build -t $ECR_REPO_NAME:latest .

  # 태그 지정
  info "Tagging image..."
  docker tag $ECR_REPO_NAME:latest $ECR_REPO_URI:latest
  docker tag $ECR_REPO_NAME:latest $ECR_REPO_URI:$(date +%Y%m%d-%H%M%S)

  # ECR에 푸시
  info "Pushing image to ECR..."
  docker push $ECR_REPO_URI:latest
  docker push $ECR_REPO_URI:$(date +%Y%m%d-%H%M%S)

  info "Image pushed successfully: $ECR_REPO_URI:latest"
}

# ===========================================
# Secrets Manager에 환경 변수 저장
# ===========================================

create_secrets() {
  info "Creating secrets in AWS Secrets Manager"

  # 환경 변수 파일 확인
  if [ ! -f "../../backend/.env" ]; then
    error ".env file not found. Please create backend/.env first."
  fi

  # .env 파일에서 값 읽기
  source ../../backend/.env

  # DATABASE_URL
  if aws secretsmanager describe-secret --secret-id crawler/database-url --region $AWS_REGION >/dev/null 2>&1; then
    warn "Secret already exists: crawler/database-url"
    read -p "Update? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      aws secretsmanager update-secret \
        --secret-id crawler/database-url \
        --secret-string "$DATABASE_URL" \
        --region $AWS_REGION
      info "Updated: crawler/database-url"
    fi
  else
    aws secretsmanager create-secret \
      --name crawler/database-url \
      --description "PostgreSQL connection URL" \
      --secret-string "$DATABASE_URL" \
      --region $AWS_REGION
    info "Created: crawler/database-url"
  fi

  # REDIS_URL
  if aws secretsmanager describe-secret --secret-id crawler/redis-url --region $AWS_REGION >/dev/null 2>&1; then
    warn "Secret already exists: crawler/redis-url"
  else
    aws secretsmanager create-secret \
      --name crawler/redis-url \
      --description "Redis connection URL" \
      --secret-string "$REDIS_URL" \
      --region $AWS_REGION
    info "Created: crawler/redis-url"
  fi

  info "Secrets created successfully"
}

# ===========================================
# Terraform 배포
# ===========================================

deploy_terraform() {
  info "Deploying infrastructure with Terraform"

  cd ../terraform

  # terraform.tfvars 확인
  if [ ! -f "terraform.tfvars" ]; then
    error "terraform.tfvars not found. Please create it from terraform.tfvars.example"
  fi

  # Terraform 초기화
  info "Initializing Terraform..."
  terraform init

  # 실행 계획 확인
  info "Planning Terraform deployment..."
  terraform plan -out=tfplan

  # 사용자 확인
  read -p "Apply this plan? (yes/no): " -r
  if [[ $REPLY != "yes" ]]; then
    warn "Deployment cancelled"
    exit 0
  fi

  # 배포 실행
  info "Applying Terraform..."
  terraform apply tfplan

  info "Infrastructure deployed successfully"
}

# ===========================================
# ECS Task Definition 업데이트
# ===========================================

update_task() {
  info "Updating ECS Task Definition"

  CLUSTER_NAME=$(terraform output -raw ecs_cluster_name 2>/dev/null || echo "crawler-workers")
  SERVICE_NAME=$(terraform output -raw ecs_service_name 2>/dev/null || echo "crawler-worker-service")

  # 최신 Task Definition 가져오기
  TASK_FAMILY="crawler-worker"
  TASK_DEF=$(aws ecs describe-task-definition --task-definition $TASK_FAMILY --region $AWS_REGION)

  # 새 리비전 등록
  NEW_TASK_DEF=$(echo $TASK_DEF | jq '.taskDefinition | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

  aws ecs register-task-definition \
    --cli-input-json "$NEW_TASK_DEF" \
    --region $AWS_REGION

  # 서비스 업데이트
  aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --task-definition $TASK_FAMILY \
    --force-new-deployment \
    --region $AWS_REGION

  info "ECS service updated with new task definition"
}

# ===========================================
# ECS 수동 스케일링
# ===========================================

scale_ecs() {
  read -p "Enter desired task count: " DESIRED_COUNT

  CLUSTER_NAME=$(terraform output -raw ecs_cluster_name 2>/dev/null || echo "crawler-workers")
  SERVICE_NAME=$(terraform output -raw ecs_service_name 2>/dev/null || echo "crawler-worker-service")

  info "Scaling ECS service to $DESIRED_COUNT tasks..."

  aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --desired-count $DESIRED_COUNT \
    --region $AWS_REGION

  info "Service scaled to $DESIRED_COUNT tasks"
}

# ===========================================
# ECS 로그 확인
# ===========================================

view_logs() {
  LOG_GROUP="/ecs/crawler-worker"

  info "Fetching latest logs from $LOG_GROUP..."

  # 최근 10분간 로그 확인
  START_TIME=$(($(date +%s) - 600))000
  END_TIME=$(date +%s)000

  aws logs tail $LOG_GROUP \
    --follow \
    --since 10m \
    --region $AWS_REGION
}

# ===========================================
# 시스템 상태 확인
# ===========================================

check_status() {
  info "Checking system status..."

  echo ""
  echo "=== ECS Cluster Status ==="
  CLUSTER_NAME=$(terraform output -raw ecs_cluster_name 2>/dev/null || echo "crawler-workers")
  SERVICE_NAME=$(terraform output -raw ecs_service_name 2>/dev/null || echo "crawler-worker-service")

  aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $AWS_REGION \
    --query 'services[0].{Status:status,DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount}' \
    --output table

  echo ""
  echo "=== CloudWatch Metrics (Last 5 minutes) ==="
  aws cloudwatch get-metric-statistics \
    --namespace CrawlerService \
    --metric-name QueueWaitingJobs \
    --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 60 \
    --statistics Average \
    --region $AWS_REGION \
    --query 'Datapoints[0].Average' \
    --output text | xargs -I {} echo "Queue Waiting Jobs: {}"

  echo ""
  echo "=== Recent ECS Tasks ==="
  aws ecs list-tasks \
    --cluster $CLUSTER_NAME \
    --service-name $SERVICE_NAME \
    --desired-status RUNNING \
    --region $AWS_REGION \
    --query 'taskArns' \
    --output table

  info "Status check complete"
}

# ===========================================
# 인프라 제거
# ===========================================

destroy_infrastructure() {
  warn "This will destroy ALL infrastructure created by Terraform!"
  read -p "Are you sure? Type 'yes' to confirm: " -r

  if [[ $REPLY != "yes" ]]; then
    warn "Destroy cancelled"
    exit 0
  fi

  cd ../terraform

  info "Destroying infrastructure..."
  terraform destroy

  info "Infrastructure destroyed"
}

# ===========================================
# 명령어 실행
# ===========================================

case $COMMAND in
  ecr)
    create_ecr
    ;;
  build)
    build_and_push
    ;;
  secrets)
    create_secrets
    ;;
  terraform)
    deploy_terraform
    ;;
  update-task)
    update_task
    ;;
  scale)
    scale_ecs
    ;;
  logs)
    view_logs
    ;;
  status)
    check_status
    ;;
  destroy)
    destroy_infrastructure
    ;;
  *)
    error "Unknown command: $COMMAND"
    usage
    ;;
esac

info "Done!"
