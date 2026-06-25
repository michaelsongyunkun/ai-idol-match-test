import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const readmeSource = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const componentSource = readFileSync(new URL("../components/IdolMatchTest.tsx", import.meta.url), "utf8");

describe("app handoff copy", () => {
  it("uses product naming that covers both quiz modes", () => {
    assert.match(layoutSource, /title:\s*"爱豆匹配测试"/);
    assert.doesNotMatch(layoutSource, /title:\s*"40题爱豆匹配测试"/);
  });

  it("documents the experience and professional quiz modes", () => {
    assert.match(readmeSource, /体验版[\s\S]*15题/);
    assert.match(readmeSource, /专业版[\s\S]*40题/);
  });

  it("surfaces match diagnostics on the result page", () => {
    assert.match(componentSource, /MATCH MAP/);
    assert.match(componentSource, /dimensionScores/);
    assert.match(componentSource, /dimension-track/);
  });

  it("offers a copyable share result action", () => {
    assert.match(componentSource, /buildShareText/);
    assert.match(componentSource, /复制结果/);
    assert.match(componentSource, /下载海报/);
    assert.match(componentSource, /share-poster/);
  });

  it("requires compatible API connection before starting the quiz", () => {
    assert.match(componentSource, /deepSeekApiKey/);
    assert.match(componentSource, /connectDeepSeek/);
    assert.match(componentSource, /disabled=\{!isDeepSeekConnected\}/);
  });

  it("lets users choose GPT-compatible, Gemini, or Anthropic providers", () => {
    assert.match(componentSource, /aiProviderOptions/);
    assert.match(componentSource, /GPT \/ OpenAI-compatible/);
    assert.match(componentSource, /compatible-api-provider/);
    assert.match(componentSource, /provider:\s*aiProvider/);
  });

  it("lets users choose Base URL and model presets while keeping custom values", () => {
    assert.match(componentSource, /compatible-api-base-url-preset/);
    assert.match(componentSource, /compatible-api-model-preset/);
    assert.match(componentSource, /customApiPresetId/);
    assert.match(componentSource, /自定义 Base URL/);
    assert.match(componentSource, /自定义模型/);
  });

  it("surfaces result growth features for comparison, entry path, and history", () => {
    assert.match(componentSource, /displayTopMatches/);
    assert.match(componentSource, /entry-path-inline/);
    assert.match(componentSource, /entry-card-list/);
    assert.match(componentSource, /收藏与历史/);
    assert.match(componentSource, /toggleCurrentFavorite/);
  });

  it("locks the idol match locally and uses compatible API for analysis copy", () => {
    assert.match(componentSource, /generateDeepSeekMatchResult/);
    assert.match(componentSource, /api\/compatible-result/);
    assert.match(componentSource, /fixedIdolId/);
    assert.match(componentSource, /固定匹配/);
  });
});
