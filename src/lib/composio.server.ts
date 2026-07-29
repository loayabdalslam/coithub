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
    const input = (t.input_parameters ?? {}) as Record<string, Record<string, unknown>>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [name, spec] of Object.entries(input)) {
      const { required: req, examples: _ex, ...rest } = spec;
      properties[name] = rest;
      if (req) required.push(name);
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
