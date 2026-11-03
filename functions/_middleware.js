export async function onRequest(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, api_token",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. 目标锁定为 BRIA 官方抠图接口
  const target = "https://api.bria.ai/v1/remove-background";
  
  const newHeaders = new Headers();
  
  // 2. 从前端获取你填写的 Token，并转换为 BRIA 要求的 api_token 请求头
  const auth = context.request.headers.get("Authorization");
  if (auth && auth.startsWith("Bearer ")) {
     newHeaders.set("api_token", auth.replace("Bearer ", ""));
  }
  
  // 3. 保持图片类型
  newHeaders.set("Content-Type", context.request.headers.get("Content-Type") || "image/png");

  // 4. 发起请求给 BRIA
  const newRequest = new Request(target, {
    method: "POST",
    headers: newHeaders,
    body: context.request.body,
  });

  try {
    const response = await fetch(newRequest);
    const resHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      resHeaders.set(key, value);
    }
    
    return new Response(response.body, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
