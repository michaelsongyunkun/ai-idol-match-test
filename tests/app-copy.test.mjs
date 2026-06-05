import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const readmeSource = readFileSync(new URL("../README.md", import.meta.url), "utf8");

describe("app handoff copy", () => {
  it("uses product naming that covers both quiz modes", () => {
    assert.match(layoutSource, /title:\s*"爱豆匹配测试"/);
    assert.doesNotMatch(layoutSource, /title:\s*"40题爱豆匹配测试"/);
  });

  it("documents the experience and professional quiz modes", () => {
    assert.match(readmeSource, /体验版[\s\S]*15题/);
    assert.match(readmeSource, /专业版[\s\S]*40题/);
  });
});
