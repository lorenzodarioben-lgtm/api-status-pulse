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
    reason: "Healthy",
  },
  {
    name: "Slow API",
    url: "https://slow.example.com",
    status: 200,
    latencyMs: 900,
    healthy: false,
    reason: "Latency 900ms exceeded limit of 500ms",
  },
];

test("buildSummary returns health counts and average latency", () => {
  const summary = buildSummary(sampleResults);

  assert.equal(summary.totalCount, 2);
  assert.equal(summary.healthyCount, 1);
  assert.equal(summary.unhealthyCount, 1);
  assert.equal(summary.averageLatencyMs, 500);
  assert.equal(summary.overallStatus, "DEGRADED");
});

test("buildJsonReport returns summary and checks", () => {
  const report = buildJsonReport(sampleResults);

  assert.equal(report.summary.totalCount, 2);
  assert.equal(report.checks.length, 2);
});

test("buildMarkdownReport includes status summary", () => {
  const markdown = buildMarkdownReport(sampleResults);

  assert.match(markdown, /API Status Pulse Report/);
  assert.match(markdown, /Overall status: \*\*DEGRADED\*\*/);
  assert.match(markdown, /Healthy endpoints: \*\*1\/2\*\*/);
  assert.match(markdown, /Average latency: \*\*500ms\*\*/);
});