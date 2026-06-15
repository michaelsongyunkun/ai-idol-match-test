import {
  buildDeepSeekMessages,
  buildDeepSeekRepairMessages,
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

  const requestInput = { modeName, userTags, candidates };
  const firstAttempt = await requestDeepSeekCompletion({
    apiKey,
    messages: buildDeepSeekMessages(requestInput),
    maxTokens: 2200
  });

  if ("error" in firstAttempt) {
    return firstAttempt.error;
  }

  const firstResult = parseDeepSeekGeneratedResult(firstAttempt.content, candidates);

  if (firstResult) {
    return Response.json({
      result: firstResult,
      model: deepSeekResultModel,
      usage: firstAttempt.usage,
      repaired: false
    });
  }

  const repairAttempt = await requestDeepSeekCompletion({
    apiKey,
    messages: buildDeepSeekRepairMessages(requestInput, firstAttempt.content, [
      "第一次结果内容过短或字段不完整，未通过后端质量校验。"
    ]),
    maxTokens: 2600
  });

  if ("error" in repairAttempt) {
    return repairAttempt.error;
  }

  const repairedResult = parseDeepSeekGeneratedResult(repairAttempt.content, candidates);

  if (!repairedResult) {
    return Response.json(
      { error: { code: "DEEPSEEK_INVALID_RESULT", message: "DeepSeek 返回结果内容仍然过短，请重新生成。" } },
      { status: 502 }
    );
  }

  return Response.json({
    result: repairedResult,
    model: deepSeekResultModel,
    usage: repairAttempt.usage,
    repaired: true
  });
}

async function requestDeepSeekCompletion({
  apiKey,
  messages,
  maxTokens
}: {
  apiKey: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens: number;
}): Promise<{ content: string; usage: unknown } | { error: Response }> {
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
        messages,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        temperature: 0.55,
        max_tokens: maxTokens,
        stream: false
      })
    });
  } catch {
    return {
      error: Response.json(
        { error: { code: "DEEPSEEK_NETWORK_ERROR", message: "无法连接 DeepSeek API。" } },
        { status: 502 }
      )
    };
  }

  if (!deepSeekResponse.ok) {
    return {
      error: Response.json(mapDeepSeekStatusToError(deepSeekResponse.status), {
        status: deepSeekResponse.status
      })
    };
  }

  const completion = (await deepSeekResponse.json()) as {
    choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
    usage?: unknown;
  };
  const content = completion.choices?.[0]?.message?.content;

  if (!content) {
    return {
      error: Response.json(
        { error: { code: "DEEPSEEK_EMPTY_RESULT", message: "DeepSeek 未返回可用结果。" } },
        { status: 502 }
      )
    };
  }

  return {
    content,
    usage: completion.usage ?? null
  };
}
