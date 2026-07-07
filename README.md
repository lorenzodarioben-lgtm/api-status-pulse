# API Status Pulse
![CI](https://github.com/lorenzodarioben-lgtm/api-status-pulse/actions/workflows/ci.yml/badge.svg)

A lightweight Node.js CLI for monitoring endpoint health, response status, latency, and basic service reliability.

This project simulates a small DevOps-style health check tool. It reads endpoint checks from a JSON config file, validates each response against expected status codes and latency limits, retries failed checks, classifies endpoint severity, and exports machine-readable and human-readable reports.

## Features

* Config-driven endpoint checks
* Expected HTTP status validation
* Latency threshold validation
* Timeout handling
* Retry support for unstable endpoints
* Concurrent endpoint checks
* SLO-style severity classification
* OK, WARNING, and CRITICAL endpoint states
* Severity breakdown in generated reports
* Terminal health summary
* Structured JSON report export
* Markdown report export
* Optional CI-friendly failure mode
* Automated config validation tests
* Automated CLI tests
* Unit-tested report generation
* Modular source structure
* GitHub Actions CI workflow
* Dockerized CLI runtime
* Docker image build validation in CI

## Tech Stack

* Node.js
* JavaScript
* JSON
* Docker
* GitHub Actions
* Node test runner

## Project Structure

```txt
api-status-pulse/
├─ Dockerfile
├─ .dockerignore
├─ .gitignore
├─ index.js
├─ checks.json
├─ package.json
├─ src/
│  ├─ cli.js
│  ├─ config.js
│  ├─ checker.js
│  ├─ report.js
│  └─ severity.js
├─ test/
│  ├─ cli.test.js
│  ├─ config.test.js
│  ├─ report.test.js
│  └─ severity.test.js
├─ reports/
│  ├─ report.json
│  └─ report.md
├─ .github/
│  └─ workflows/
│     └─ ci.yml
└─ README.md
```

## How It Works

API Status Pulse reads endpoint definitions from `checks.json`.

Each check defines:

* Endpoint name
* URL
* HTTP method
* Expected status codes
* Timeout limit
* Maximum acceptable latency
* Retry count

The CLI sends requests to each endpoint, measures latency, validates the response, classifies the result, prints a terminal summary, and writes reports to the `reports/` folder.

## Example Config

```json
[
  {
    "name": "GitHub API",
    "url": "https://api.github.com",
    "method": "GET",
    "expectedStatus": [200],
    "timeoutMs": 5000,
    "maxLatencyMs": 1500,
    "retries": 1
  },
  {
    "name": "NPM Registry",
    "url": "https://registry.npmjs.org/-/ping",
    "method": "GET",
    "expectedStatus": [200],
    "timeoutMs": 5000,
    "maxLatencyMs": 1500,
    "retries": 1
  }
]
```

## Severity Levels

Each endpoint is classified into one of three severity levels:

```txt
OK        Endpoint is healthy and latency is safely below the limit
WARNING   Endpoint is healthy, but latency is close to the limit
CRITICAL  Endpoint failed, timed out, returned the wrong status, or exceeded the latency limit
```

This gives the tool a more realistic monitoring-style output instead of only returning pass or fail.

## How to Run

Run the health monitor:

```bash
npm run start
```

Or run it directly:

```bash
node index.js
```

## Example Configurations

This project includes sample endpoint configuration files in the `examples/` directory.

### Basic checks

The basic config uses relaxed latency thresholds for general endpoint monitoring.

```bash
npm run start:basic

## CLI Options

```txt
Usage:
  node index.js [options]

Options:
  --config <file>          Use a custom checks config file
  --fail-on-unhealthy      Exit with code 1 if any endpoint is unhealthy
  --version                Print the current version
  --help                   Show this help message
```

## Useful Commands

```bash
npm run start
npm run check
npm run test
npm run syntax
npm run help
npm run version
```

## CI-Friendly Mode

The CLI can return a failing exit code if one or more endpoints are unhealthy.

```bash
npm run check
```

This is useful for CI/CD pipelines where failed health checks should block deployment or alert the team.

## Testing

Run the automated test suite:

```bash
npm run test
```

The tests validate:

* Endpoint configuration shape
* Required fields
* Unique endpoint names
* Unique endpoint URLs
* Valid HTTP status code ranges
* Timeout values
* Retry settings
* CLI help output
* CLI version output
* Report summary generation
* Markdown report generation
* Severity classification logic

## Syntax Check

Validate JavaScript syntax:

```bash
npm run syntax
```

## Docker

Build the Docker image:

```bash
docker build -t api-status-pulse .
```

Run the container:

```bash
docker run --rm api-status-pulse
```

Or use the npm scripts:

```bash
npm run docker:build
npm run docker:run
```

## Reports

Each run generates reports in the `reports/` folder.

```txt
reports/
├─ report.json
└─ report.md
```

The JSON report is useful for scripts, automation, and CI/CD workflows.

The Markdown report is useful for human-readable evidence, documentation, and GitHub review.

## Example Output

```txt
API Status Pulse
Endpoint health monitor

✅ GitHub API
   URL:      https://api.github.com
   Status:   200 OK
   Latency:  210ms (limit 1500ms)
   Severity: OK
   Attempt:  1
   Result:   Healthy

⚠️ NPM Registry
   URL:      https://registry.npmjs.org/-/ping
   Status:   200 OK
   Latency:  1250ms (limit 1500ms)
   Severity: WARNING
   Attempt:  1
   Result:   Healthy

Summary: 2/2 healthy
Severity: 1 OK, 1 WARNING, 0 CRITICAL
Average latency: 730ms
Overall status: HEALTHY

Saved JSON report to reports/report.json
Saved Markdown report to reports/report.md
```

## GitHub Actions CI

This project includes a GitHub Actions workflow that runs on pushes and pull requests to `main`.

The CI workflow:

* Checks out the repository
* Sets up Node.js
* Validates JavaScript syntax
* Runs automated tests
* Runs the health monitor
* Builds the Docker image

This helps confirm that the project works consistently in a clean environment.

## Why This Project Matters

Modern backend and cloud systems rely on health checks, monitoring, latency thresholds, retries, automated testing, containerization, and CI/CD validation.

This project demonstrates those concepts in a small but practical CLI tool. It is intentionally lightweight, but it reflects real ideas used in production systems, including service health validation, failure detection, SLO-style severity classification, report generation, Dockerized execution, and CI-compatible exit codes.

## What I Learned

While building this project, I practised:

* Building a Node.js CLI
* Reading and validating JSON configuration
* Measuring endpoint latency
* Handling request failures and timeouts
* Implementing retry logic
* Creating structured reports
* Writing automated tests with Node's built-in test runner
* Splitting a script into maintainable modules
* Adding GitHub Actions CI
* Containerizing a CLI with Docker

## Future Improvements

Possible future improvements include:

* Historical uptime tracking
* CSV report export
* Slack or Discord alert integration
* Scheduled monitoring mode
* Configurable warning thresholds
* HTML dashboard output
* GitHub Actions artifact upload for generated reports
