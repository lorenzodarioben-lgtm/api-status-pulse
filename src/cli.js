const fs = require("fs");

const { loadChecks, filterEnabledChecks, filterChecksByTags } = require("./config");
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
  --tag <tag>              Run checks matching a tag (repeatable)
  --dry-run                Validate and preview selected checks without requests
  --validate-config        Validate config and exit without requests
  --output-dir <directory> Write reports to a custom directory
  --no-report              Do not write report files
  --format <text|json>     Choose terminal output format
  --fail-on-unhealthy      Exit with code 1 if any endpoint is unhealthy
  --fail-on-warning        Exit with code 1 for warnings or critical results
  --max-unhealthy <count>  Permit up to this many unhealthy checks
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
  const values = getOptionValues(args, optionName);

  if (values.length > 1) {
    throw new Error(`${optionName} can only be provided once.`);
  }

  return values[0];
}

function getOptionValues(args, optionName) {
  const values = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== optionName) {
      continue;
    }

    const value = args[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`${optionName} requires a value.`);
    }

    values.push(value);
    index += 1;
  }

  return values;
}

function getTags(args) {
  return getOptionValues(args, "--tag");
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

function getMaxUnhealthy(args) {
  const rawValue = getOptionValue(args, "--max-unhealthy");

  if (rawValue === undefined) {
    return undefined;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error("--max-unhealthy must be a non-negative integer.");
  }

  return value;
}

function getOutputFormat(args) {
  const format = getOptionValue(args, "--format") ?? "text";

  if (!["text", "json"].includes(format)) {
    throw new Error("--format must be either text or json.");
  }

  return format;
}

function buildRunPlan(checks, { configFile, tags, concurrency }) {
  return {
    configFile,
    selectedCount: checks.length,
    tags,
    concurrency: concurrency ?? checks.length,
    checks: checks.map((check) => ({
      name: check.name,
      method: check.method,
      url: check.url,
      tags: check.tags ?? [],
    })),
  };
}

function printRunPlan(plan) {
  console.log(`\nDry run: ${plan.selectedCount} selected endpoint checks`);
  console.log(`Config: ${plan.configFile}`);
  console.log(`Concurrency: ${plan.concurrency}\n`);

  for (const check of plan.checks) {
    const tags = check.tags.length === 0 ? "" : ` [${check.tags.join(", ")}]`;
    console.log(`${check.name}${tags}`);
    console.log(`   ${check.method} ${check.url}`);
  }
}

function buildConfigSummary(checks, configFile) {
  const enabledCount = checks.filter((check) => check.enabled !== false).length;

  return {
    configFile,
    totalCount: checks.length,
    enabledCount,
    disabledCount: checks.length - enabledCount,
    taggedCount: checks.filter((check) => check.tags?.length > 0).length,
  };
}

function printConfigSummary(summary) {
  console.log(`\nConfig is valid: ${summary.configFile}`);
  console.log(`Checks: ${summary.totalCount} total, ${summary.enabledCount} enabled, ${summary.disabledCount} disabled`);
  console.log(`Tagged checks: ${summary.taggedCount}`);
}

function getExitCode(results, { shouldFailOnUnhealthy, shouldFailOnWarning, maxUnhealthy }) {
  if (shouldFailOnWarning && results.some((result) => result.severity !== "OK")) {
    return 1;
  }

  if (shouldFailOnUnhealthy && results.some((result) => !result.healthy)) {
    return 1;
  }

  if (maxUnhealthy !== undefined && results.filter((result) => !result.healthy).length > maxUnhealthy) {
    return 1;
  }

  return 0;
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
    const shouldFailOnWarning = args.includes("--fail-on-warning");
    const maxUnhealthy = getMaxUnhealthy(args);
    const configFile = getConfigFile(args);
    const concurrency = getConcurrency(args);
    const outputDirectory = getOutputDirectory(args);
    const shouldSkipReports = args.includes("--no-report");
    const outputFormat = getOutputFormat(args);
    const tags = getTags(args);
    const shouldDryRun = args.includes("--dry-run");
    const shouldValidateConfig = args.includes("--validate-config");

    const configuredChecks = loadChecks(configFile);

    if (shouldValidateConfig) {
      const summary = buildConfigSummary(configuredChecks, configFile);

      if (outputFormat === "json") {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printConfigSummary(summary);
      }

      return;
    }

    const checks = filterChecksByTags(filterEnabledChecks(configuredChecks), tags);

    if (checks.length === 0) {
      const selection = tags.length === 0 ? "" : ` matching tags: ${tags.join(", ")}`;
      throw new Error(`No enabled endpoint checks were found${selection}.`);
    }

    if (shouldDryRun) {
      const plan = buildRunPlan(checks, { configFile, tags, concurrency });

      if (outputFormat === "json") {
        console.log(JSON.stringify(plan, null, 2));
      } else {
        printRunPlan(plan);
      }

      return;
    }

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

    process.exitCode = getExitCode(results, { shouldFailOnUnhealthy, shouldFailOnWarning, maxUnhealthy });
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
  getOptionValues,
  getConcurrency,
  getOutputDirectory,
  getMaxUnhealthy,
  getOutputFormat,
  getTags,
  buildRunPlan,
  printRunPlan,
  buildConfigSummary,
  printConfigSummary,
  getExitCode,
};
