export async function onRequest(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, api_token",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(context.request.url);
  const auth = context.request.headers.get("Authorization");
  const token = auth && auth.startsWith("Bearer ") ? auth.replace("Bearer ", "") : "";

  // ================== 处理 GET 请求（前端轮询查询状态） ==================
  if (context.request.method === "GET") {
    const statusUrl = url.searchParams.get("status_url");
    if (!statusUrl) return new Response("Missing status_url", { status: 400, headers: corsHeaders });

    // 代理携带 Token 去问 BRIA 进度
    const res = await fetch(statusUrl, { headers: { "api_token": token } });
    const json = await res.json();

    // 如果 BRIA 抠图完成
    if (json.status === "succeeded" || json.status === "completed") {
      const finalUrl = json.result?.image_url || json.result_url || json.result?.[0]?.url;
      if (finalUrl) {
        // 代理直接去把大图下载下来，以图片流返回给前端，避免前端跨域下载
        const imgRes = await fetch(finalUrl);
        const imgHeaders = new Headers();
        imgHeaders.set("Content-Type", "image/png");
        for (const [key, value] of Object.entries(corsHeaders)) imgHeaders.set(key, value);
        return new Response(imgRes.body, { status: 200, headers: imgHeaders });
      }
    }
    
    // 还没处理完，把状态转给前端，前端继续轮询
    const resHeaders = new Headers();
    for (const [key, value] of Object.entries(corsHeaders)) resHeaders.set(key, value);
    return new Response(JSON.stringify(json), { status: res.status, headers: resHeaders });
  }

  // ================== 处理 POST 请求（上传原图数据） ==================
  if (context.request.method === "POST") {
    const newHeaders = new Headers();
    if (token) newHeaders.set("api_token", token);
    
    // 直接透传前端发来的 Content-Type (此时是 application/json)
    newHeaders.set("Content-Type", context.request.headers.get("Content-Type") || "application/json");

    const target = "https://api.bria.ai/v2/image/edit/remove_background";
    
    // 直接把前端发来的 JSON body 原封不动传给 BRIA
    const res = await fetch(target, {
      method: "POST",
      headers: newHeaders,
      body: context.request.body,
    });

    const resHeaders = new Headers();
    for (const [key, value] of Object.entries(corsHeaders)) resHeaders.set(key, value);
    return new Response(res.body, { status: res.status, headers: resHeaders });
  }

  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
}
