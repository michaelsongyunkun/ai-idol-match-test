import {
  buildDeepSeekMessages,
  deepSeekBaseUrl,
  deepSeekResultModel,
  mapDeepSeekStatusToError,
  parseApiKey,
  parseDeepSeekCandidates,
  parseDeepSeekGeneratedResult
} from "../../../lib/deepseek.ts";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "请求体不是有效 JSON。" } },
      { status: 400 }
    );
  }

  const body = payload as {
    apiKey?: unknown;
    modeName?: unknown;
    userTags?: unknown;
    candidates?: unknown;
  };
  const apiKey = parseApiKey(body.apiKey);
  const modeName = typeof body.modeName === "string" ? body.modeName : "";
  const userTags = Array.isArray(body.userTags)
    ? body.userTags.filter((tag): tag is string => typeof tag === "string").slice(0, 12)
    : [];
  const candidates = parseDeepSeekCandidates(body.candidates);

  if (!apiKey) {
    return Response.json(
      { error: { code: "MISSING_API_KEY", message: "请先连接 DeepSeek API Key。" } },
      { status: 400 }
    );
  }

  if (!modeName || candidates.length === 0) {
    return Response.json(
      { error: { code: "INVALID_MATCH_CONTEXT", message: "缺少可生成测评结果的匹配上下文。" } },
      { status: 422 }
    );
  }

  let deepSeekResponse: Response;

  try {
    deepSeekResponse = await fetch(`${deepSeekBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: deepSeekResultModel,
        messages: buildDeepSeekMessages({ modeName, userTags, candidates }),
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        temperature: 0.4,
        max_tokens: 1400,
        stream: false
      })
    });
  } catch {
    return Response.json(
      { error: { code: "DEEPSEEK_NETWORK_ERROR", message: "无法连接 DeepSeek API。" } },
      { status: 502 }
    );
  }

  if (!deepSeekResponse.ok) {
    return Response.json(mapDeepSeekStatusToError(deepSeekResponse.status), {
      status: deepSeekResponse.status
    });
  }

  const completion = (await deepSeekResponse.json()) as {
    choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
    usage?: unknown;
  };
  const content = completion.choices?.[0]?.message?.content;

  if (!content) {
    return Response.json(
      { error: { code: "DEEPSEEK_EMPTY_RESULT", message: "DeepSeek 未返回可用结果。" } },
      { status: 502 }
    );
  }

  const result = parseDeepSeekGeneratedResult(content, candidates);

  if (!result) {
    return Response.json(
      { error: { code: "DEEPSEEK_INVALID_RESULT", message: "DeepSeek 返回结果格式不符合要求。" } },
      { status: 502 }
    );
  }

  return Response.json({
    result,
    model: deepSeekResultModel,
    usage: completion.usage ?? null
  });
}
