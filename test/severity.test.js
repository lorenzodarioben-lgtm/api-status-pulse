const test = require("node:test");
const assert = require("node:assert/strict");

const { getSeverity } = require("../src/severity");

test("returns OK for healthy endpoint under latency warning threshold", () => {
  const severity = getSeverity({
    healthy: true,
    statusOk: true,
    latencyOk: true,
    latencyMs: 100,
    maxLatencyMs: 1000,
  });

  assert.equal(severity, "OK");
});

test("returns WARNING for healthy endpoint near latency limit", () => {
  const severity = getSeverity({
    healthy: true,
    statusOk: true,
    latencyOk: true,
    latencyMs: 850,
    maxLatencyMs: 1000,
  });

  assert.equal(severity, "WARNING");
});

test("returns CRITICAL for unhealthy endpoint", () => {
  const severity = getSeverity({
    healthy: false,
    statusOk: false,
    latencyOk: true,
    latencyMs: 100,
    maxLatencyMs: 1000,
  });

  assert.equal(severity, "CRITICAL");
});

test("returns CRITICAL when latency exceeds limit", () => {
  const severity = getSeverity({
    healthy: false,
    statusOk: true,
    latencyOk: false,
    latencyMs: 1200,
    maxLatencyMs: 1000,
  });

  assert.equal(severity, "CRITICAL");
});

test("uses a check-specific latency warning ratio", () => {
  const severity = getSeverity({
    healthy: true,
    statusOk: true,
    latencyOk: true,
    latencyMs: 700,
    maxLatencyMs: 1000,
    warningLatencyRatio: 0.65,
  });

  assert.equal(severity, "WARNING");
});
