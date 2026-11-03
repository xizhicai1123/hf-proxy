export async function onRequest(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, api_token",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. 目标锁定为 BRIA 官方 v2 抠图接口
  const target = "https://api.bria.ai/v2/image/edit/remove_background";
  
  const newHeaders = new Headers();
  
  // 2. 从前端获取 Token，并转换为 BRIA 要求的 api_token 请求头
  const auth = context.request.headers.get("Authorization");
  if (auth && auth.startsWith("Bearer ")) {
     newHeaders.set("api_token", auth.replace("Bearer ", ""));
  }
  
  // 3. v2 接口通常期望 JSON 或 multipart，这里根据你前端发送的方式设置
  newHeaders.set("Content-Type", context.request.headers.get("Content-Type") || "application/json");

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
