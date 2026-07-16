const fs = require("fs");

const { loadChecks } = require("./config");
const { checkEndpoint } = require("./checker");
const { runChecks } = require("./runner");
const { printResults, saveReports } = require("./report");

const DEFAULT_CONFIG_FILE = "checks.json";

function printHelp() {
  console.log(`
API Status Pulse

A lightweight endpoint health monitoring CLI.

Usage:
  node index.js [options]

Options:
  --config <file>          Use a custom checks config file
  --concurrency <count>    Limit simultaneously running endpoint checks
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

function getConfigFile(args) {
  const configArgIndex = args.indexOf("--config");

  if (configArgIndex !== -1 && args[configArgIndex + 1]) {
    return args[configArgIndex + 1];
  }

  return DEFAULT_CONFIG_FILE;
}

function getConcurrency(args) {
  const concurrencyArgIndex = args.indexOf("--concurrency");

  if (concurrencyArgIndex === -1) {
    return undefined;
  }

  const value = Number(args[concurrencyArgIndex + 1]);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error("--concurrency must be a positive integer.");
  }

  return value;
}

async function runCli(args = process.argv.slice(2)) {
  try {
    if (args.includes("--help")) {
      printHelp();
      return;
    }

    if (args.includes("--version")) {
      printVersion();
      return;
    }

    const shouldFailOnUnhealthy = args.includes("--fail-on-unhealthy");
    const configFile = getConfigFile(args);
    const concurrency = getConcurrency(args);

    const checks = loadChecks(configFile);
    const results = await runChecks(checks, checkEndpoint, concurrency);

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

module.exports = {
  runCli,
  printHelp,
  printVersion,
  getConfigFile,
  getConcurrency,
};
