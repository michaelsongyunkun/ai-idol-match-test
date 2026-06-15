import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { POST as connectPost } from "../app/api/deepseek-connect/route.ts";
import { POST as resultPost } from "../app/api/deepseek-result/route.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("DeepSeek API routes", () => {
  it("validates a user-supplied API key through the models endpoint", async () => {
    let authorization = "";
    globalThis.fetch = (async (_url, init) => {
      authorization = String(init?.headers ? (init.headers as Record<string, string>).Authorization : "");
      return Response.json({
        object: "list",
        data: [{ id: "deepseek-v4-flash", object: "model", owned_by: "deepseek" }]
      });
    }) as typeof fetch;

    const response = await connectPost(
      new Request("http://localhost/api/deepseek-connect", {
        method: "POST",
        body: JSON.stringify({ apiKey: "sk-test" })
      })
    );
    const payload = (await response.json()) as { connected?: boolean; model?: string; apiKey?: string };

    assert.equal(response.status, 200);
    assert.equal(payload.connected, true);
    assert.equal(payload.model, "deepseek-v4-flash");
    assert.equal(payload.apiKey, undefined);
    assert.equal(authorization, "Bearer sk-test");
  });

  it("maps DeepSeek authentication failures without exposing the key", async () => {
    globalThis.fetch = (async () =>
      Response.json({ error: { message: "bad key" } }, { status: 401 })) as typeof fetch;

    const response = await connectPost(
      new Request("http://localhost/api/deepseek-connect", {
        method: "POST",
        body: JSON.stringify({ apiKey: "sk-bad" })
      })
    );
    const payload = (await response.json()) as { error?: { code?: string }; apiKey?: string };

    assert.equal(response.status, 401);
    assert.equal(payload.error?.code, "DEEPSEEK_AUTH_FAILED");
    assert.equal(payload.apiKey, undefined);
  });

  it("returns a structured error when DeepSeek cannot be reached", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const response = await connectPost(
      new Request("http://localhost/api/deepseek-connect", {
        method: "POST",
        body: JSON.stringify({ apiKey: "sk-test" })
      })
    );
    const payload = (await response.json()) as { error?: { code?: string; message?: string } };

    assert.equal(response.status, 502);
    assert.equal(payload.error?.code, "DEEPSEEK_NETWORK_ERROR");
    assert.doesNotMatch(payload.error?.message ?? "", /network down/);
  });

  it("generates a structured result through DeepSeek chat completions", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_url, init) => {
      requestBody = String(init?.body ?? "");
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                idolId: "idol-a",
                idolName: "测试爱豆 A",
                score: 90,
                confidence: 84,
                summary: "DeepSeek 生成结果",
                matchedTags: ["舞台型"],
                reasons: ["DeepSeek 理由"],
                entryPath: ["看直拍", "补舞台", "看采访"],
                dimensionScores: [{ label: "舞台", score: 8, matchedTags: ["舞台型"] }],
                top3: [{ idolId: "idol-a", idolName: "测试爱豆 A", score: 90, difference: "主匹配" }]
              })
            }
          }
        ],
        usage: { total_tokens: 123 }
      });
    }) as typeof fetch;

    const response = await resultPost(
      new Request("http://localhost/api/deepseek-result", {
        method: "POST",
        body: JSON.stringify({
          apiKey: "sk-test",
          modeName: "体验版",
          userTags: ["舞台型"],
          candidates: [
            {
              id: "idol-a",
              name: "测试爱豆 A",
              summary: "候选",
              score: 88,
              confidence: 80,
              tags: ["舞台型"],
              matchedTags: ["舞台型"],
              entryReasons: ["舞台直拍"],
              dimensionScores: [{ label: "舞台", score: 8, matchedTags: ["舞台型"] }]
            }
          ]
        })
      })
    );
    const payload = (await response.json()) as { result?: { idolId?: string; summary?: string } };
    const deepSeekRequest = JSON.parse(requestBody) as {
      response_format?: { type?: string };
      model?: string;
      messages?: Array<{ content: string }>;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.result?.idolId, "idol-a");
    assert.equal(payload.result?.summary, "DeepSeek 生成结果");
    assert.equal(deepSeekRequest.model, "deepseek-v4-flash");
    assert.equal(deepSeekRequest.response_format?.type, "json_object");
    assert.match(deepSeekRequest.messages?.[0]?.content ?? "", /JSON/);
  });
});
