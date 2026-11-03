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

  // ---------- 1. 处理 GET 请求（前端轮询查询状态） ----------
  if (context.request.method === "GET") {
    const statusUrl = url.searchParams.get("status_url");
    if (!statusUrl) return new Response("Missing status_url", { status: 400, headers: corsHeaders });

    // 代理去问 BRIA
    const res = await fetch(statusUrl, { headers: { "api_token": token } });
    const json = await res.json();

    // 如果抠图完成
    if (json.status === "succeeded" || json.status === "completed") {
      const finalUrl = json.result?.image_url || json.result_url || json.result?.[0]?.url;
      if (finalUrl) {
        // 代理直接去下载原图，并以图片流返回给前端
        const imgRes = await fetch(finalUrl);
        const imgHeaders = new Headers();
        imgHeaders.set("Content-Type", "image/png");
        for (const [key, value] of Object.entries(corsHeaders)) imgHeaders.set(key, value);
        return new Response(imgRes.body, { status: 200, headers: imgHeaders });
      }
    }
    
    // 还没处理完，原样返回状态给前端继续轮询
    const resHeaders = new Headers();
    for (const [key, value] of Object.entries(corsHeaders)) resHeaders.set(key, value);
    return new Response(JSON.stringify(json), { status: res.status, headers: resHeaders });
  }

  // ---------- 2. 处理 POST 请求（前端上传图片） ----------
  if (context.request.method === "POST") {
    const newHeaders = new Headers();
    if (token) newHeaders.set("api_token", token);
    
    // 关键优化：直接透传 FormData 的 Boundary，不再经过 Base64 转换
    newHeaders.set("Content-Type", context.request.headers.get("Content-Type") || "");

    const target = "https://api.bria.ai/v2/image/edit/remove_background";
    const res = await fetch(target, {
      method: "POST",
      headers: newHeaders,
      body: context.request.body, // 二进制流直传，速度最快
    });

    const resHeaders = new Headers();
    for (const [key, value] of Object.entries(corsHeaders)) resHeaders.set(key, value);
    return new Response(res.body, { status: res.status, headers: resHeaders });
  }

  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
}
