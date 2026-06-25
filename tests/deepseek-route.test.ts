import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { POST as legacyConnectPost } from "../app/api/deepseek-connect/route.ts";
import { POST as legacyResultPost } from "../app/api/deepseek-result/route.ts";
import { POST as connectPost } from "../app/api/compatible-connect/route.ts";
import { POST as resultPost } from "../app/api/compatible-result/route.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const richGeneratedContent = (idolId = "idol-a") =>
  JSON.stringify({
    idolId,
    idolName: "测试爱豆 A",
    score: 90,
    confidence: 84,
    summary:
      "DeepSeek 生成结果会把舞台表现、清冷审美和实力稳定性串起来，说明用户为什么会先被现场吸引，再通过练习室和日常内容确认长期上头感。",
    matchedTags: ["舞台型", "清冷", "实力派"],
    reasons: [
      "用户高频偏好集中在舞台型，候选画像也把现场表现和直拍入口放在核心位置。",
      "清冷审美让结果不只依赖热闹氛围，也提供了更耐看的个人气质记忆点。",
      "实力派标签说明用户可能更在意稳定发挥，适合通过练习室和现场合集继续验证。",
      "这个结果的入坑路径清晰，从高光舞台到日常反差都有可以继续补档的内容。"
    ],
    entryPath: [
      "先看一条高完成度舞台直拍，判断镜头吸引力和节奏是否立刻命中。",
      "再补练习室或现场合集，确认实力稳定性不是单个片段带来的错觉。",
      "最后看采访和日常切片，验证清冷气质之外有没有长期陪伴感。"
    ],
    dimensionScores: [
      { label: "舞台", score: 8, matchedTags: ["舞台型"] },
      { label: "审美", score: 7, matchedTags: ["清冷"] },
      { label: "作品", score: 5, matchedTags: ["实力派"] }
    ],
    top3: [
      { idolId, idolName: "测试爱豆 A", score: 90, difference: "第一名更偏舞台冲击和清冷审美，适合从直拍快速入坑。" }
    ]
  });

describe("Compatible API routes", () => {
  it("validates a user-supplied compatible API key through the models endpoint", async () => {
    let requestUrl = "";
    let authorization = "";
    globalThis.fetch = (async (url, init) => {
      requestUrl = String(url);
      authorization = String(init?.headers ? (init.headers as Record<string, string>).Authorization : "");
      return Response.json({
        object: "list",
        data: [{ id: "provider-model", object: "model", owned_by: "compatible-provider" }]
      });
    }) as typeof fetch;

    const response = await connectPost(
      new Request("http://localhost/api/compatible-connect", {
        method: "POST",
        body: JSON.stringify({
          apiKey: "sk-test",
          baseUrl: "https://compatible.example/v1/",
          model: "provider-model"
        })
      })
    );
    const payload = (await response.json()) as { connected?: boolean; baseUrl?: string; model?: string; apiKey?: string };

    assert.equal(response.status, 200);
    assert.equal(payload.connected, true);
    assert.equal(payload.baseUrl, "https://compatible.example/v1");
    assert.equal(payload.model, "provider-model");
    assert.equal(payload.apiKey, undefined);
    assert.equal(requestUrl, "https://compatible.example/v1/models");
    assert.equal(authorization, "Bearer sk-test");
  });

  it("validates Gemini API keys through the Gemini models endpoint", async () => {
    let requestUrl = "";
    let apiKeyHeader = "";
    globalThis.fetch = (async (url, init) => {
      requestUrl = String(url);
      apiKeyHeader = String(init?.headers ? (init.headers as Record<string, string>)["x-goog-api-key"] : "");
      return Response.json({
        models: [{ name: "models/gemini-3.5-flash" }, { name: "models/gemini-3.5-pro" }]
      });
    }) as typeof fetch;

    const response = await connectPost(
      new Request("http://localhost/api/compatible-connect", {
        method: "POST",
        body: JSON.stringify({
          provider: "gemini",
          apiKey: "gemini-key",
          model: "gemini-3.5-flash"
        })
      })
    );
    const payload = (await response.json()) as { connected?: boolean; provider?: string; baseUrl?: string; model?: string; apiKey?: string };

    assert.equal(response.status, 200);
    assert.equal(payload.connected, true);
    assert.equal(payload.provider, "gemini");
    assert.equal(payload.baseUrl, "https://generativelanguage.googleapis.com/v1beta");
    assert.equal(payload.model, "gemini-3.5-flash");
    assert.equal(payload.apiKey, undefined);
    assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/models");
    assert.equal(apiKeyHeader, "gemini-key");
  });

  it("validates Anthropic API keys through the Claude models endpoint", async () => {
    let requestUrl = "";
    let apiKeyHeader = "";
    let versionHeader = "";
    globalThis.fetch = (async (url, init) => {
      requestUrl = String(url);
      const headers = init?.headers as Record<string, string>;
      apiKeyHeader = String(headers["x-api-key"] ?? "");
      versionHeader = String(headers["anthropic-version"] ?? "");
      return Response.json({
        data: [{ id: "claude-sonnet-4-6" }, { id: "claude-opus-4-6" }]
      });
    }) as typeof fetch;

    const response = await connectPost(
      new Request("http://localhost/api/compatible-connect", {
        method: "POST",
        body: JSON.stringify({
          provider: "anthropic",
          apiKey: "claude-key",
          model: "claude-sonnet-4-6"
        })
      })
    );
    const payload = (await response.json()) as { connected?: boolean; provider?: string; baseUrl?: string; model?: string; apiKey?: string };

    assert.equal(response.status, 200);
    assert.equal(payload.connected, true);
    assert.equal(payload.provider, "anthropic");
    assert.equal(payload.baseUrl, "https://api.anthropic.com");
    assert.equal(payload.model, "claude-sonnet-4-6");
    assert.equal(payload.apiKey, undefined);
    assert.equal(requestUrl, "https://api.anthropic.com/v1/models");
    assert.equal(apiKeyHeader, "claude-key");
    assert.equal(versionHeader, "2023-06-01");
  });

  it("maps compatible API authentication failures without exposing the key", async () => {
    globalThis.fetch = (async () =>
      Response.json({ error: { message: "bad key" } }, { status: 401 })) as typeof fetch;

    const response = await connectPost(
      new Request("http://localhost/api/compatible-connect", {
        method: "POST",
        body: JSON.stringify({ apiKey: "sk-bad" })
      })
    );
    const payload = (await response.json()) as { error?: { code?: string }; apiKey?: string };

    assert.equal(response.status, 401);
    assert.equal(payload.error?.code, "COMPATIBLE_API_AUTH_FAILED");
    assert.equal(payload.apiKey, undefined);
  });

  it("returns a structured error when compatible API cannot be reached", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const response = await connectPost(
      new Request("http://localhost/api/compatible-connect", {
        method: "POST",
        body: JSON.stringify({ apiKey: "sk-test" })
      })
    );
    const payload = (await response.json()) as { error?: { code?: string; message?: string } };

    assert.equal(response.status, 502);
    assert.equal(payload.error?.code, "COMPATIBLE_API_NETWORK_ERROR");
    assert.doesNotMatch(payload.error?.message ?? "", /network down/);
  });

  it("generates a structured result through GPT-compatible chat completions", async () => {
    let requestUrl = "";
    let requestBody = "";
    globalThis.fetch = (async (url, init) => {
      requestUrl = String(url);
      requestBody = String(init?.body ?? "");
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                ...JSON.parse(richGeneratedContent())
              })
            }
          }
        ],
        usage: { total_tokens: 123 }
      });
    }) as typeof fetch;

    const response = await resultPost(
      new Request("http://localhost/api/compatible-result", {
        method: "POST",
        body: JSON.stringify({
          apiKey: "sk-test",
          baseUrl: "https://api.openai.com/v1/",
          model: "gpt-compatible-model",
          modeName: "体验版",
          userTags: ["舞台型"],
          fixedIdolId: "idol-a",
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
    const payload = (await response.json()) as {
      result?: { idolId?: string; summary?: string; reasons?: string[] };
      repaired?: boolean;
    };
    const deepSeekRequest = JSON.parse(requestBody) as {
      response_format?: { type?: string };
      model?: string;
      messages?: Array<{ content: string }>;
      thinking?: unknown;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.result?.idolId, "idol-a");
    assert.ok((payload.result?.summary ?? "").length >= 60);
    assert.equal(payload.result?.reasons?.length, 4);
    assert.equal(payload.repaired, false);
    assert.equal(requestUrl, "https://api.openai.com/v1/chat/completions");
    assert.equal(deepSeekRequest.model, "gpt-compatible-model");
    assert.equal(deepSeekRequest.response_format?.type, "json_object");
    assert.equal("thinking" in deepSeekRequest, false);
    assert.match(deepSeekRequest.messages?.[0]?.content ?? "", /JSON/);
    assert.match(deepSeekRequest.messages?.[0]?.content ?? "", /固定值：idol-a/);
  });

  it("generates a structured result through Gemini generateContent", async () => {
    let requestUrl = "";
    let requestBody = "";
    let apiKeyHeader = "";
    globalThis.fetch = (async (url, init) => {
      requestUrl = String(url);
      requestBody = String(init?.body ?? "");
      apiKeyHeader = String(init?.headers ? (init.headers as Record<string, string>)["x-goog-api-key"] : "");
      return Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: richGeneratedContent() }]
            }
          }
        ],
        usageMetadata: { totalTokenCount: 321 }
      });
    }) as typeof fetch;

    const response = await resultPost(
      new Request("http://localhost/api/compatible-result", {
        method: "POST",
        body: JSON.stringify({
          provider: "gemini",
          apiKey: "gemini-key",
          model: "gemini-3.5-flash",
          modeName: "mode",
          userTags: ["tag"],
          fixedIdolId: "idol-a",
          candidates: [
            {
              id: "idol-a",
              name: "idol a",
              summary: "summary",
              score: 88,
              confidence: 80,
              tags: ["tag"],
              matchedTags: ["tag"],
              entryReasons: ["reason"],
              dimensionScores: [{ label: "stage", score: 8, matchedTags: ["tag"] }]
            }
          ]
        })
      })
    );
    const payload = (await response.json()) as { result?: { idolId?: string }; model?: string };
    const geminiRequest = JSON.parse(requestBody) as {
      system_instruction?: { parts?: Array<{ text?: string }> };
      contents?: Array<{ parts?: Array<{ text?: string }> }>;
      generationConfig?: { responseFormat?: { text?: { mimeType?: string } }; maxOutputTokens?: number };
    };

    assert.equal(response.status, 200);
    assert.equal(payload.result?.idolId, "idol-a");
    assert.equal(payload.model, "gemini-3.5-flash");
    assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent");
    assert.equal(apiKeyHeader, "gemini-key");
    assert.match(geminiRequest.system_instruction?.parts?.[0]?.text ?? "", /JSON/);
    assert.match(geminiRequest.contents?.[0]?.parts?.[0]?.text ?? "", /fixedIdolId|idol-a/);
    assert.equal(geminiRequest.generationConfig?.responseFormat?.text?.mimeType, "application/json");
    assert.equal(geminiRequest.generationConfig?.maxOutputTokens, 2200);
  });

  it("generates a structured result through Anthropic messages", async () => {
    let requestUrl = "";
    let requestBody = "";
    let apiKeyHeader = "";
    let versionHeader = "";
    globalThis.fetch = (async (url, init) => {
      requestUrl = String(url);
      requestBody = String(init?.body ?? "");
      const headers = init?.headers as Record<string, string>;
      apiKeyHeader = String(headers["x-api-key"] ?? "");
      versionHeader = String(headers["anthropic-version"] ?? "");
      return Response.json({
        content: [{ type: "text", text: richGeneratedContent() }],
        usage: { input_tokens: 111, output_tokens: 222 }
      });
    }) as typeof fetch;

    const response = await resultPost(
      new Request("http://localhost/api/compatible-result", {
        method: "POST",
        body: JSON.stringify({
          provider: "anthropic",
          apiKey: "claude-key",
          model: "claude-sonnet-4-6",
          modeName: "mode",
          userTags: ["tag"],
          fixedIdolId: "idol-a",
          candidates: [
            {
              id: "idol-a",
              name: "idol a",
              summary: "summary",
              score: 88,
              confidence: 80,
              tags: ["tag"],
              matchedTags: ["tag"],
              entryReasons: ["reason"],
              dimensionScores: [{ label: "stage", score: 8, matchedTags: ["tag"] }]
            }
          ]
        })
      })
    );
    const payload = (await response.json()) as { result?: { idolId?: string }; model?: string };
    const claudeRequest = JSON.parse(requestBody) as {
      model?: string;
      system?: string;
      max_tokens?: number;
      messages?: Array<{ role?: string; content?: string }>;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.result?.idolId, "idol-a");
    assert.equal(payload.model, "claude-sonnet-4-6");
    assert.equal(requestUrl, "https://api.anthropic.com/v1/messages");
    assert.equal(apiKeyHeader, "claude-key");
    assert.equal(versionHeader, "2023-06-01");
    assert.equal(claudeRequest.model, "claude-sonnet-4-6");
    assert.equal(claudeRequest.max_tokens, 2200);
    assert.match(claudeRequest.system ?? "", /JSON/);
    assert.match(claudeRequest.messages?.[0]?.content ?? "", /fixedIdolId|idol-a/);
  });

  it("retries once when the first DeepSeek result is too sparse", async () => {
    let calls = 0;
    let repairPrompt = "";

    globalThis.fetch = (async (_url, init) => {
      calls += 1;
      const requestBody = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content: string }>;
      };

      if (calls === 2) {
        repairPrompt = requestBody.messages?.[0]?.content ?? "";
      }

      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content:
                calls === 1
                  ? JSON.stringify({ idolId: "idol-a", summary: "太短" })
                  : richGeneratedContent()
            }
          }
        ],
        usage: { total_tokens: calls === 1 ? 20 : 240 }
      });
    }) as typeof fetch;

    const response = await resultPost(
      new Request("http://localhost/api/compatible-result", {
        method: "POST",
        body: JSON.stringify({
          apiKey: "sk-test",
          baseUrl: "https://compatible.example/v1/",
          model: "provider-model",
          modeName: "体验版",
          userTags: ["舞台型"],
          fixedIdolId: "idol-a",
          candidates: [
            {
              id: "idol-a",
              name: "测试爱豆 A",
              summary: "候选",
              score: 88,
              confidence: 80,
              tags: ["舞台型", "清冷", "实力派"],
              matchedTags: ["舞台型", "清冷", "实力派"],
              entryReasons: ["舞台直拍", "练习室视频", "采访切片"],
              dimensionScores: [
                { label: "舞台", score: 8, matchedTags: ["舞台型"] },
                { label: "审美", score: 7, matchedTags: ["清冷"] },
                { label: "作品", score: 5, matchedTags: ["实力派"] }
              ]
            }
          ]
        })
      })
    );
    const payload = (await response.json()) as { repaired?: boolean; result?: { reasons?: string[] } };

    assert.equal(response.status, 200);
    assert.equal(calls, 2);
    assert.equal(payload.repaired, true);
    assert.equal(payload.result?.reasons?.length, 4);
    assert.match(repairPrompt, /重新生成严格 JSON/);
  });

  it("retries when DeepSeek tries to replace the fixed idol result", async () => {
    let calls = 0;

    globalThis.fetch = (async () => {
      calls += 1;

      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: calls === 1 ? richGeneratedContent("idol-b") : richGeneratedContent("idol-a")
            }
          }
        ],
        usage: { total_tokens: calls === 1 ? 120 : 260 }
      });
    }) as typeof fetch;

    const response = await resultPost(
      new Request("http://localhost/api/compatible-result", {
        method: "POST",
        body: JSON.stringify({
          apiKey: "sk-test",
          baseUrl: "https://compatible.example/v1/",
          model: "provider-model",
          modeName: "体验版",
          userTags: ["舞台型"],
          fixedIdolId: "idol-a",
          candidates: [
            {
              id: "idol-a",
              name: "测试爱豆 A",
              summary: "候选 A",
              score: 88,
              confidence: 80,
              tags: ["舞台型", "清冷", "实力派"],
              matchedTags: ["舞台型", "清冷", "实力派"],
              entryReasons: ["舞台直拍", "练习室视频", "采访切片"],
              dimensionScores: [
                { label: "舞台", score: 8, matchedTags: ["舞台型"] },
                { label: "审美", score: 7, matchedTags: ["清冷"] },
                { label: "作品", score: 5, matchedTags: ["实力派"] }
              ]
            }
          ]
        })
      })
    );
    const payload = (await response.json()) as { repaired?: boolean; result?: { idolId?: string } };

    assert.equal(response.status, 200);
    assert.equal(calls, 2);
    assert.equal(payload.repaired, true);
    assert.equal(payload.result?.idolId, "idol-a");
  });

  it("keeps legacy DeepSeek route aliases available", async () => {
    globalThis.fetch = (async (url) =>
      String(url).endsWith("/models")
        ? Response.json({ object: "list", data: [{ id: "provider-model" }] })
        : Response.json({ choices: [{ message: { content: richGeneratedContent() } }] })) as typeof fetch;

    const connectResponse = await legacyConnectPost(
      new Request("http://localhost/api/deepseek-connect", {
        method: "POST",
        body: JSON.stringify({ apiKey: "sk-test", model: "provider-model" })
      })
    );
    const resultResponse = await legacyResultPost(
      new Request("http://localhost/api/deepseek-result", {
        method: "POST",
        body: JSON.stringify({
          apiKey: "sk-test",
          model: "provider-model",
          modeName: "mode",
          userTags: ["tag"],
          fixedIdolId: "idol-a",
          candidates: [
            {
              id: "idol-a",
              name: "idol a",
              summary: "summary",
              score: 88,
              confidence: 80,
              tags: ["tag"],
              matchedTags: ["tag"],
              entryReasons: ["reason"],
              dimensionScores: [{ label: "stage", score: 8, matchedTags: ["tag"] }]
            }
          ]
        })
      })
    );

    assert.equal(connectResponse.status, 200);
    assert.equal(resultResponse.status, 200);
  });
});
