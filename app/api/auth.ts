import { NextRequest } from "next/server";
import { ACCESS_CODE_PREFIX, ModelProvider } from "../constant";

function getIP(req: NextRequest) {
  let ip = req.ip ?? req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? "";
  }

  return ip;
}

function parseApiKey(bearToken: string) {
  const token = bearToken.trim().replaceAll("Bearer ", "").trim();
  const isApiKey = !token.startsWith(ACCESS_CODE_PREFIX);

  return {
    accessCode: isApiKey ? "" : token.slice(ACCESS_CODE_PREFIX.length),
    apiKey: isApiKey ? token : "",
  };
}

export function auth(req: NextRequest, modelProvider: ModelProvider) {
  const authToken = req.headers.get("Authorization") ?? "";
  const xGoogApiKey = req.headers.get("x-goog-api-key") ?? "";
  const xApiKey = req.headers.get("x-api-key") ?? ""; // Anthropics style
  const xCustomApiKey = req.headers.get("x-custom-provider-api-key") ?? ""; // 自定义服务商兜底

  // check if it is openai api key or user token (Authorization header)
  const { accessCode, apiKey } = parseApiKey(authToken);

  console.log("[User IP] ", getIP(req));
  console.log("[Time] ", new Date().toLocaleString());

  // 检查是否有服务器端配置
  const serverAccessCode = process.env.ACCESS_CODE || "";
  const hasValidAccessCode =
    serverAccessCode && accessCode === serverAccessCode;

  // 获取服务器端API密钥（根据模型提供商）
  let serverApiKey = "";
  if (hasValidAccessCode) {
    switch (modelProvider) {
      case ModelProvider.GPT:
        serverApiKey = process.env.OPENAI_API_KEY || "";
        break;
      case ModelProvider.GeminiPro:
        serverApiKey = process.env.GOOGLE_API_KEY || "";
        break;
      case ModelProvider.Claude:
        serverApiKey = process.env.ANTHROPIC_API_KEY || "";
        break;
      case ModelProvider.Doubao:
        serverApiKey = process.env.BYTEDANCE_API_KEY || "";
        break;
      case ModelProvider.Qwen:
        serverApiKey = process.env.ALIBABA_API_KEY || "";
        break;
      case ModelProvider.Moonshot:
        serverApiKey = process.env.MOONSHOT_API_KEY || "";
        break;
      case ModelProvider.DeepSeek:
        serverApiKey = process.env.DEEPSEEK_API_KEY || "";
        break;
      case ModelProvider.XAI:
        serverApiKey = process.env.XAI_API_KEY || "";
        break;
      case ModelProvider.SiliconFlow:
        serverApiKey = process.env.SILICONFLOW_API_KEY || "";
        break;
    }
  }

  // 根据提供商选择用户提供的 API Key 来源
  let userApiKey = "";
  switch (modelProvider) {
    case ModelProvider.GeminiPro:
      // Google 使用 x-goog-api-key，如果没带则回落到 Authorization
      userApiKey = xGoogApiKey || apiKey || xCustomApiKey;
      break;
    case ModelProvider.Claude:
      // Anthropic 支持 x-api-key，也可从 Authorization 读取 Bearer，或兜底使用自定义头
      userApiKey = xApiKey || apiKey || xCustomApiKey;
      break;
    default:
      // 其它默认走 Authorization，兜底使用自定义头
      userApiKey = apiKey || xCustomApiKey;
      break;
  }

  const finalApiKey = userApiKey;

  // 如果有有效的访问码和服务器端API密钥，允许通过
  if (hasValidAccessCode && serverApiKey) {
    console.log("[Auth] use server api key");
    return {
      error: false,
      useServerConfig: true,
    };
  }

  // 否则必须提供用户自己的API密钥
  if (!finalApiKey) {
    return {
      error: true,
      msg: "Empty api key",
    };
  }

  console.log("[Auth] use user api key");

  return {
    error: false,
    useServerConfig: false,
  };
}
