import client from "prom-client";

// Initialize registry
export const register = new client.Registry();

// Add default metrics (cpu, memory, etc.)
client.collectDefaultMetrics({ register });

// 1. Queue Size by Status (Gauge)
export const queueSizeGauge = new client.Gauge({
  name: "crawling_queue_jobs",
  help: "Number of jobs in the crawling queue by status",
  labelNames: ["status"],
  registers: [register],
});

// 2. Job Duration (Histogram)
// request to process time is confusing. 
// User asked: "Time from crawling initial request to processing (completion?)"
// Interpretation: Loading (Enqueue) -> Completion.
// Also: "Crawling duration" (Processing Start -> Completion).
export const jobDurationHistogram = new client.Histogram({
  name: "crawling_job_duration_seconds",
  help: "Time spent processing a crawling job",
  labelNames: ["phase"], // 'processing' (actual work), 'total' (enqueue to complete)
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300],
  registers: [register],
});

// 3. Completed Count (Counter)
export const jobsCompletedCounter = new client.Counter({
  name: "crawling_jobs_completed_total",
  help: "Total number of completed crawling jobs",
  labelNames: ["status", "method"], // status: success, failed
  registers: [register],
});

// 4. Scheduled Jobs (Counter)
export const jobsScheduledCounter = new client.Counter({
  name: "crawling_jobs_scheduled_total",
  help: "Total number of crawling jobs scheduled",
  registers: [register],
});
