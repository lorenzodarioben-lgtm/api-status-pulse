const test = require("node:test");
const assert = require("node:assert/strict");

const { getExpectedHeaderChecks } = require("../src/checker");

test("evaluates configured response header expectations", () => {
  const checks = getExpectedHeaderChecks(
    new Headers({ "content-type": "application/json", "x-service-state": "ready" }),
    { "content-type": "application/json", "x-service-state": "ready" },
  );

  assert.deepEqual(checks, [
    {
      name: "content-type",
      expectedValue: "application/json",
      actualValue: "application/json",
      matches: true,
    },
    {
      name: "x-service-state",
      expectedValue: "ready",
      actualValue: "ready",
      matches: true,
    },
  ]);
});
