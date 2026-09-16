type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
  error?: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`缺少环境变量：${name}`);
  }

  return value;
}

export async function callLlm(
  messages: LlmMessage[],
): Promise<string> {
  const gatewayUrl = getRequiredEnv("LLM_GATEWAY_URL").replace(
    /\/+$/,
    "",
  );
  const apiKey = getRequiredEnv("LLM_GATEWAY_API_KEY");
  const model = getRequiredEnv("LLM_MODEL");

  const response = await fetch(`${gatewayUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      //enlarge the size
      options:{
        num_predict:2048,
        temperature:0.1,
      }
    }),
    cache: "no-store",
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `LLM Gateway 请求失败，状态码 ${response.status}：${responseText}`,
    );
  }

  let result: OllamaChatResponse;

  try {
    result = JSON.parse(responseText) as OllamaChatResponse;
  } catch {
    throw new Error("LLM Gateway 返回的不是合法 JSON");
  }

  const content = result.message?.content;

  if (!content) {
    throw new Error("LLM Gateway 返回结果中没有 message.content");
  }

  return content;
}