const fs = require("fs");
const path = require("path");

const REPORT_DIR = "reports";

function printResults(results) {
  console.log("\nAPI Status Pulse");
  console.log("Endpoint health monitor\n");

  for (const result of results) {
    const icon = result.healthy ? "✅" : "❌";
    const latency =
      result.latencyMs === null ? "-" : `${String(result.latencyMs).padStart(4)}ms`;

    const limit =
      result.maxLatencyMs === null ? "no limit" : `limit ${result.maxLatencyMs}ms`;

    console.log(`${icon} ${result.name}`);
    console.log(`   URL:     ${result.url}`);
    console.log(`   Status:  ${result.status} ${result.statusText}`);
    console.log(`   Latency: ${latency} (${limit})`);
    console.log(`   Attempt: ${result.attempt}`);
    console.log(`   Result:  ${result.reason}\n`);
  }

  const summary = buildSummary(results);

  console.log(`Summary: ${summary.healthyCount}/${summary.totalCount} healthy`);
  console.log(`Overall status: ${summary.overallStatus}\n`);
}

function saveReports(results) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const jsonPath = path.join(REPORT_DIR, "report.json");
  const markdownPath = path.join(REPORT_DIR, "report.md");

  fs.writeFileSync(jsonPath, JSON.stringify(buildJsonReport(results), null, 2));
  fs.writeFileSync(markdownPath, buildMarkdownReport(results));

  console.log(`Saved JSON report to ${jsonPath}`);
  console.log(`Saved Markdown report to ${markdownPath}`);
}

function buildSummary(results) {
  const healthyCount = results.filter((result) => result.healthy).length;
  const unhealthyCount = results.length - healthyCount;
  const totalLatency = results
    .filter((result) => typeof result.latencyMs === "number")
    .reduce((sum, result) => sum + result.latencyMs, 0);

  const measuredCount = results.filter((result) => typeof result.latencyMs === "number").length;

  const averageLatencyMs =
    measuredCount === 0 ? null : Math.round(totalLatency / measuredCount);

  return {
    generatedAt: new Date().toISOString(),
    totalCount: results.length,
    healthyCount,
    unhealthyCount,
    averageLatencyMs,
    overallStatus: unhealthyCount === 0 ? "HEALTHY" : "DEGRADED",
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
      const status = result.healthy ? "Healthy" : "Unhealthy";
      const latency = result.latencyMs === null ? "-" : `${result.latencyMs}ms`;

      return `| ${result.name} | ${result.status} | ${latency} | ${status} | ${result.reason} |`;
    })
    .join("\n");

  const averageLatency =
    summary.averageLatencyMs === null ? "-" : `${summary.averageLatencyMs}ms`;

  return `# API Status Pulse Report

Generated at: ${summary.generatedAt}

Overall status: **${summary.overallStatus}**

Healthy endpoints: **${summary.healthyCount}/${summary.totalCount}**

Average latency: **${averageLatency}**

| Endpoint | Status Code | Latency | Result | Reason |
|---|---:|---:|---|---|
${rows}
`;
}

module.exports = {
  printResults,
  saveReports,
  buildSummary,
  buildJsonReport,
  buildMarkdownReport,
};