terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # S3 Backend (옵션: Terraform 상태 원격 저장)
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "crawler/terraform.tfstate"
  #   region = "ap-northeast-2"
  # }
}

provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "ap-northeast-2"
}

variable "project_name" {
  description = "Project name prefix"
  type        = string
  default     = "crawler"
}

variable "environment" {
  description = "Environment (dev, staging, production)"
  type        = string
  default     = "production"
}

variable "vpc_id" {
  description = "VPC ID where resources will be created"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "ec2_security_group_id" {
  description = "Security Group ID of EC2 instance (for Redis/PostgreSQL access)"
  type        = string
}

variable "ec2_private_ip" {
  description = "Private IP of EC2 instance running Redis/PostgreSQL"
  type        = string
}

variable "container_image" {
  description = "Docker image URL for crawler worker"
  type        = string
  # Example: "123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/crawler-worker:latest"
}

variable "database_url_secret_arn" {
  description = "ARN of Secrets Manager secret for DATABASE_URL"
  type        = string
}

variable "redis_url_secret_arn" {
  description = "ARN of Secrets Manager secret for REDIS_URL"
  type        = string
}

variable "min_capacity" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 0
}

variable "max_capacity" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 50
}

variable "target_queue_size" {
  description = "Target queue size per worker for auto-scaling"
  type        = number
  default     = 20
}

# Data Sources
data "aws_caller_identity" "current" {}

# Locals
locals {
  account_id = data.aws_caller_identity.current.account_id
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ========================================
# ECS Cluster
# ========================================

resource "aws_ecs_cluster" "crawler_workers" {
  name = "${var.project_name}-workers"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

# ========================================
# ECS Task Execution Role
# ========================================

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.project_name}-ecsTaskExecutionRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Secrets Manager 접근 권한
resource "aws_iam_role_policy" "ecs_secrets_access" {
  name = "${var.project_name}-ecs-secrets-access"
  role = aws_iam_role.ecs_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          var.database_url_secret_arn,
          var.redis_url_secret_arn,
          "arn:aws:secretsmanager:${var.aws_region}:${local.account_id}:secret:crawler/*"
        ]
      }
    ]
  })
}

# ========================================
# ECS Task Role (워커가 실행 중 사용하는 권한)
# ========================================

resource "aws_iam_role" "crawler_worker_task_role" {
  name = "${var.project_name}WorkerTaskRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

# CloudWatch Logs 쓰기 권한
resource "aws_iam_role_policy" "worker_cloudwatch_logs" {
  name = "${var.project_name}-worker-cloudwatch-logs"
  role = aws_iam_role.crawler_worker_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/ecs/${var.project_name}-worker:*"
      }
    ]
  })
}

# CloudWatch 메트릭 퍼블리시 권한 (ECS 워커가 자체 메트릭 전송)
resource "aws_iam_role_policy" "worker_cloudwatch_metrics" {
  name = "${var.project_name}-worker-cloudwatch-metrics"
  role = aws_iam_role.crawler_worker_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "CrawlerService"
          }
        }
      }
    ]
  })
}

# ========================================
# Security Group for ECS Tasks
# ========================================

resource "aws_security_group" "ecs_worker" {
  name        = "${var.project_name}-ecs-worker-sg"
  description = "Security group for ECS crawler workers"
  vpc_id      = var.vpc_id

  # Outbound: Redis (EC2)
  egress {
    description     = "Redis access to EC2"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.ec2_security_group_id]
  }

  # Outbound: PostgreSQL (EC2)
  egress {
    description     = "PostgreSQL access to EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.ec2_security_group_id]
  }

  # Outbound: HTTPS (크롤링 대상 사이트)
  egress {
    description = "HTTPS for web crawling"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound: HTTP (크롤링 대상 사이트)
  egress {
    description = "HTTP for web crawling"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-ecs-worker-sg"
  })
}

# EC2 Security Group에 ECS 접근 허용 규칙 추가 필요
# (Terraform으로 EC2 SG를 관리하지 않는 경우 수동 추가 필요)

# ========================================
# CloudWatch Log Group
# ========================================

resource "aws_cloudwatch_log_group" "ecs_worker" {
  name              = "/ecs/${var.project_name}-worker"
  retention_in_days = 7

  tags = local.common_tags
}

# ========================================
# ECS Task Definition
# ========================================

resource "aws_ecs_task_definition" "crawler_worker" {
  family                   = "${var.project_name}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"  # 1 vCPU
  memory                   = "2048"  # 2 GB
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.crawler_worker_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "${var.project_name}-worker"
      image     = var.container_image
      essential = true
      command   = ["--process=worker"]

      environment = [
        {
          name  = "WORKER_CONCURRENCY"
          value = "4"
        },
        {
          name  = "WORKER_INTERVAL_MS"
          value = "500"
        },
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "CLOUDWATCH_METRICS_ENABLED"
          value = "true"
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = var.database_url_secret_arn
        },
        {
          name      = "REDIS_URL"
          valueFrom = var.redis_url_secret_arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"process.exit(0)\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      stopTimeout = 120

      ulimits = [
        {
          name      = "nofile"
          softLimit = 65536
          hardLimit = 65536
        }
      ]
    }
  ])

  tags = local.common_tags
}

# ========================================
# ECS Service
# ========================================

resource "aws_ecs_service" "crawler_worker" {
  name            = "${var.project_name}-worker-service"
  cluster         = aws_ecs_cluster.crawler_workers.id
  task_definition = aws_ecs_task_definition.crawler_worker.arn
  desired_count   = var.min_capacity
  launch_type     = "FARGATE"
  platform_version = "LATEST"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_worker.id]
    assign_public_ip = false  # Private subnet + NAT Gateway 사용
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 50
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_ecs_managed_tags = true
  propagate_tags          = "SERVICE"

  tags = local.common_tags

  lifecycle {
    ignore_changes = [desired_count]  # Auto Scaling이 desired_count를 관리하므로 무시
  }
}

# ========================================
# Application Auto Scaling Target
# ========================================

resource "aws_appautoscaling_target" "ecs_worker" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.crawler_workers.name}/${aws_ecs_service.crawler_worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# ========================================
# Auto Scaling Policy (Target Tracking)
# ========================================

resource "aws_appautoscaling_policy" "ecs_worker_queue_based" {
  name               = "${var.project_name}-queue-based-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_worker.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_worker.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = var.target_queue_size

    customized_metric_specification {
      metric_name = "QueueWaitingJobs"
      namespace   = "CrawlerService"
      statistic   = "Average"
    }

    scale_in_cooldown  = 300  # 5분
    scale_out_cooldown = 60   # 1분
  }
}

# ========================================
# CloudWatch Dashboard
# ========================================

resource "aws_cloudwatch_dashboard" "crawler_monitoring" {
  dashboard_name = "${var.project_name}-monitoring"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        x    = 0
        y    = 0
        width = 12
        height = 6
        properties = {
          metrics = [
            ["CrawlerService", "QueueWaitingJobs", { stat = "Average", label = "대기 중인 작업" }],
            [".", ".", { stat = "Maximum", label = "최대 대기 작업" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          title  = "큐 대기 작업 수"
          period = 60
          yAxis = {
            left = {
              min = 0
            }
          }
          annotations = {
            horizontal = [
              {
                label = "Scale Up Threshold"
                value = var.target_queue_size
                fill  = "above"
                color = "#ff9900"
              }
            ]
          }
        }
      },
      {
        type = "metric"
        x    = 12
        y    = 0
        width = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ECS", "RunningTasksCount", { stat = "Average", label = "ECS 워커 수", dimensions = { ClusterName = aws_ecs_cluster.crawler_workers.name, ServiceName = aws_ecs_service.crawler_worker.name } }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          title  = "ECS 워커 실행 수"
          period = 60
          yAxis = {
            left = {
              min = 0
              max = var.max_capacity
            }
          }
        }
      }
    ]
  })
}

# ========================================
# CloudWatch Alarms
# ========================================

resource "aws_cloudwatch_metric_alarm" "queue_high" {
  alarm_name          = "${var.project_name}-queue-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "QueueWaitingJobs"
  namespace           = "CrawlerService"
  period              = 300
  statistic           = "Average"
  threshold           = 100
  alarm_description   = "Queue waiting jobs exceeded 100"
  treat_missing_data  = "notBreaching"

  # alarm_actions = [aws_sns_topic.alerts.arn]  # SNS 토픽 추가 필요

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_high_cost" {
  alarm_name          = "${var.project_name}-ecs-high-cost"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RunningTasksCount"
  namespace           = "AWS/ECS"
  period              = 3600
  statistic           = "Average"
  threshold           = 40
  alarm_description   = "ECS running tasks exceeded 40 (cost warning)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.crawler_workers.name
    ServiceName = aws_ecs_service.crawler_worker.name
  }

  # alarm_actions = [aws_sns_topic.cost_alerts.arn]  # SNS 토픽 추가 필요

  tags = local.common_tags
}

# ========================================
# Outputs
# ========================================

output "ecs_cluster_name" {
  description = "ECS Cluster name"
  value       = aws_ecs_cluster.crawler_workers.name
}

output "ecs_service_name" {
  description = "ECS Service name"
  value       = aws_ecs_service.crawler_worker.name
}

output "ecs_task_definition_arn" {
  description = "ECS Task Definition ARN"
  value       = aws_ecs_task_definition.crawler_worker.arn
}

output "cloudwatch_dashboard_url" {
  description = "CloudWatch Dashboard URL"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.crawler_monitoring.dashboard_name}"
}

output "ecs_security_group_id" {
  description = "ECS Worker Security Group ID"
  value       = aws_security_group.ecs_worker.id
}
