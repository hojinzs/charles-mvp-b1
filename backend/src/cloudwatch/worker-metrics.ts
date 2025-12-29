import { CloudWatch } from "@aws-sdk/client-cloudwatch";

const cloudwatch = new CloudWatch({
  region: process.env.AWS_REGION || "ap-northeast-2",
});

const NAMESPACE = "CrawlerService";
const ENABLED = process.env.CLOUDWATCH_METRICS_ENABLED === "true";

// Worker 식별자 (ECS Task ID 또는 Container Name)
const WORKER_ID =
  process.env.ECS_TASK_ID ||
  process.env.HOSTNAME ||
  process.env.CONTAINER_NAME ||
  "unknown";

/**
 * Worker 작업 완료 메트릭 전송
 */
export async function publishWorkerJobComplete(
  success: boolean,
  method: "axios" | "puppeteer",
  durationSeconds: number
): Promise<void> {
  if (!ENABLED) {
    return;
  }

  try {
    await cloudwatch.putMetricData({
      Namespace: NAMESPACE,
      MetricData: [
        {
          MetricName: "WorkerJobDuration",
          Value: durationSeconds,
          Unit: "Seconds" as const,
          Timestamp: new Date(),
          Dimensions: [
            { Name: "WorkerId", Value: WORKER_ID },
            { Name: "Status", Value: success ? "success" : "failed" },
            { Name: "Method", Value: method },
          ],
        },
        {
          MetricName: "WorkerJobsCompleted",
          Value: 1,
          Unit: "Count" as const,
          Timestamp: new Date(),
          Dimensions: [
            { Name: "WorkerId", Value: WORKER_ID },
            { Name: "Status", Value: success ? "success" : "failed" },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("[CloudWatch] Failed to publish worker metrics:", error);
  }
}

/**
 * Worker 에러 메트릭 전송
 */
export async function publishWorkerError(
  errorType: string,
  errorMessage: string
): Promise<void> {
  if (!ENABLED) {
    return;
  }

  try {
    await cloudwatch.putMetricData({
      Namespace: NAMESPACE,
      MetricData: [
        {
          MetricName: "WorkerErrors",
          Value: 1,
          Unit: "Count" as const,
          Timestamp: new Date(),
          Dimensions: [
            { Name: "WorkerId", Value: WORKER_ID },
            { Name: "ErrorType", Value: errorType },
          ],
        },
      ],
    });

    console.log(
      `[CloudWatch] Published error metric: ${errorType} - ${errorMessage}`
    );
  } catch (error) {
    console.error("[CloudWatch] Failed to publish error metric:", error);
  }
}

/**
 * Worker 헬스 체크 메트릭 전송 (주기적)
 */
export async function publishWorkerHeartbeat(): Promise<void> {
  if (!ENABLED) {
    return;
  }

  try {
    await cloudwatch.putMetricData({
      Namespace: NAMESPACE,
      MetricData: [
        {
          MetricName: "WorkerHeartbeat",
          Value: 1,
          Unit: "Count" as const,
          Timestamp: new Date(),
          Dimensions: [{ Name: "WorkerId", Value: WORKER_ID }],
        },
      ],
    });
  } catch (error) {
    console.error("[CloudWatch] Failed to publish heartbeat:", error);
  }
}

/**
 * Worker 시작 시 초기화 및 주기적 Heartbeat 전송
 */
export function startWorkerMetrics(): NodeJS.Timeout | null {
  if (!ENABLED) {
    return null;
  }

  console.log(`[CloudWatch] Worker metrics enabled (ID: ${WORKER_ID})`);

  // 즉시 한 번 전송
  publishWorkerHeartbeat();

  // 5분마다 Heartbeat 전송
  return setInterval(() => {
    publishWorkerHeartbeat();
  }, 300000);
}
