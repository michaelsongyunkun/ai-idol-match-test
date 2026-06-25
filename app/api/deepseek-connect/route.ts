import {
  buildCompatibleApiUrl,
  mapDeepSeekStatusToError,
  parseCompatibleApiConfig,
  type CompatibleApiConfig
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

  const parsedConfig = parseCompatibleApiConfig(payload as { provider?: unknown; apiKey?: unknown; baseUrl?: unknown; model?: unknown });

  if (!parsedConfig.ok) {
    return Response.json(parsedConfig.body, { status: parsedConfig.status });
  }

  const { provider, baseUrl, model } = parsedConfig.config;
  let response: Response;

  try {
    response = await fetch(buildProviderModelsUrl(parsedConfig.config), {
      method: "GET",
      headers: buildProviderAuthHeaders(parsedConfig.config)
    });
  } catch {
    return Response.json(
      { error: { code: "COMPATIBLE_API_NETWORK_ERROR", message: "无法连接兼容 API。" } },
      { status: 502 }
    );
  }

  if (!response.ok) {
    return Response.json(mapDeepSeekStatusToError(response.status), { status: response.status });
  }

  const models = await response.json();
  const availableModels = parseProviderModels(models, provider);

  return Response.json({
    connected: true,
    provider,
    baseUrl,
    model: availableModels.includes(model) ? model : availableModels[0] ?? model,
    availableModels
  });
}

function buildProviderModelsUrl({ provider, baseUrl }: CompatibleApiConfig) {
  if (provider === "anthropic") {
    return buildCompatibleApiUrl(baseUrl, "/v1/models");
  }

  return buildCompatibleApiUrl(baseUrl, "/models");
}

function buildProviderAuthHeaders({ provider, apiKey }: CompatibleApiConfig): Record<string, string> {
  if (provider === "gemini") {
    return { "x-goog-api-key": apiKey };
  }

  if (provider === "anthropic") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    };
  }

  return { Authorization: `Bearer ${apiKey}` };
}

function parseProviderModels(value: unknown, provider: CompatibleApiConfig["provider"]) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const body = value as {
    data?: Array<{ id?: unknown }>;
    models?: Array<{ name?: unknown }>;
  };

  if (provider === "gemini") {
    return Array.isArray(body.models)
      ? body.models
          .map((model) => (typeof model.name === "string" ? model.name.replace(/^models\//, "") : ""))
          .filter((id): id is string => Boolean(id))
      : [];
  }

  return Array.isArray(body.data)
    ? body.data.map((model) => model.id).filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
}
