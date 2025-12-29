import { CloudWatch } from "@aws-sdk/client-cloudwatch";
import { crawlQueue } from "../queue/crawlQueue";

// CloudWatch 클라이언트 초기화
// AWS_REGION 환경 변수가 설정되어 있어야 함
const cloudwatch = new CloudWatch({
  region: process.env.AWS_REGION || "ap-northeast-2",
});

const NAMESPACE = "CrawlerService";
const ENABLED = process.env.CLOUDWATCH_METRICS_ENABLED === "true";

/**
 * Queue 메트릭을 CloudWatch에 퍼블리시
 * ECS Auto Scaling이 이 메트릭을 사용하여 워커 수를 조정함
 */
export async function publishQueueMetrics(): Promise<void> {
  if (!ENABLED) {
    console.log("[CloudWatch] Metrics publishing disabled (CLOUDWATCH_METRICS_ENABLED=false)");
    return;
  }

  try {
    const counts = await crawlQueue.getJobCounts();
    const timestamp = new Date();

    // 대기 중인 작업 수 (waiting + active)
    // Auto Scaling 정책의 주요 메트릭
    const totalPendingJobs = counts.waiting + counts.active;

    const metricData = [
      {
        MetricName: "QueueWaitingJobs",
        Value: totalPendingJobs,
        Unit: "Count" as const,
        Timestamp: timestamp,
        Dimensions: [],
      },
      {
        MetricName: "QueueWaitingJobsOnly",
        Value: counts.waiting,
        Unit: "Count" as const,
        Timestamp: timestamp,
        Dimensions: [],
      },
      {
        MetricName: "QueueActiveJobs",
        Value: counts.active,
        Unit: "Count" as const,
        Timestamp: timestamp,
        Dimensions: [],
      },
      {
        MetricName: "QueueCompletedJobs",
        Value: counts.completed,
        Unit: "Count" as const,
        Timestamp: timestamp,
        Dimensions: [],
      },
      {
        MetricName: "QueueFailedJobs",
        Value: counts.failed,
        Unit: "Count" as const,
        Timestamp: timestamp,
        Dimensions: [],
      },
      {
        MetricName: "QueueDelayedJobs",
        Value: counts.delayed,
        Unit: "Count" as const,
        Timestamp: timestamp,
        Dimensions: [],
      },
    ];

    await cloudwatch.putMetricData({
      Namespace: NAMESPACE,
      MetricData: metricData,
    });

    console.log(
      `[CloudWatch] Published metrics: waiting=${counts.waiting}, active=${counts.active}, total=${totalPendingJobs}`
    );
  } catch (error) {
    console.error("[CloudWatch] Failed to publish metrics:", error);
    // 메트릭 퍼블리시 실패는 치명적이지 않으므로 에러를 던지지 않음
  }
}

/**
 * 주기적으로 메트릭을 CloudWatch에 퍼블리시
 * @param intervalMs 퍼블리시 간격 (밀리초), 기본값: 60000ms (1분)
 */
export function startMetricPublisher(intervalMs: number = 60000): NodeJS.Timeout {
  if (!ENABLED) {
    console.log("[CloudWatch] Metric publisher not started (disabled)");
    return setTimeout(() => {}, 0); // Dummy timeout
  }

  console.log(`[CloudWatch] Starting metric publisher (interval: ${intervalMs}ms)`);

  // 즉시 한 번 실행
  publishQueueMetrics();

  // 주기적으로 실행
  const interval = setInterval(() => {
    publishQueueMetrics();
  }, intervalMs);

  return interval;
}

/**
 * 커스텀 메트릭 퍼블리시 (범용)
 */
export async function publishCustomMetric(
  metricName: string,
  value: number,
  unit: "Count" | "Seconds" | "Percent" = "Count",
  dimensions: Array<{ Name: string; Value: string }> = []
): Promise<void> {
  if (!ENABLED) {
    return;
  }

  try {
    await cloudwatch.putMetricData({
      Namespace: NAMESPACE,
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date(),
          Dimensions: dimensions,
        },
      ],
    });

    console.log(`[CloudWatch] Published custom metric: ${metricName}=${value}`);
  } catch (error) {
    console.error(`[CloudWatch] Failed to publish custom metric ${metricName}:`, error);
  }
}
