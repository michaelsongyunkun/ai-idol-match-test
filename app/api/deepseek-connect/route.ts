import {
  deepSeekBaseUrl,
  deepSeekResultModel,
  mapDeepSeekStatusToError,
  parseApiKey
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

  const apiKey = parseApiKey((payload as { apiKey?: unknown }).apiKey);

  if (!apiKey) {
    return Response.json(
      { error: { code: "MISSING_API_KEY", message: "请先填写 DeepSeek API Key。" } },
      { status: 400 }
    );
  }

  let response: Response;

  try {
    response = await fetch(`${deepSeekBaseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
  } catch {
    return Response.json(
      { error: { code: "DEEPSEEK_NETWORK_ERROR", message: "无法连接 DeepSeek API。" } },
      { status: 502 }
    );
  }

  if (!response.ok) {
    return Response.json(mapDeepSeekStatusToError(response.status), { status: response.status });
  }

  const models = (await response.json()) as { data?: Array<{ id?: string }> };
  const availableModels = Array.isArray(models.data)
    ? models.data.map((model) => model.id).filter((id): id is string => Boolean(id))
    : [];

  return Response.json({
    connected: true,
    model: availableModels.includes(deepSeekResultModel) ? deepSeekResultModel : availableModels[0] ?? deepSeekResultModel,
    availableModels
  });
}
