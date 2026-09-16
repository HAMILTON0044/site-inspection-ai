const gatewayUrl = process.env.LLM_GATEWAY_URL?.replace(/\/+$/, "");
const apiKey = process.env.LLM_GATEWAY_API_KEY;
const model = process.env.LLM_MODEL;

if (!gatewayUrl || !apiKey || !model) {
  console.error(
    "缺少 LLM_GATEWAY_URL、LLM_GATEWAY_API_KEY 或 LLM_MODEL",
  );
  process.exit(1);
}

console.log("Gateway:", gatewayUrl);
console.log("Model:", model);
console.log("API Key: 已读取，但不会显示");

const response = await fetch(`${gatewayUrl}/api/chat`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content: "你是一个连通测试程序，请严格遵守用户的输出要求。",
      },
      {
        role: "user",
        content: "只回复 GATEWAY_OK，不要输出其他内容。",
      },
    ],
    stream: false,
  }),
});

const responseText = await response.text();

console.log("HTTP status:", response.status);

if (!response.ok) {
  console.error("Gateway 调用失败：");
  console.error(responseText);
  process.exit(1);
}

let result;

try {
  result = JSON.parse(responseText);
} catch {
  console.error("Gateway 返回的不是合法 JSON：");
  console.error(responseText);
  process.exit(1);
}

console.log("模型返回：", result.message?.content ?? result);