import { CloudWatch } from "@aws-sdk/client-cloudwatch";
import { crawlQueue } from "../queue/crawlQueue";

const cloudwatch = new CloudWatch({
  region: process.env.AWS_REGION || "ap-northeast-2",
});

const NAMESPACE = "CrawlerService";
const ENABLED = process.env.CLOUDWATCH_METRICS_ENABLED === "true";
const INTERVAL_MS = parseInt(
  process.env.METRIC_PUBLISH_INTERVAL_MS || "60000"
);

/**
 * Metric Publisher 전용 프로세스
 * Queue 메트릭을 주기적으로 CloudWatch에 퍼블리시
 */
export async function runMetricPublisher() {
  if (!ENABLED) {
    console.log(
      "[MetricPublisher] CloudWatch metrics disabled (CLOUDWATCH_METRICS_ENABLED=false)"
    );
    return;
  }

  console.log("[MetricPublisher] Starting...");
  console.log(`[MetricPublisher] Publish interval: ${INTERVAL_MS}ms`);
  console.log(`[MetricPublisher] AWS Region: ${process.env.AWS_REGION}`);

  // 즉시 한 번 실행
  await publishQueueMetrics();

  // 주기적으로 실행
  setInterval(async () => {
    await publishQueueMetrics();
  }, INTERVAL_MS);

  console.log("[MetricPublisher] Running");
}

/**
 * Queue 메트릭을 CloudWatch에 퍼블리시
 */
async function publishQueueMetrics(): Promise<void> {
  try {
    const counts = await crawlQueue.getJobCounts();
    const timestamp = new Date();

    const totalPendingJobs = counts.waiting + counts.active;

    const metricData = [
      {
        MetricName: "QueueWaitingJobs",
        Value: totalPendingJobs,
        Unit: "Count" as const,
        Timestamp: timestamp,
      },
      {
        MetricName: "QueueWaitingOnly",
        Value: counts.waiting,
        Unit: "Count" as const,
        Timestamp: timestamp,
      },
      {
        MetricName: "QueueActiveJobs",
        Value: counts.active,
        Unit: "Count" as const,
        Timestamp: timestamp,
      },
      {
        MetricName: "QueueCompletedJobs",
        Value: counts.completed,
        Unit: "Count" as const,
        Timestamp: timestamp,
      },
      {
        MetricName: "QueueFailedJobs",
        Value: counts.failed,
        Unit: "Count" as const,
        Timestamp: timestamp,
      },
      {
        MetricName: "QueueDelayedJobs",
        Value: counts.delayed,
        Unit: "Count" as const,
        Timestamp: timestamp,
      },
    ];

    await cloudwatch.putMetricData({
      Namespace: NAMESPACE,
      MetricData: metricData,
    });

    console.log(
      `[MetricPublisher] Published: waiting=${counts.waiting}, active=${counts.active}, total=${totalPendingJobs}`
    );
  } catch (error) {
    console.error("[MetricPublisher] Failed to publish metrics:", error);
  }
}
