const fs = require("fs");
const path = require("path");

const REPORT_DIR = "reports";

function printResults(results) {
  console.log("\nAPI Status Pulse");
  console.log("Endpoint health monitor\n");

  for (const result of results) {
    const icon = getSeverityIcon(result.severity);
    const latency =
      result.latencyMs === null ? "-" : `${String(result.latencyMs).padStart(4)}ms`;

    const limit =
      result.maxLatencyMs === null ? "no limit" : `limit ${result.maxLatencyMs}ms`;

    console.log(`${icon} ${result.name}`);
    console.log(`   URL:      ${result.url}`);
    console.log(`   Status:   ${result.status} ${result.statusText}`);
    console.log(`   Latency:  ${latency} (${limit})`);
    console.log(`   Severity: ${result.severity ?? "UNKNOWN"}`);
    console.log(`   Attempt:  ${result.attempt}`);
    console.log(`   Result:   ${result.reason}\n`);
  }

  const summary = buildSummary(results);

  console.log(`Summary: ${summary.healthyCount}/${summary.totalCount} healthy`);
  console.log(`Severity: ${summary.okCount} OK, ${summary.warningCount} WARNING, ${summary.criticalCount} CRITICAL`);
  console.log(`Average latency: ${summary.averageLatencyMs === null ? "-" : `${summary.averageLatencyMs}ms`}`);
  console.log(`Overall status: ${summary.overallStatus}\n`);
}

function saveReports(results, reportDirectory = REPORT_DIR) {
  fs.mkdirSync(reportDirectory, { recursive: true });

  const jsonPath = path.join(reportDirectory, "report.json");
  const markdownPath = path.join(reportDirectory, "report.md");

  fs.writeFileSync(jsonPath, JSON.stringify(buildJsonReport(results), null, 2));
  fs.writeFileSync(markdownPath, buildMarkdownReport(results));

  return { jsonPath, markdownPath };
}

function buildSummary(results) {
  const healthyCount = results.filter((result) => result.healthy).length;
  const unhealthyCount = results.length - healthyCount;

  const okCount = results.filter((result) => result.severity === "OK").length;
  const warningCount = results.filter((result) => result.severity === "WARNING").length;
  const criticalCount = results.filter((result) => result.severity === "CRITICAL").length;

  const measuredResults = results.filter((result) => typeof result.latencyMs === "number");
  const totalLatency = measuredResults.reduce((sum, result) => sum + result.latencyMs, 0);

  const averageLatencyMs =
    measuredResults.length === 0 ? null : Math.round(totalLatency / measuredResults.length);

  return {
    generatedAt: new Date().toISOString(),
    totalCount: results.length,
    healthyCount,
    unhealthyCount,
    okCount,
    warningCount,
    criticalCount,
    averageLatencyMs,
    overallStatus: criticalCount === 0 ? "HEALTHY" : "DEGRADED",
  };
}

function buildJsonReport(results) {
  return {
    summary: buildSummary(results),
    checks: results,
  };
}

function buildMarkdownReport(results) {
  const summary = buildSummary(results);

  const rows = results
    .map((result) => {
      const health = result.healthy ? "Healthy" : "Unhealthy";
      const latency = result.latencyMs === null ? "-" : `${result.latencyMs}ms`;
      const severity = result.severity ?? "UNKNOWN";

      return `| ${result.name} | ${result.status} | ${latency} | ${severity} | ${health} | ${result.reason} |`;
    })
    .join("\n");

  const averageLatency =
    summary.averageLatencyMs === null ? "-" : `${summary.averageLatencyMs}ms`;

  return `# API Status Pulse Report

Generated at: ${summary.generatedAt}

Overall status: **${summary.overallStatus}**

Healthy endpoints: **${summary.healthyCount}/${summary.totalCount}**

Severity breakdown: **${summary.okCount} OK**, **${summary.warningCount} WARNING**, **${summary.criticalCount} CRITICAL**

Average latency: **${averageLatency}**

| Endpoint | Status Code | Latency | Severity | Health | Reason |
|---|---:|---:|---|---|---|
${rows}
`;
}

function getSeverityIcon(severity) {
  if (severity === "OK") {
    return "✅";
  }

  if (severity === "WARNING") {
    return "⚠️";
  }

  if (severity === "CRITICAL") {
    return "❌";
  }

  return "❓";
}

module.exports = {
  printResults,
  saveReports,
  buildSummary,
  buildJsonReport,
  buildMarkdownReport,
  getSeverityIcon,
};
