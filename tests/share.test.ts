import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildShareText } from "../lib/share.ts";

describe("share text", () => {
  it("builds a compact shareable idol match result", () => {
    const text = buildShareText({
      modeName: "体验版",
      idolName: "王一博",
      score: 88,
      tags: ["清冷", "舞台型", "实力派"]
    });

    assert.match(text, /爱豆匹配测试/);
    assert.match(text, /体验版/);
    assert.match(text, /王一博/);
    assert.match(text, /88/);
    assert.ok(text.length <= 120);
  });
});
