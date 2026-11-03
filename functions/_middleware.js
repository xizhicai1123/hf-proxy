export async function onRequest(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, api_token",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const target = "https://api.bria.ai/v2/image/edit/remove_background";
  const newHeaders = new Headers();
  
  const auth = context.request.headers.get("Authorization");
  if (auth && auth.startsWith("Bearer ")) {
     newHeaders.set("api_token", auth.replace("Bearer ", ""));
  }
  newHeaders.set("Content-Type", context.request.headers.get("Content-Type") || "application/json");

  const newRequest = new Request(target, {
    method: "POST",
    headers: newHeaders,
    body: context.request.body,
  });

  try {
    const response = await fetch(newRequest);
    
    // 如果 BRIA 报错（比如 400, 500），直接把错误信息返回给前端
    if (!response.ok) {
      const errText = await response.text();
      return new Response(errText, {
        status: response.status,
        headers: corsHeaders
      });
    }

    const contentType = response.headers.get("content-type") || "";
    
    // 如果 BRIA 直接返回了图片流
    if (contentType.includes("image")) {
      const resHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders)) resHeaders.set(key, value);
      return new Response(response.body, { status: 200, headers: resHeaders });
    }

    // 如果是 JSON，解析里面的图片链接
    const json = await response.json();
    
    // 兼容各种可能出现的图片路径（防止前端找不到）
    let imageUrl = null;
    if (json.result_url) imageUrl = json.result_url;
    else if (json.image_url) imageUrl = json.image_url;
    else if (Array.isArray(json) && json[0] && json[0].result_url) imageUrl = json[0].result_url;
    else if (json.result && json.result.image_url) imageUrl = json.result.image_url;
    else if (json.result && json.result[0] && json.result[0].url) imageUrl = json.result[0].url;

    // 如果找到了图片链接，Cloudflare 代理直接去把这个图下载下来
    if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      const imgHeaders = new Headers();
      imgHeaders.set("Content-Type", imgRes.headers.get("content-type") || "image/png");
      for (const [key, value] of Object.entries(corsHeaders)) imgHeaders.set(key, value);
      
      return new Response(imgRes.body, { status: 200, headers: imgHeaders });
    }

    // 如果走到了这里，说明返回了未知的 JSON
    return new Response(JSON.stringify({ error: "未找到图片链接", raw: json }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
