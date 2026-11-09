// Rebuild's only AI door: the app sends a prompt (plus meal or scan photos), Claude replies with JSON text.
// The key lives in this function's secrets; the phone never sees it.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const EFFORTS = new Set(["low", "medium", "high"]);
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (code: string, status = 200) => reply({ error: { code } }, status);
function tokenRole(req: Request): string | null {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const part = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(part + "=".repeat((4 - (part.length % 4)) % 4)));
    return claims.sub ? claims.role : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("bad_request", 405);
  // the gateway has already checked the token's signature; only a signed-in user may spend API credit, never the public key
  if (tokenRole(req) !== "authenticated") return fail("signed_out", 401);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return fail("no_key");

  let body: { prompt?: unknown; images?: unknown; effort?: unknown };
  try { body = await req.json(); } catch { return fail("bad_request", 400); }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const images = Array.isArray(body.images) ? body.images.filter((x): x is string => typeof x === "string") : [];
  const effort = typeof body.effort === "string" && EFFORTS.has(body.effort) ? body.effort : "medium";
  if (!prompt || prompt.length > 200_000 || images.length > 4) return fail("bad_request", 400);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map((data) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
    })),
    { type: "text", text: prompt },
  ];
  const client = new Anthropic({ apiKey });
  const ask = (withFallback: boolean) =>
    client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: effort as "low" | "medium" | "high" },
      messages: [{ role: "user", content }],
      ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

  try {
    let res;
    try {
      res = await ask(true);
    } catch (e) {
      // if the fallback option is ever rejected, answer without it rather than failing the meal
      if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) res = await ask(false);
      else throw e;
    }
    if (res.stop_reason === "refusal") return fail("refused");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    if (!text.trim()) return fail("empty_completion");
    return reply({ text, stop: res.stop_reason, usage: res.usage });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return fail("bad_key");
    if (e instanceof Anthropic.RateLimitError) return fail("rate_limited");
    if (e instanceof Anthropic.BadRequestError) {
      console.error("bad request", e.message);
      return fail(/image/i.test(e.message) ? "image_rejected" : /credit|billing|balance/i.test(e.message) ? "no_credit" : "bad_request");
    }
    if (e instanceof Anthropic.APIError) { console.error("api", e.status, e.message); return fail("upstream"); }
    console.error(e);
    return fail("upstream");
  }
});
