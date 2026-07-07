const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSummary,
  buildJsonReport,
  buildMarkdownReport,
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