export async function onRequest(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(context.request.url);
  const target = "https://api-inference.huggingface.co" + url.pathname + url.search;

  const newRequest = new Request(target, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  });

  try {
    const response = await fetch(newRequest);
    const newResponse = new Response(response.body, response);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newResponse.headers.set(key, value);
    }
    return newResponse;
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
