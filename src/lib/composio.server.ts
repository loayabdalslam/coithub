// Composio v3 REST helpers. Server-only — the workspace's Composio API key is
// never exposed to the browser.
// Docs: https://docs.composio.dev/api-reference/introduction

const BASE = "https://backend.composio.dev/api/v3";

async function composio<T>(
  apiKey: string,
  path: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string | undefined> },
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(init?.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString(), {
    method: init?.method ?? "GET",
    headers: {
      "x-api-key": apiKey,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error("Composio: invalid API key. An admin can update it in Settings → Integrations.");
    }
    throw new Error(`Composio error ${resp.status}: ${text.slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export type ComposioToolkit = {
  slug: string;
  name: string;
  description: string;
  logo: string | null;
  categories: string[];
  toolsCount: number;
  noAuth: boolean;
};

export async function listToolkits(apiKey: string, search?: string): Promise<ComposioToolkit[]> {
  const json = await composio<{ items?: Record<string, unknown>[] }>(apiKey, "/toolkits", {
    query: { search, limit: "60", sort_by: "usage", managed_by: "composio" },
  });
  return (json.items ?? []).map((t) => {
    const meta = (t.meta ?? {}) as Record<string, unknown>;
    const cats = (meta.categories ?? []) as { name?: string }[];
    return {
      slug: String(t.slug ?? ""),
      name: String(t.name ?? t.slug ?? ""),
      description: String(meta.description ?? ""),
      logo: (meta.logo as string | undefined) ?? null,
      categories: cats.map((c) => String(c.name ?? "")).filter(Boolean),
      toolsCount: Number(meta.tools_count ?? 0),
      noAuth: Boolean(t.no_auth),
    };
  });
}

export async function createAuthConfig(apiKey: string, toolkit: string): Promise<string> {
  const json = await composio<{ auth_config?: { id?: string } }>(apiKey, "/auth_configs", {
    method: "POST",
    body: { toolkit: { slug: toolkit } },
  });
  const id = json.auth_config?.id;
  if (!id) throw new Error(`Composio: could not create an auth config for ${toolkit}.`);
  return id;
}

export async function initiateConnection(
  apiKey: string,
  authConfigId: string,
  userId: string,
): Promise<{ id: string; status: string; redirectUrl: string | null }> {
  const json = await composio<{
    id?: string;
    status?: string;
    redirect_url?: string | null;
    redirect_uri?: string | null;
  }>(apiKey, "/connected_accounts", {
    method: "POST",
    body: { auth_config: { id: authConfigId }, connection: { user_id: userId } },
  });
  return {
    id: String(json.id ?? ""),
    status: String(json.status ?? "INITIALIZING"),
    redirectUrl: json.redirect_url ?? json.redirect_uri ?? null,
  };
}

export async function getConnection(
  apiKey: string,
  connectedAccountId: string,
): Promise<{ status: string }> {
  const json = await composio<{ status?: string }>(apiKey, `/connected_accounts/${connectedAccountId}`);
  return { status: String(json.status ?? "UNKNOWN") };
}

export async function deleteConnection(apiKey: string, connectedAccountId: string): Promise<void> {
  await composio(apiKey, `/connected_accounts/${connectedAccountId}`, { method: "DELETE" });
}

export type OpenAITool = {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
};

const ALLOWED_KEYS = new Set([
  "type",
  "description",
  "properties",
  "items",
  "required",
  "enum",
  "anyOf",
  "oneOf",
  "allOf",
  "additionalProperties",
  "nullable",
  "default",
  "title",
]);

const VALID_TYPES = new Set([
  "string",
  "number",
  "integer",
  "boolean",
  "object",
  "array",
  "null",
]);

/**
 * Composio ships loose JSON Schema fragments (custom keywords, bad `format`,
 * missing `type`, etc). Groq/OpenAI compile the schema strictly and reject the
 * whole request, so normalise everything to a safe draft-2020-12 subset.
 */
function sanitizeSchema(node: unknown, depth = 0): Record<string, unknown> {
  if (!node || typeof node !== "object" || Array.isArray(node) || depth > 6) {
    return { type: "string" };
  }
  const src = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(src)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    if (k === "properties" || k === "items" || k === "anyOf" || k === "oneOf" || k === "allOf") continue;
    if (k === "type") {
      const t = Array.isArray(v) ? v.find((x) => VALID_TYPES.has(String(x))) : v;
      if (t && VALID_TYPES.has(String(t))) out.type = String(t);
      continue;
    }
    if (k === "description" || k === "title") {
      if (typeof v === "string") out[k] = v.slice(0, 300);
      continue;
    }
    if (k === "enum") {
      if (Array.isArray(v) && v.length > 0) out.enum = v.filter((x) => typeof x !== "object");
      continue;
    }
    if (k === "required") {
      if (Array.isArray(v)) out.required = v.filter((x) => typeof x === "string");
      continue;
    }
    if (k === "additionalProperties" || k === "nullable") {
      if (typeof v === "boolean") out[k] = v;
      continue;
    }
    out[k] = v;
  }

  if (src.properties && typeof src.properties === "object" && !Array.isArray(src.properties)) {
    const props: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(src.properties as Record<string, unknown>)) {
      props[name] = sanitizeSchema(spec, depth + 1);
    }
    out.properties = props;
    out.type = "object";
  }

  if (src.items !== undefined) {
    out.items = sanitizeSchema(src.items, depth + 1);
    out.type = "array";
  }

  if (!out.type) out.type = out.enum ? "string" : "string";
  if (out.type === "object" && !out.properties) out.properties = {};
  if (out.type === "array" && !out.items) out.items = { type: "string" };
  if (out.required && out.type !== "object") delete out.required;

  return out;
}

/** Fetch a toolkit's tools already mapped to OpenAI function-calling shape. */
export async function listToolsAsOpenAI(
  apiKey: string,
  toolkitSlug: string,
  limit = 12,
): Promise<OpenAITool[]> {
  const json = await composio<{ items?: Record<string, unknown>[] }>(apiKey, "/tools", {
    query: {
      toolkit_slug: toolkitSlug,
      important: "true",
      toolkit_versions: "latest",
      limit: String(limit),
    },
  });
  return (json.items ?? []).map((t) => {
    const input = (t.input_parameters ?? {}) as Record<string, unknown>;
    const rawProps = (input.properties ?? input) as Record<string, unknown>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [name, spec] of Object.entries(rawProps)) {
      if (!spec || typeof spec !== "object") continue;
      const s = spec as Record<string, unknown>;
      if (s.required === true) required.push(name);
      properties[name] = sanitizeSchema(s);
    }
    if (Array.isArray(input.required)) {
      for (const r of input.required as unknown[]) {
        if (typeof r === "string" && properties[r] && !required.includes(r)) required.push(r);
      }
    }
    return {
      type: "function" as const,
      function: {
        name: String(t.slug ?? ""),
        description: String(t.description ?? "").slice(0, 900),
        parameters: { type: "object", properties, required },
      },
    };
  });
}


export async function executeTool(
  apiKey: string,
  toolSlug: string,
  userId: string,
  args: Record<string, unknown>,
  connectedAccountId?: string | null,
): Promise<unknown> {
  const json = await composio<{ data?: unknown; error?: unknown; successful?: boolean }>(
    apiKey,
    `/tools/execute/${encodeURIComponent(toolSlug)}`,
    {
      method: "POST",
      body: {
        user_id: userId,
        arguments: args,
        ...(connectedAccountId ? { connected_account_id: connectedAccountId } : {}),
      },
    },
  );
  if (json.successful === false) {
    return { error: json.error ?? "Tool execution failed", data: json.data ?? null };
  }
  return json.data ?? null;
}
