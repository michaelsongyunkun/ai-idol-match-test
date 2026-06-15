import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDeepSeekMessages,
  mapDeepSeekStatusToError,
  parseDeepSeekCandidates,
  parseDeepSeekGeneratedResult,
  type DeepSeekCandidate
} from "../lib/deepseek.ts";

const candidates: DeepSeekCandidate[] = [
  {
    id: "idol-a",
    name: "测试爱豆 A",
    summary: "舞台型候选",
    score: 86,
    confidence: 82,
    tags: ["舞台型", "实力派"],
    matchedTags: ["舞台型"],
    entryReasons: ["舞台直拍"],
    dimensionScores: [{ label: "舞台", score: 8, matchedTags: ["舞台型"] }]
  },
  {
    id: "idol-b",
    name: "测试爱豆 B",
    summary: "作品型候选",
    score: 81,
    confidence: 76,
    tags: ["演员型"],
    matchedTags: ["演员型"],
    entryReasons: ["角色混剪"],
    dimensionScores: [{ label: "作品", score: 6, matchedTags: ["演员型"] }]
  }
];

describe("DeepSeek result contract", () => {
  it("builds a JSON-only prompt with candidate context", () => {
    const messages = buildDeepSeekMessages({
      modeName: "体验版",
      userTags: ["舞台型"],
      candidates
    });

    assert.match(messages[0].content, /JSON/);
    assert.match(messages[0].content, /不可信数据/);
    assert.match(messages[1].content, /idol-a/);
  });

  it("normalizes valid DeepSeek JSON and rejects unknown candidate ids", () => {
    const result = parseDeepSeekGeneratedResult(
      JSON.stringify({
        idolId: "idol-a",
        idolName: "测试爱豆 A",
        score: 120,
        confidence: 101,
        summary: "DeepSeek 生成总结",
        matchedTags: ["舞台型", "实力派"],
        reasons: ["理由 1", "理由 2"],
        entryPath: ["看直拍", "补舞台", "看采访"],
        dimensionScores: [{ label: "舞台", score: 99, matchedTags: ["舞台型"] }],
        top3: [
          { idolId: "idol-a", idolName: "测试爱豆 A", score: 120, difference: "主匹配" },
          { idolId: "idol-b", idolName: "测试爱豆 B", score: 80, difference: "作品向备选" }
        ]
      }),
      candidates
    );

    assert.equal(result?.idolId, "idol-a");
    assert.equal(result?.score, 99);
    assert.equal(result?.confidence, 100);
    assert.equal(result?.dimensionScores[0].score, 20);
    assert.equal(result?.top3.length, 2);

    assert.equal(parseDeepSeekGeneratedResult(JSON.stringify({ idolId: "missing" }), candidates), null);
  });

  it("sanitizes candidates and maps common DeepSeek error statuses", () => {
    const parsed = parseDeepSeekCandidates([
      { id: "idol-a", name: "测试爱豆 A", score: 88, confidence: 77, tags: ["舞台型"] },
      { id: "", name: "bad" }
    ]);

    assert.equal(parsed.length, 1);
    assert.equal(mapDeepSeekStatusToError(401).error.code, "DEEPSEEK_AUTH_FAILED");
    assert.equal(mapDeepSeekStatusToError(402).error.code, "DEEPSEEK_INSUFFICIENT_BALANCE");
    assert.equal(mapDeepSeekStatusToError(429).error.code, "DEEPSEEK_RATE_LIMITED");
  });
});
