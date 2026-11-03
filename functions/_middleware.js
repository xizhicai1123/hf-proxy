export async function onRequest(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, api_token",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const newHeaders = new Headers();
  const auth = context.request.headers.get("Authorization");
  if (auth && auth.startsWith("Bearer ")) {
    newHeaders.set("api_token", auth.replace("Bearer ", ""));
  }
  
  // 强制使用 JSON
  newHeaders.set("Content-Type", "application/json");

  try {
    // 1. 发起抠图请求
    const response = await fetch("https://api.bria.ai/v2/image/edit/remove_background", {
      method: "POST",
      headers: newHeaders,
      body: context.request.body,
    });

    if (!response.ok) {
      return new Response(await response.text(), { status: response.status, headers: corsHeaders });
    }

    const json = await response.json();
    
    // 如果 BRIA 直接返回了图片（极少情况）
    if (json.result_url) {
        return await fetchImageAndReturn(json.result_url, corsHeaders);
    }

    // 2. 如果返回的是异步任务凭证（status_url），开始轮询
    if (json.status_url) {
      const statusUrl = json.status_url;
      let attempts = 0;
      
      // 最多轮询 20 次，每次间隔 1.5 秒（给大图留足时间）
      while (attempts < 20) {
        await new Promise(r => setTimeout(r, 1500)); // 等待 1.5 秒
        const statusRes = await fetch(statusUrl);
        const statusJson = await statusRes.json();

        if (statusJson.status === "succeeded" || statusJson.status === "completed") {
          const finalUrl = statusJson.result?.image_url || statusJson.result_url || statusJson.result?.[0]?.url;
          if (finalUrl) {
            return await fetchImageAndReturn(finalUrl, corsHeaders);
          }
        }
        
        if (statusJson.status === "failed" || statusJson.status === "error") {
          return new Response(JSON.stringify({ error: "BRIA 处理失败", raw: statusJson }), { 
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        attempts++;
      }
      
      return new Response(JSON.stringify({ error: "处理超时（超过30秒）", raw: json }), { 
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 如果都不是，把原始 JSON 抛出
    return new Response(JSON.stringify({ error: "未知的响应格式", raw: json }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// 辅助函数：下载图片并返回
async function fetchImageAndReturn(imageUrl, corsHeaders) {
  const imgRes = await fetch(imageUrl);
  const imgHeaders = new Headers();
  imgHeaders.set("Content-Type", imgRes.headers.get("content-type") || "image/png");
  for (const [key, value] of Object.entries(corsHeaders)) imgHeaders.set(key, value);
  return new Response(imgRes.body, { status: 200, headers: imgHeaders });
}
