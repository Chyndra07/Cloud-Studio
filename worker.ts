interface Env {
  ASSETS: Fetcher;
  ADMIN_SECRET_KEY?: string;
}

const APP_PRODUCT_ID = "GALERIFOTOQR_CLOUD";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-admin-key",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // =========================================================
    // API HEALTH CHECK
    // =========================================================

    if (url.pathname === "/api/health") {
      return json({
        status: "ok",
        service: "GaleriFotoQR Cloud Studio",
        runtime: "Cloudflare Workers",
        productId: APP_PRODUCT_ID,
        timestamp: new Date().toISOString(),
      });
    }

    // =========================================================
    // API PLACEHOLDER
    // =========================================================
    //
    // Endpoint API aplikasi akan dipindahkan ke Worker secara
    // bertahap. Jangan arahkan /api/* ke SPA karena error API
    // akan terlihat sebagai HTML.
    //

    if (url.pathname.startsWith("/api/")) {
      return json(
        {
          success: false,
          errorCode: "API_NOT_IMPLEMENTED",
          errorMessage:
            "Endpoint API ini belum dipindahkan ke Cloudflare Worker.",
          path: url.pathname,
        },
        501
      );
    }

    // =========================================================
    // FRONTEND / STATIC ASSETS
    // =========================================================

    return env.ASSETS.fetch(request);
  },
};
