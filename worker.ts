interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
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

async function readJson(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function cleanGalleryId(value: string): string {
  return String(value || "").trim().toUpperCase();
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // =========================================================
    // CORS
    // =========================================================

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // =========================================================
    // HEALTH CHECK
    // =========================================================

    if (pathname === "/api/health" && request.method === "GET") {
      try {
        await env.DB.prepare("SELECT 1").first();

        return json({
          status: "ok",
          service: "GaleriFotoQR Cloud Studio",
          runtime: "Cloudflare Workers",
          database: "D1 connected",
          productId: APP_PRODUCT_ID,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[HEALTH] D1 error:", error);

        return json(
          {
            status: "error",
            service: "GaleriFotoQR Cloud Studio",
            runtime: "Cloudflare Workers",
            database: "D1 unavailable",
            productId: APP_PRODUCT_ID,
            timestamp: new Date().toISOString(),
          },
          500
        );
      }
    }

    // =========================================================
    // GET PUBLIC GALLERY
    // GET /api/gallery/:galleryId
    // =========================================================

    if (
      request.method === "GET" &&
      pathname.startsWith("/api/gallery/") &&
      !pathname.startsWith("/api/gallery/selection/")
    ) {
      try {
        const galleryId = cleanGalleryId(
          decodeURIComponent(pathname.substring("/api/gallery/".length))
        );

        if (!galleryId) {
          return json(
            {
              success: false,
              error: "Gallery ID is required.",
            },
            400
          );
        }

        const row = await env.DB
          .prepare(
            `
            SELECT data
            FROM public_galleries
            WHERE gallery_id = ?
            LIMIT 1
            `
          )
          .bind(galleryId)
          .first<{ data: string }>();

        if (!row) {
          return json(
            {
              success: false,
              error: `Galeri dengan ID "${galleryId}" tidak ditemukan atau belum dipublikasikan.`,
            },
            404
          );
        }

        const gallery = JSON.parse(row.data);

        if (gallery.expirationDate) {
          const expired =
            new Date(gallery.expirationDate).getTime() < Date.now();

          gallery.isExpired = expired;

          if (expired) {
            gallery.status = "expired";
          }
        }

        return json({
          success: true,
          data: gallery,
        });
      } catch (error) {
        console.error("[GALLERY] GET error:", error);

        return json(
          {
            success: false,
            error: "Internal server error while loading gallery.",
          },
          500
        );
      }
    }

    // =========================================================
    // SYNC / PUBLISH PUBLIC GALLERY
    // POST /api/gallery/sync
    // =========================================================

    if (
      pathname === "/api/gallery/sync" &&
      request.method === "POST"
    ) {
      try {
        const data = await readJson(request);

        if (!data || !data.galleryId || !data.albumName) {
          return json(
            {
              success: false,
              error:
                "Invalid public gallery payload: galleryId and albumName are required.",
            },
            400
          );
        }

        const galleryId = cleanGalleryId(data.galleryId);
        const now = new Date().toISOString();

        data.galleryId = galleryId;
        data.updatedAt = now;

        await env.DB
          .prepare(
            `
            INSERT INTO public_galleries
              (gallery_id, data, created_at, updated_at)
            VALUES
              (?, ?, ?, ?)

            ON CONFLICT(gallery_id)
            DO UPDATE SET
              data = excluded.data,
              updated_at = excluded.updated_at
            `
          )
          .bind(
            galleryId,
            JSON.stringify(data),
            data.createdAt || now,
            now
          )
          .run();

        return json({
          success: true,
          message: "Gallery synced successfully.",
          galleryId,
        });
      } catch (error) {
        console.error("[GALLERY] SYNC error:", error);

        return json(
          {
            success: false,
            error: "Internal server error while syncing gallery.",
          },
          500
        );
      }
    }

    // =========================================================
    // GET CLIENT SELECTION
    // GET /api/gallery/selection/:galleryId
    // =========================================================

    if (
      request.method === "GET" &&
      pathname.startsWith("/api/gallery/selection/")
    ) {
      try {
        const galleryId = cleanGalleryId(
          decodeURIComponent(
            pathname.substring("/api/gallery/selection/".length)
          )
        );

        if (!galleryId) {
          return json(
            {
              success: false,
              error: "Gallery ID is required.",
            },
            400
          );
        }

        const row = await env.DB
          .prepare(
            `
            SELECT data
            FROM client_selections
            WHERE gallery_id = ?
            LIMIT 1
            `
          )
          .bind(galleryId)
          .first<{ data: string }>();

        if (!row) {
          return json({
            success: true,
            data: {
              galleryId,
              selectedPhotoIds: [],
              notes: {},
              updatedAt: new Date().toISOString(),
            },
          });
        }

        return json({
          success: true,
          data: JSON.parse(row.data),
        });
      } catch (error) {
        console.error("[SELECTION] GET error:", error);

        return json(
          {
            success: false,
            error: "Failed to retrieve client selection.",
          },
          500
        );
      }
    }

    // =========================================================
    // SAVE CLIENT SELECTION
    // POST /api/gallery/selection
    // =========================================================

    if (
      pathname === "/api/gallery/selection" &&
      request.method === "POST"
    ) {
      try {
        const selection = await readJson(request);

        if (!selection || !selection.galleryId) {
          return json(
            {
              success: false,
              error: "Invalid client selection payload.",
            },
            400
          );
        }

        const galleryId = cleanGalleryId(selection.galleryId);
        const now = new Date().toISOString();

        selection.galleryId = galleryId;
        selection.updatedAt = now;

        await env.DB
          .prepare(
            `
            INSERT INTO client_selections
              (gallery_id, data, created_at, updated_at)
            VALUES
              (?, ?, ?, ?)

            ON CONFLICT(gallery_id)
            DO UPDATE SET
              data = excluded.data,
              updated_at = excluded.updated_at
            `
          )
          .bind(
            galleryId,
            JSON.stringify(selection),
            selection.createdAt || now,
            now
          )
          .run();

        return json({
          success: true,
          message: "Client selection saved successfully.",
        });
      } catch (error) {
        console.error("[SELECTION] SAVE error:", error);

        return json(
          {
            success: false,
            error: "Failed to save client selection.",
          },
          500
        );
      }
    }

    // =========================================================
    // OTHER API ENDPOINTS
    // =========================================================

    if (pathname.startsWith("/api/")) {
      return json(
        {
          success: false,
          errorCode: "API_NOT_IMPLEMENTED",
          errorMessage:
            "Endpoint API ini belum dipindahkan ke Cloudflare Worker.",
          path: pathname,
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
