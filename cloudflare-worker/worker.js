/**
 * Cloudflare Worker for Free AI Image Generation
 * Adapted from https://github.com/saurav-z/free-image-generation-api (MIT License)
 *
 * Cloudflare Dashboard Setup:
 * 1. Create a Worker and paste this code, then click "Deploy".
 * 2. Settings -> Variables and Secrets -> Add Secret/Variable:
 *      Name: API_KEY   Value: <your-chosen-secret-key>
 * 3. Settings -> Bindings -> Add Binding -> Workers AI: Variable name: AI
 * 4. Copy your Worker URL (https://<name>.<subdomain>.workers.dev) and API_KEY
 *    into CF_WORKER_URL and CF_WORKER_API_KEY in your .env file.
 */

export default {
    async fetch(request, env) {
        const API_KEY = env.API_KEY;
        const url = new URL(request.url);
        const auth = request.headers.get("Authorization");

        // Simple Bearer API key check
        if (!API_KEY || auth !== `Bearer ${API_KEY}`) {
            return json({ error: "Unauthorized" }, 401);
        }

        // Only allow POST requests to /
        if (request.method !== "POST" || url.pathname !== "/") {
            return json({ error: "Not allowed" }, 405);
        }

        try {
            const { prompt } = await request.json();

            if (!prompt) return json({ error: "Prompt is required" }, 400);

            if (!env.AI) {
                return json(
                    { error: "Workers AI binding missing", details: "Add a Workers AI binding named 'AI' in Worker Settings -> Bindings." },
                    500
                );
            }

            // Supported Cloudflare Workers AI text-to-image models:
            //   "@cf/stabilityai/stable-diffusion-xl-base-1.0" (default)
            //   "@cf/bytedance/stable-diffusion-xl-lightning"  (fast SDXL)
            //   "@cf/black-forest-labs/flux-1-schnell"         (FLUX.1 schnell)
            //   "@cf/lykon/dreamshaper-8-lcm"
            const model = env.MODEL || "@cf/stabilityai/stable-diffusion-xl-base-1.0";

            const result = await env.AI.run(model, { prompt });

            // FLUX models return { image: "<base64>" } JSON; SDXL returns a binary image stream
            if (result && typeof result === "object" && typeof result.image === "string") {
                return json({ image: result.image, model }, 200);
            }

            return new Response(result, {
                headers: { "Content-Type": "image/jpeg" },
            });
        } catch (err) {
            return json({ error: "Failed to generate image", details: err.message }, 500);
        }
    },
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

