const fs = require("fs");

const urls = JSON.parse(fs.readFileSync("urls.json", "utf8"));

const TIMEOUT_MS = 5000;

async function checkUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const start = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    const latency = Date.now() - start;
    clearTimeout(timeout);

    return {
      url,
      healthy: response.ok,
      status: response.status,
      statusText: response.statusText,
      latencyMs: latency,
    };
  } catch (error) {
    clearTimeout(timeout);

    return {
      url,
      healthy: false,
      status: "ERROR",
      statusText: error.name === "AbortError" ? "Timeout" : "Failed",
      latencyMs: null,
    };
  }
}

async function main() {
  console.log("\nAPI Status Pulse\n");

  const results = [];

  for (const url of urls) {
    const result = await checkUrl(url);
    results.push(result);

    const icon = result.healthy ? "✅" : "❌";
    const latency = result.latencyMs === null ? "-" : `${result.latencyMs}ms`;

    console.log(
      `${icon} ${result.url.padEnd(45)} ${String(result.status).padEnd(8)} ${latency}`
    );
  }

  const healthyCount = results.filter((result) => result.healthy).length;

  console.log(`\nSummary: ${healthyCount}/${results.length} healthy\n`);

  fs.writeFileSync("report.json", JSON.stringify(results, null, 2));
  console.log("Saved report to report.json");
}

main();