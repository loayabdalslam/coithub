import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AGENTS, AGENT_LIST, type AgentSlug } from "./agents";

type RunInput = {
  workspaceId: string;
  agentSlug: AgentSlug;
  kind: "dashboard" | "file" | "docs" | "workflow";
  title: string;
  prompt: string;
};

function validate(input: unknown): RunInput {
  const i = input as RunInput;
  if (
    !i ||
    typeof i.workspaceId !== "string" ||
    typeof i.title !== "string" ||
    typeof i.prompt !== "string" ||
    !AGENT_LIST.includes(i.agentSlug) ||
    !["dashboard", "file", "docs", "workflow"].includes(i.kind)
  ) {
    throw new Error("Invalid input");
  }
  return i;
}

const KIND_INSTRUCTIONS: Record<RunInput["kind"], string> = {
  dashboard:
    "Produce a compact executive dashboard. Use Markdown with: an H2 title, 3–6 KPI bullets with bold metric names and values, a 2-column table for details, and a short 'Next actions' list. No preamble.",
  file:
    "Produce a structured file-style output as Markdown. Prefer a table (headers + rows) and/or a code block if raw data is more appropriate. No preamble.",
  docs:
    "Produce a documentation-style brief in Markdown. Include: H2 title, TL;DR (2–3 sentences), sections with H3 headings, and a short summary at the end. No preamble.",
  workflow:
    "Produce a numbered workflow in Markdown. Each step: bold action title, one-line description, optional owner. End with a 'Success criteria' bullet list. No preamble.",
};

export const runAgentWidget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { workspaceId, agentSlug, kind, title, prompt } = data;
    const { supabase, userId } = context;

    // Verify membership + fetch custom prompt override
    const { data: cfg, error: cfgErr } = await supabase
      .from("pet_configs")
      .select("model, provider, enabled, custom_system")
      .eq("workspace_id", workspaceId)
      .eq("pet_slug", agentSlug)
      .maybeSingle();
    if (cfgErr) throw new Error(cfgErr.message);

    // Insert pending row
    const { data: inserted, error: insErr } = await supabase
      .from("widgets" as never)
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        agent_slug: agentSlug,
        kind,
        title,
        prompt,
        content: {},
        status: "running",
      } as never)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    const widgetId = (inserted as { id: string }).id;

    try {
      const agent = AGENTS[agentSlug];
      const system =
        (cfg?.custom_system as string | null | undefined) || agent.system;
      const model = (cfg?.model as string | undefined) || "google/gemini-3-flash-preview";

      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("Missing LOVABLE_API_KEY on server.");

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `${system}\n\nYou are producing a background WIDGET of kind "${kind}" titled "${title}". ${KIND_INSTRUCTIONS[kind]} Reply with pure Markdown only — no preamble like "Sure" or "Here is". Stay under ~500 words.`,
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`AI ${resp.status}: ${text.slice(0, 300)}`);
      }
      const json = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const markdown = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (!markdown) throw new Error("Empty widget output.");

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("widgets" as never)
        .update({ status: "ready", content: { markdown } } as never)
        .eq("id", widgetId);

      return { id: widgetId, markdown };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("widgets" as never)
        .update({ status: "error", error: msg } as never)
        .eq("id", widgetId);
      throw e;
    }
  });
