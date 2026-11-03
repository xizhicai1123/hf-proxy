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
  
  const contentType = context.request.headers.get("Content-Type") || "application/json";
  newHeaders.set("Content-Type", contentType);

  // 读取请求体，强制添加 sync: true 参数
  let bodyBuffer = await context.request.arrayBuffer();
  let reqBody = bodyBuffer;

  if (contentType.includes("application/json")) {
      try {
          let bodyText = new TextDecoder().decode(bodyBuffer);
          let json = JSON.parse(bodyText);
          json.sync = true; // 强制 BRIA 等待抠图完成
          reqBody = JSON.stringify(json);
      } catch(e) {
          reqBody = bodyBuffer;
      }
  }

  const newRequest = new Request(target, {
    method: "POST",
    headers: newHeaders,
    body: reqBody,
  });

  try {
    const response = await fetch(newRequest);
    
    if (!response.ok) {
      const errText = await response.text();
      return new Response(errText, { status: response.status, headers: corsHeaders });
    }

    const resContentType = response.headers.get("content-type") || "";
    
    // 如果 BRIA 直接返回了图片流
    if (resContentType.includes("image")) {
      const resHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders)) resHeaders.set(key, value);
      return new Response(response.body, { status: 200, headers: resHeaders });
    }

    // 如果是 JSON，解析里面的图片链接
    const json = await response.json();
    
    let imageUrl = json.result_url || json.image_url;
    if (!imageUrl && Array.isArray(json)) {
       imageUrl = json[0]?.result_url || json[0]?.image_url || json[0]?.url;
    }
    if (!imageUrl && json.result) {
       imageUrl = json.result.image_url || json.result[0]?.url || json.result[0]?.image_url;
    }

    // 找到链接，代理直接下载图片并返回给前端
    if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      const imgHeaders = new Headers();
      imgHeaders.set("Content-Type", imgRes.headers.get("content-type") || "image/png");
      for (const [key, value] of Object.entries(corsHeaders)) imgHeaders.set(key, value);
      return new Response(imgRes.body, { status: 200, headers: imgHeaders });
    }

    // 如果还是找不到，把 BRIA 原原本本的返回内容吐出来，方便排查
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
