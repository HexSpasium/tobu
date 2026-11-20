import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Oturum gerekli." }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) return json({ error: "Sunucu yönetim anahtarı eksik." }, 500);

  const auth = createClient(url, anon, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await auth.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Oturum geçersiz." }, 401);

  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const { data: actor } = await admin.from("staff_profiles").select("role,is_active")
    .eq("user_id", userData.user.id).maybeSingle();
  if (actor?.role !== "central_admin" || actor.is_active !== true)
    return json({ error: "Yalnızca merkez yöneticisi kullanıcı oluşturabilir." }, 403);

  const input = await req.json();
  const username = String(input.username || "").trim().toLowerCase();
  const password = String(input.password || "");
  const displayName = String(input.display_name || "").trim();
  const role = String(input.role || "cashier");
  const branchId = String(input.branch_id || "");
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return json({ error: "Kullanıcı adı geçersiz." }, 400);
  if (password.length < 8 || !displayName || !branchId) return json({ error: "Ad, şube ve en az 8 karakterli parola gereklidir." }, 400);
  if (!["cashier", "branch_manager"].includes(role)) return json({ error: "Rol geçersiz." }, 400);

  const { data: branch } = await admin.from("branches").select("id,is_enabled").eq("id", branchId).maybeSingle();
  if (!branch?.is_enabled) return json({ error: "Şube aktif değil." }, 400);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: username + "@tobu.local", password, email_confirm: true
  });
  if (createError || !created.user) return json({ error: createError?.message || "Kullanıcı oluşturulamadı." }, 400);

  const { error: profileError } = await admin.from("staff_profiles").insert({
    user_id: created.user.id, username, display_name: displayName, role, branch_id: branchId, is_active: true
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: profileError.message }, 400);
  }
  return json({ ok: true, username });
});
