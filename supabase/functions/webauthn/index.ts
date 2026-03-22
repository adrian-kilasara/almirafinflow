import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

// In-memory challenge store (short-lived)
const challengeStore = new Map<string, { challenge: string; timestamp: number }>();

function cleanExpiredChallenges() {
  const now = Date.now();
  for (const [key, val] of challengeStore) {
    if (now - val.timestamp > 5 * 60 * 1000) challengeStore.delete(key);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const body = await req.json();
    const { action } = body;

    // Create client for user-authenticated actions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    // Get origin for RP ID
    const origin = req.headers.get("origin") || "https://localhost";
    const rpId = new URL(origin).hostname;

    if (action === "register-challenge") {
      // User must be authenticated
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const challenge = generateChallenge();
      challengeStore.set(user.id, { challenge, timestamp: Date.now() });
      cleanExpiredChallenges();

      return new Response(JSON.stringify({
        challenge,
        rp: { name: "FinFlow 2026", id: rpId },
        user: {
          id: user.id,
          name: user.email || user.phone || "User",
          displayName: user.user_metadata?.full_name || user.email || "User",
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "register-verify") {
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const stored = challengeStore.get(user.id);
      if (!stored) {
        return new Response(JSON.stringify({ error: "No pending challenge" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      challengeStore.delete(user.id);

      const { credentialId, publicKey, deviceName } = body;

      // Store credential
      const { error: insertError } = await supabaseAdmin
        .from("user_webauthn_credentials")
        .insert({
          user_id: user.id,
          credential_id: credentialId,
          public_key: publicKey,
          device_name: deviceName || "Biometric Device",
        });

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "auth-challenge") {
      const challenge = generateChallenge();
      const tempId = body.tempId || crypto.randomUUID();
      challengeStore.set(`auth_${tempId}`, { challenge, timestamp: Date.now() });
      cleanExpiredChallenges();

      // Get all credential IDs for the auth flow
      const { data: credentials } = await supabaseAdmin
        .from("user_webauthn_credentials")
        .select("credential_id");

      return new Response(JSON.stringify({
        challenge,
        tempId,
        allowCredentials: (credentials || []).map((c: any) => c.credential_id),
        rpId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "auth-verify") {
      const { credentialId, tempId } = body;

      const stored = challengeStore.get(`auth_${tempId}`);
      if (!stored) {
        return new Response(JSON.stringify({ error: "No pending challenge" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      challengeStore.delete(`auth_${tempId}`);

      // Find the credential and associated user
      const { data: credential, error: credError } = await supabaseAdmin
        .from("user_webauthn_credentials")
        .select("*")
        .eq("credential_id", credentialId)
        .single();

      if (credError || !credential) {
        return new Response(JSON.stringify({ error: "Credential not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update last used and counter
      await supabaseAdmin
        .from("user_webauthn_credentials")
        .update({ last_used_at: new Date().toISOString(), counter: credential.counter + 1 })
        .eq("id", credential.id);

      // Get user email to generate a magic link token
      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(credential.user_id);

      if (!authUser?.email) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate a magic link for the user
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: authUser.email,
      });

      if (linkError) {
        return new Response(JSON.stringify({ error: linkError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        token: linkData.properties?.hashed_token,
        email: authUser.email,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
