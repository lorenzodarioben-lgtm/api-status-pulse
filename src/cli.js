const fs = require("fs");

const { loadChecks } = require("./config");
const { checkEndpoint } = require("./checker");
const { runChecks } = require("./runner");
const { printResults, saveReports, buildJsonReport } = require("./report");

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
  --output-dir <directory> Write reports to a custom directory
  --no-report              Do not write report files
  --format <text|json>     Choose terminal output format
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
  return getOptionValue(args, "--config") ?? DEFAULT_CONFIG_FILE;
}

function getOptionValue(args, optionName) {
  const optionIndex = args.indexOf(optionName);

  if (optionIndex === -1) {
    return undefined;
  }

  const value = args[optionIndex + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${optionName} requires a value.`);
  }

  return value;
}

function getConcurrency(args) {
  const rawValue = getOptionValue(args, "--concurrency");

  if (rawValue === undefined) {
    return undefined;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error("--concurrency must be a positive integer.");
  }

  return value;
}

function getOutputDirectory(args) {
  return getOptionValue(args, "--output-dir");
}

function getOutputFormat(args) {
  const format = getOptionValue(args, "--format") ?? "text";

  if (!["text", "json"].includes(format)) {
    throw new Error("--format must be either text or json.");
  }

  return format;
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
    const outputDirectory = getOutputDirectory(args);
    const shouldSkipReports = args.includes("--no-report");
    const outputFormat = getOutputFormat(args);

    const checks = loadChecks(configFile);
    const results = await runChecks(checks, checkEndpoint, concurrency);

    if (outputFormat === "text") {
      printResults(results);
    }

    if (!shouldSkipReports) {
      const reportPaths = saveReports(results, outputDirectory);

      if (outputFormat === "text") {
        console.log(`Saved JSON report to ${reportPaths.jsonPath}`);
        console.log(`Saved Markdown report to ${reportPaths.markdownPath}`);
        console.log(`Saved CSV report to ${reportPaths.csvPath}`);
        console.log(`Saved JUnit report to ${reportPaths.junitPath}`);
      }
    }

    if (outputFormat === "json") {
      console.log(JSON.stringify(buildJsonReport(results), null, 2));
    }

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
  getOptionValue,
  getConcurrency,
  getOutputDirectory,
  getOutputFormat,
};
