#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG_FILE = "checks.json";
const REPORT_DIR = "reports";

const args = process.argv.slice(2);

const shouldFailOnUnhealthy = args.includes("--fail-on-unhealthy");

const configArgIndex = args.indexOf("--config");
const configFile =
  configArgIndex !== -1 && args[configArgIndex + 1]
    ? args[configArgIndex + 1]
    : DEFAULT_CONFIG_FILE;

function printHelp() {
  console.log(`
API Status Pulse

A lightweight endpoint health monitoring CLI.

Usage:
  node index.js [options]

Options:
  --config <file>          Use a custom checks config file
  --fail-on-unhealthy      Exit with code 1 if any endpoint is unhealthy
  --version                Print the current version
  --help                   Show this help message

Examples:
  node index.js
  node index.js --config checks.json
  node index.js --fail-on-unhealthy
`);
}

function printVersion() {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  console.log(packageJson.version);
}

function loadChecks(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const checks = JSON.parse(raw);

  if (!Array.isArray(checks)) {
    throw new Error("Config file must contain an array of checks.");
  }

  validateChecks(checks);

  return checks;
}

function validateChecks(checks) {
  for (const check of checks) {
    if (!check.name || typeof check.name !== "string") {
      throw new Error("Each check must have a non-empty name.");
    }

    if (!check.url || typeof check.url !== "string") {
      throw new Error(`Check "${check.name}" must have a URL.`);
    }

    if (!check.url.startsWith("https://")) {
      throw new Error(`Check "${check.name}" must use an HTTPS URL.`);
    }

    if (!Array.isArray(check.expectedStatus)) {
      throw new Error(`Check "${check.name}" must define expectedStatus as an array.`);
    }

    if (typeof check.timeoutMs !== "number" || check.timeoutMs <= 0) {
      throw new Error(`Check "${check.name}" must define a positive timeoutMs value.`);
    }

    if (typeof check.maxLatencyMs !== "number" || check.maxLatencyMs <= 0) {
      throw new Error(`Check "${check.name}" must define a positive maxLatencyMs value.`);
    }
  }
}

async function checkEndpoint(check) {
  const retries = check.retries ?? 0;
  let lastResult = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const result = await runSingleAttempt(check, attempt);
    lastResult = result;

    if (result.healthy) {
      return result;
    }
  }

  return lastResult;
}

async function runSingleAttempt(check, attempt) {
  const controller = new AbortController();
  const timeoutMs = check.timeoutMs ?? 5000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const start = Date.now();

  try {
    const response = await fetch(check.url, {
      method: check.method ?? "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "api-status-pulse",
      },
    });

    const latencyMs = Date.now() - start;
    clearTimeout(timeout);

    const expectedStatuses = check.expectedStatus ?? [200];
    const statusOk = expectedStatuses.includes(response.status);
    const latencyOk =
      typeof check.maxLatencyMs === "number"
        ? latencyMs <= check.maxLatencyMs
        : true;

    const healthy = statusOk && latencyOk;

    return {
      name: check.name,
      url: check.url,
      method: check.method ?? "GET",
      status: response.status,
      statusText: response.statusText,
      latencyMs,
      maxLatencyMs: check.maxLatencyMs ?? null,
      attempt,
      healthy,
      reason: getReason(statusOk, latencyOk, response.status, latencyMs, check),
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    clearTimeout(timeout);

    return {
      name: check.name,
      url: check.url,
      method: check.method ?? "GET",
      status: "ERROR",
      statusText: error.name === "AbortError" ? "Timeout" : "Request failed",
      latencyMs: null,
      maxLatencyMs: check.maxLatencyMs ?? null,
      attempt,
      healthy: false,
      reason: error.name === "AbortError" ? "Request timed out" : error.message,
      checkedAt: new Date().toISOString(),
    };
  }
}

function getReason(statusOk, latencyOk, status, latencyMs, check) {
  if (!statusOk) {
    return `Unexpected status code: ${status}`;
  }

  if (!latencyOk) {
    return `Latency ${latencyMs}ms exceeded limit of ${check.maxLatencyMs}ms`;
  }

  return "Healthy";
}

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

  const healthyCount = results.filter((result) => result.healthy).length;
  const totalCount = results.length;

  console.log(`Summary: ${healthyCount}/${totalCount} healthy`);

  if (healthyCount === totalCount) {
    console.log("Overall status: HEALTHY\n");
  } else {
    console.log("Overall status: DEGRADED\n");
  }
}

function saveReports(results) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const jsonPath = path.join(REPORT_DIR, "report.json");
  const markdownPath = path.join(REPORT_DIR, "report.md");

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  fs.writeFileSync(markdownPath, buildMarkdownReport(results));

  console.log(`Saved JSON report to ${jsonPath}`);
  console.log(`Saved Markdown report to ${markdownPath}`);
}

function buildMarkdownReport(results) {
  const healthyCount = results.filter((result) => result.healthy).length;
  const totalCount = results.length;
  const overallStatus = healthyCount === totalCount ? "HEALTHY" : "DEGRADED";

  const rows = results
    .map((result) => {
      const status = result.healthy ? "Healthy" : "Unhealthy";
      const latency = result.latencyMs === null ? "-" : `${result.latencyMs}ms`;

      return `| ${result.name} | ${result.status} | ${latency} | ${status} | ${result.reason} |`;
    })
    .join("\n");

  return `# API Status Pulse Report

Generated at: ${new Date().toISOString()}

Overall status: **${overallStatus}**

Healthy endpoints: **${healthyCount}/${totalCount}**

| Endpoint | Status Code | Latency | Result | Reason |
|---|---:|---:|---|---|
${rows}
`;
}

async function main() {
  try {
    if (args.includes("--help")) {
      printHelp();
      return;
    }

    if (args.includes("--version")) {
      printVersion();
      return;
    }

    const checks = loadChecks(configFile);
    const results = await Promise.all(checks.map(checkEndpoint));

    printResults(results);
    saveReports(results);

    const unhealthyCount = results.filter((result) => !result.healthy).length;

    if (shouldFailOnUnhealthy && unhealthyCount > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("\nFailed to run API Status Pulse");
    console.error(error.message);
    process.exitCode = 1;
  }
}

main();