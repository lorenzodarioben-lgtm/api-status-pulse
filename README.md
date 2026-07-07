# API Status Pulse

A lightweight Node.js CLI for monitoring endpoint health, response status, latency, and basic service reliability.

This project simulates a small DevOps-style health check tool. It reads endpoint checks from a JSON config file, validates each response against expected status codes and latency limits, retries failed checks, and exports machine-readable and human-readable reports.

## Features

- Config-driven endpoint checks
- Expected HTTP status validation
- Latency threshold validation
- Retry support for unstable endpoints
- Timeout handling
- Concurrent checks
- Terminal health summary
- JSON report export
- Markdown report export
- Optional CI-friendly failure mode

## Tech Stack

- Node.js
- JavaScript
- JSON
- GitHub Actions-ready CLI workflow

## Project Structure

```txt
api-status-pulse/
├─ index.js
├─ checks.json
├─ package.json
├─ reports/
│  ├─ report.json
│  └─ report.md
└─ README.md