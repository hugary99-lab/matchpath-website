import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://matchpath.netlify.app",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const clean = (v: unknown, max = 12000) => String(v ?? "").trim().slice(0, max);

function outputText(raw: any) {
  if (typeof raw?.output_text === "string") return raw.output_text;
  let out = "";
  if (Array.isArray(raw?.output)) {
    for (const item of raw.output) {
      if (item?.type !== "message" || !Array.isArray(item.content)) continue;
      for (const part of item.content) {
        if (part?.type === "output_text" && typeof part.text === "string") out += part.text;
      }
    }
  }
  return out;
}

function slugify(value: unknown, fallback: string) {
  const s = clean(value, 120).toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s || fallback;
}

const transientOpenAIStatuses = new Set([429, 500, 502, 503, 504]);

async function fetchOpenAIWithRetry(url: string, init: RequestInit, maxAttempts = 3) {
  let lastResponse: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, init);
    lastResponse = response;
    if (response.ok || !transientOpenAIStatuses.has(response.status) || attempt === maxAttempts) {
      return response;
    }
    const retryAfter = Number(response.headers.get("retry-after") || "");
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 15000)
      : 1500 * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return lastResponse!;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return respond({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await admin.auth.getUser(auth.slice(7));
    if (userError || !user) return respond({ error: "Invalid session" }, 401);

    const input = await req.json().catch(() => ({}));
    const customerId = clean(input.customer_id, 80);
    if (!/^[0-9a-f-]{36}$/i.test(customerId)) return respond({ error: "Valid customer required" }, 400);

    const [{ data: actor }, { data: profile, error: profileError }, { data: customer }] = await Promise.all([
      admin.from("accounts").select("role").eq("id", user.id).single(),
      admin.from("customer_profiles").select(
        "customer_id,target_roles,preferred_locations,industries,employment_types,work_preference,career_goals,search_instructions,exclusions,transferable_roles,pension_preferences,updated_at"
      ).eq("customer_id", customerId).single(),
      admin.from("accounts").select("full_name,email").eq("id", customerId).single(),
    ]);

    if (profileError || !profile) return respond({ error: "Customer profile not found" }, 404);

    let authorized = actor?.role === "admin";
    if (!authorized && actor?.role === "staff") {
      const { data: assignment } = await admin.from("staff_assignments")
        .select("customer_id").eq("staff_id", user.id).eq("customer_id", customerId).maybeSingle();
      authorized = !!assignment;
    }
    if (!authorized && actor?.role === "customer") authorized = user.id === customerId;
    if (!authorized) return respond({ error: "Not authorized for this customer" }, 403);

    const { data: evidence, error: evidenceError } = await admin.from("candidate_evidence_versions")
      .select("*").eq("customer_id", customerId).order("version", { ascending: false }).limit(1).maybeSingle();
    if (evidenceError || !evidence) return respond({ error: "Run Resume Analysis before generating general resumes." }, 400);

    const { data: strategy, error: strategyError } = await admin.from("search_strategy_versions")
      .select("*").eq("customer_id", customerId).eq("status", "current")
      .order("version", { ascending: false }).limit(1).maybeSingle();
    if (strategyError || !strategy) return respond({ error: "Activate an AI Search Strategy before generating general resumes." }, 400);

    if (String(strategy.source_evidence_id) !== String(evidence.id)) {
      return respond({ error: "The active AI Search Strategy was built from older Candidate Evidence. Build and activate a new strategy first." }, 409);
    }

    const { data: resumes, error: resumeError } = await admin.from("reference_resumes")
      .select("id,storage_path,original_filename,created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true })
      .limit(5);
    if (resumeError || !resumes?.length) return respond({ error: "At least one original/reference resume is required." }, 400);

    const currentResumeIds = resumes.map((r: any) => String(r.id)).sort();
    const evidenceResumeIds = (evidence.source_resume_ids || []).map(String).sort();
    const evidenceCurrent = currentResumeIds.length === evidenceResumeIds.length &&
      currentResumeIds.every((id: string, i: number) => id === evidenceResumeIds[i]);
    if (!evidenceCurrent) return respond({ error: "Reference resumes changed. Re-run Resume Analysis and rebuild the strategy first." }, 409);

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return respond({ error: "OpenAI resume generation is not configured." }, 503);

    const fileInputs: any[] = [];
    for (const row of resumes) {
      const { data: signed, error: signedError } = await admin.storage
        .from("matchpath-profiles").createSignedUrl(row.storage_path, 300);
      if (signedError || !signed?.signedUrl) return respond({ error: "Could not securely prepare a reference resume." }, 500);
      fileInputs.push({ type: "input_file", file_url: signed.signedUrl });
    }

    const experienceItem = {
      type: "object",
      properties: {
        employer: { type: "string" },
        title: { type: "string" },
        location: { type: "string" },
        dates: { type: "string" },
        bullets: { type: "array", items: { type: "string" }, maxItems: 12 }
      },
      required: ["employer","title","location","dates","bullets"],
      additionalProperties: false
    };

    const resumeSchema = {
      type: "object",
      properties: {
        candidate_name: { type: "string" },
        contact_lines: { type: "array", items: { type: "string" }, maxItems: 4 },
        headline: { type: "string" },
        professional_summary: { type: "string" },
        core_competencies: { type: "array", items: { type: "string" }, maxItems: 24 },
        systems_tools: { type: "array", items: { type: "string" }, maxItems: 24 },
        experience: { type: "array", items: experienceItem, maxItems: 20 },
        education: { type: "array", items: { type: "string" }, maxItems: 12 },
        certifications: { type: "array", items: { type: "string" }, maxItems: 12 },
        additional_sections: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              heading: { type: "string" },
              items: { type: "array", items: { type: "string" }, maxItems: 16 }
            },
            required: ["heading","items"],
            additionalProperties: false
          }
        }
      },
      required: [
        "candidate_name","contact_lines","headline","professional_summary","core_competencies",
        "systems_tools","experience","education","certifications","additional_sections"
      ],
      additionalProperties: false
    };

    const schema = {
      type: "object",
      properties: {
        categories: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              category_key: { type: "string" },
              category_name: { type: "string" },
              target_roles: { type: "array", items: { type: "string" }, maxItems: 12 },
              focus_summary: { type: "string" },
              resume: resumeSchema
            },
            required: ["category_key","category_name","target_roles","focus_summary","resume"],
            additionalProperties: false
          }
        }
      },
      required: ["categories"],
      additionalProperties: false
    };

    const context = {
      customer_profile: {
        target_roles: clean(profile.target_roles),
        transferable_roles: clean(profile.transferable_roles),
        preferred_locations: clean(profile.preferred_locations),
        industries: clean(profile.industries),
        employment_types: clean(profile.employment_types),
        work_preference: clean(profile.work_preference),
        career_goals: clean(profile.career_goals),
        search_instructions: clean(profile.search_instructions),
        exclusions: clean(profile.exclusions),
        pension_preferences: clean(profile.pension_preferences)
      },
      candidate_evidence: evidence.evidence_json,
      active_search_strategy: strategy.strategy_json,
      account_header: {
        full_name: clean(customer?.full_name, 200),
        email: clean(customer?.email, 240)
      },
      reference_resume_count: resumes.length
    };

    const system = [
      "You are MatchPath's General Resume architect.",
      "Create a reusable library of baseline resumes by career category from the active Search Strategy, Candidate Evidence, customer profile and attached original/reference resumes.",
      "Choose only meaningfully distinct categories. Usually produce 2 to 4 categories; produce 1 only when the strategy truly represents a single career lane.",
      "Every experience, skill, system, responsibility, capability, industry exposure or credential explicitly claimed in the resumes may be used as candidate experience.",
      "Do not downgrade candidate-stated experience merely because role bullets are thin.",
      "However, never invent employers, titles, dates, credentials, achievements, metrics, responsibilities, systems, industries or business outcomes.",
      "Resume-strengthening recommendations may guide what should be emphasized, but they are not permission to fabricate missing facts.",
      "Preserve employer names, job titles and employment dates from the source resumes. Reorder or rewrite bullets only when the factual meaning remains supported.",
      "Each category resume should be a strong ATS-friendly baseline for that job lane, not tailored to one specific posting.",
      "Use the same factual career history across categories while changing the headline, summary, skills ordering and emphasis of supported experience.",
      "Preserve the candidate's actual name and contact details from the source resume where available. Do not invent missing contact information.",
      "Avoid decorative formatting, tables, graphics, ratings, first-person language and generic filler.",
      "Return structured JSON only."
    ].join("\n");

    const response = await fetchOpenAIWithRetry("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: "Bearer " + openaiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_PROFILE_MODEL") || Deno.env.get("OPENAI_SEARCH_MODEL") || "gpt-6.1-sol",
        store: false,
        reasoning: { effort: "medium" },
        input: [
          { role: "system", content: system },
          { role: "user", content: [
            { type: "input_text", text: JSON.stringify(context, null, 2) },
            ...fileInputs
          ] }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "matchpath_general_resume_library",
            strict: true,
            schema
          }
        }
      })
    });

    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
      const upstreamMessage = raw?.error?.message || "General resume generation failed";
      const transient = transientOpenAIStatuses.has(response.status);
      return respond({
        error: transient
          ? "AI resume generation remained temporarily unavailable after automatic retries. Please try Generate General Resumes again."
          : upstreamMessage,
        upstream_status: response.status
      }, 502);
    }

    let parsed: any;
    try { parsed = JSON.parse(outputText(raw)); }
    catch { return respond({ error: "OpenAI returned invalid general resume JSON" }, 502); }

    const categories = Array.isArray(parsed?.categories) ? parsed.categories.slice(0, 4) : [];
    if (!categories.length) return respond({ error: "OpenAI returned no resume categories" }, 502);

    const used = new Set<string>();
    const prepared: any[] = [];
    for (let i = 0; i < categories.length; i++) {
      const item = categories[i] || {};
      let key = slugify(item.category_key || item.category_name, "category-" + (i + 1));
      const base = key;
      let suffix = 2;
      while (used.has(key)) key = (base + "-" + suffix++).slice(0, 80);
      used.add(key);

      const { data: last } = await admin.from("general_resume_versions")
        .select("version").eq("customer_id", customerId).eq("category_key", key)
        .order("version", { ascending: false }).limit(1).maybeSingle();

      prepared.push({
        customer_id: customerId,
        category_key: key,
        category_name: clean(item.category_name, 180) || "General Resume",
        version: Number(last?.version || 0) + 1,
        source_evidence_id: evidence.id,
        source_strategy_id: strategy.id,
        target_roles: Array.isArray(item.target_roles) ? item.target_roles.map((x: any) => clean(x, 160)).filter(Boolean).slice(0, 12) : [],
        focus_summary: clean(item.focus_summary, 1200),
        resume_json: item.resume || {},
        status: "archived",
        model: raw.model || Deno.env.get("OPENAI_PROFILE_MODEL") || Deno.env.get("OPENAI_SEARCH_MODEL") || "gpt-6.1-sol",
        response_id: raw.id || null,
        generated_by: user.id
      });
    }

    const { data: inserted, error: insertError } = await admin.from("general_resume_versions")
      .insert(prepared).select("*");
    if (insertError || !inserted?.length) return respond({ error: "General resumes were generated but could not be saved: " + (insertError?.message || "unknown save error") }, 500);

    const ids = inserted.map((x: any) => x.id);
    await admin.from("general_resume_versions")
      .update({ status: "archived" })
      .eq("customer_id", customerId)
      .eq("status", "current");

    const { data: currentRows, error: currentError } = await admin.from("general_resume_versions")
      .update({ status: "current" })
      .in("id", ids)
      .select("*");
    if (currentError) return respond({ error: "General resumes were saved but could not be activated: " + currentError.message }, 500);

    await admin.from("audit_events").insert({
      actor_id: user.id,
      customer_id: customerId,
      action: "general_resume_library_generated",
      details: {
        evidence_id: evidence.id,
        strategy_id: strategy.id,
        category_count: currentRows?.length || ids.length,
        categories: prepared.map((x: any) => x.category_key)
      }
    });

    return respond({
      ok: true,
      categories: currentRows || inserted,
      count: currentRows?.length || inserted.length,
      evidence_version: evidence.version,
      strategy_version: strategy.version
    });
  } catch (e) {
    return respond({ error: e instanceof Error ? e.message : "Unexpected general resume generation error" }, 500);
  }
});
