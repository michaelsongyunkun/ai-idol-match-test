import {
  buildCompatibleApiUrl,
  buildDeepSeekMessages,
  buildDeepSeekRepairMessages,
  mapDeepSeekStatusToError,
  parseCompatibleApiConfig,
  parseDeepSeekCandidates,
  parseDeepSeekGeneratedResult,
  type CompatibleApiConfig
} from "../../../lib/deepseek.ts";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  const body = payload as {
    provider?: unknown;
    apiKey?: unknown;
    baseUrl?: unknown;
    model?: unknown;
    modeName?: unknown;
    userTags?: unknown;
    candidates?: unknown;
    fixedIdolId?: unknown;
  };
  const parsedConfig = parseCompatibleApiConfig(body);
  const modeName = typeof body.modeName === "string" ? body.modeName : "";
  const userTags = Array.isArray(body.userTags)
    ? body.userTags.filter((tag): tag is string => typeof tag === "string").slice(0, 12)
    : [];
  const candidates = parseDeepSeekCandidates(body.candidates);
  const fixedIdolId = typeof body.fixedIdolId === "string" ? body.fixedIdolId.trim() : "";

  if (!parsedConfig.ok) {
    return Response.json(parsedConfig.body, { status: parsedConfig.status });
  }

  const { model } = parsedConfig.config;

  if (!modeName || candidates.length === 0 || !fixedIdolId || !candidates.some((candidate) => candidate.id === fixedIdolId)) {
    return Response.json(
      { error: { code: "INVALID_MATCH_CONTEXT", message: "Missing fixed match context or candidate data." } },
      { status: 422 }
    );
  }

  const requestInput = { modeName, userTags, candidates, fixedIdolId };
  const firstAttempt = await requestDeepSeekCompletion({
    config: parsedConfig.config,
    messages: buildDeepSeekMessages(requestInput),
    maxTokens: 2200
  });

  if ("error" in firstAttempt) {
    return firstAttempt.error;
  }

  const firstResult = parseDeepSeekGeneratedResult(firstAttempt.content, candidates, fixedIdolId);

  if (firstResult) {
    return Response.json({
      result: firstResult,
      model,
      usage: firstAttempt.usage,
      repaired: false
    });
  }

  const repairAttempt = await requestDeepSeekCompletion({
    config: parsedConfig.config,
    messages: buildDeepSeekRepairMessages(requestInput, firstAttempt.content, [
      "The first result was too sparse, incomplete, or did not keep the fixed idolId."
    ]),
    maxTokens: 2600
  });

  if ("error" in repairAttempt) {
    return repairAttempt.error;
  }

  const repairedResult = parseDeepSeekGeneratedResult(repairAttempt.content, candidates, fixedIdolId);

  if (!repairedResult) {
    return Response.json(
      { error: { code: "COMPATIBLE_API_INVALID_RESULT", message: "The model returned an invalid or incomplete result." } },
      { status: 502 }
    );
  }

  return Response.json({
    result: repairedResult,
    model,
    usage: repairAttempt.usage,
    repaired: true
  });
}

async function requestDeepSeekCompletion({
  config,
  messages,
  maxTokens
}: {
  config: CompatibleApiConfig;
  messages: Array<{ role: string; content: string }>;
  maxTokens: number;
}): Promise<{ content: string; usage: unknown } | { error: Response }> {
  let deepSeekResponse: Response;

  try {
    deepSeekResponse = await fetch(buildCompletionUrl(config), {
      method: "POST",
      headers: buildCompletionHeaders(config),
      body: JSON.stringify(buildCompletionBody(config, messages, maxTokens))
    });
  } catch {
    return {
      error: Response.json(
        { error: { code: "COMPATIBLE_API_NETWORK_ERROR", message: "Unable to reach the selected model API." } },
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

  const completion = await deepSeekResponse.json();
  const content = extractCompletionText(completion, config.provider);

  if (!content) {
    return {
      error: Response.json(
        { error: { code: "COMPATIBLE_API_EMPTY_RESULT", message: "The selected model API returned no usable text." } },
        { status: 502 }
      )
    };
  }

  return {
    content,
    usage: extractCompletionUsage(completion)
  };
}

function buildCompletionUrl({ provider, baseUrl, model }: CompatibleApiConfig) {
  if (provider === "gemini") {
    return buildCompatibleApiUrl(baseUrl, `/models/${model}:generateContent`);
  }

  if (provider === "anthropic") {
    return buildCompatibleApiUrl(baseUrl, "/v1/messages");
  }

  return buildCompatibleApiUrl(baseUrl, "/chat/completions");
}

function buildCompletionHeaders({ provider, apiKey }: CompatibleApiConfig): Record<string, string> {
  if (provider === "gemini") {
    return {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    };
  }

  if (provider === "anthropic") {
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    };
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  };
}

function buildCompletionBody(
  { provider, model }: CompatibleApiConfig,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
) {
  if (provider === "gemini") {
    const { system, user } = splitSystemAndUserMessages(messages);

    return {
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.55,
        maxOutputTokens: maxTokens,
        responseFormat: { text: { mimeType: "application/json" } }
      }
    };
  }

  if (provider === "anthropic") {
    const { system, user } = splitSystemAndUserMessages(messages);

    return {
      model,
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: maxTokens,
      temperature: 0.55
    };
  }

  return {
    model,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.55,
    max_tokens: maxTokens,
    stream: false
  };
}

function splitSystemAndUserMessages(messages: Array<{ role: string; content: string }>) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const user = messages
    .filter((message) => message.role !== "system")
    .map((message) => message.content)
    .join("\n\n");

  return { system, user };
}

function extractCompletionText(value: unknown, provider: CompatibleApiConfig["provider"]) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const body = value as {
    choices?: Array<{ message?: { content?: unknown } }>;
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
    content?: Array<{ type?: unknown; text?: unknown }>;
  };

  if (provider === "gemini") {
    return Array.isArray(body.candidates)
      ? (body.candidates[0]?.content?.parts
          ?.map((part) => (typeof part.text === "string" ? part.text : ""))
          .join("")
          .trim() ?? "")
      : "";
  }

  if (provider === "anthropic") {
    return Array.isArray(body.content)
      ? body.content
          .map((part) => (typeof part.text === "string" ? part.text : ""))
          .join("")
          .trim()
      : "";
  }

  const content = body.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

function extractCompletionUsage(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const body = value as { usage?: unknown; usageMetadata?: unknown };
  return body.usage ?? body.usageMetadata ?? null;
}
