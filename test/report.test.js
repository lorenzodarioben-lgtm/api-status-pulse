const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  buildSummary,
  buildJsonReport,
  buildMarkdownReport,
  buildCsvReport,
  saveReports,
} = require("../src/report");

const sampleResults = [
  {
    name: "Healthy API",
    url: "https://example.com",
    status: 200,
    latencyMs: 100,
    healthy: true,
    severity: "OK",
    reason: "Healthy",
  },
  {
    name: "Slow API",
    url: "https://slow.example.com",
    status: 200,
    latencyMs: 850,
    healthy: true,
    severity: "WARNING",
    reason: "Healthy",
  },
  {
    name: "Failed API",
    url: "https://failed.example.com",
    status: "ERROR",
    latencyMs: null,
    healthy: false,
    severity: "CRITICAL",
    reason: "Request failed",
  },
];

test("buildSummary returns health counts and average latency", () => {
  const summary = buildSummary(sampleResults);

  assert.equal(summary.totalCount, 3);
  assert.equal(summary.healthyCount, 2);
  assert.equal(summary.unhealthyCount, 1);
  assert.equal(summary.okCount, 1);
  assert.equal(summary.warningCount, 1);
  assert.equal(summary.criticalCount, 1);
  assert.equal(summary.averageLatencyMs, 475);
  assert.equal(summary.overallStatus, "DEGRADED");
});

test("buildJsonReport returns summary and checks", () => {
  const report = buildJsonReport(sampleResults);

  assert.equal(report.summary.totalCount, 3);
  assert.equal(report.summary.warningCount, 1);
  assert.equal(report.summary.criticalCount, 1);
  assert.equal(report.checks.length, 3);
});

test("buildMarkdownReport includes severity summary", () => {
  const markdown = buildMarkdownReport(sampleResults);

  assert.match(markdown, /API Status Pulse Report/);
  assert.match(markdown, /Overall status: \*\*DEGRADED\*\*/);
  assert.match(markdown, /Healthy endpoints: \*\*2\/3\*\*/);
  assert.match(markdown, /Severity breakdown:/);
  assert.match(markdown, /Average latency: \*\*475ms\*\*/);
  assert.match(markdown, /\| Endpoint \| Status Code \| Latency \| Severity \| Health \| Reason \|/);
});

test("saveReports writes to a caller-provided directory", () => {
  const reportDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "api-status-pulse-"));
  const paths = saveReports(sampleResults, reportDirectory);

  assert.equal(paths.jsonPath, path.join(reportDirectory, "report.json"));
  assert.equal(paths.markdownPath, path.join(reportDirectory, "report.md"));
  assert.equal(paths.csvPath, path.join(reportDirectory, "report.csv"));
  assert.ok(fs.existsSync(paths.jsonPath));
  assert.ok(fs.existsSync(paths.markdownPath));
  assert.ok(fs.existsSync(paths.csvPath));
});

test("buildCsvReport produces escaped, tabular output", () => {
  const csv = buildCsvReport([
    { ...sampleResults[0], method: "GET", attempt: 1, reason: "Healthy, stable \"service\"" },
  ]);

  assert.match(csv, /^name,url,method,status,latencyMs,severity,healthy,attempt,reason/m);
  assert.match(csv, /"Healthy, stable ""service"""/);
});
