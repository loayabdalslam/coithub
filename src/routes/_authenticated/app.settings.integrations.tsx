import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { ToolkitIcon } from "@/lib/composio-icons";
import { PetAvatar } from "@/components/PetAvatar";
import {
  searchToolkits,
  connectToolkit,
  refreshIntegration,
  disconnectToolkit,
} from "@/lib/composio.functions";

export const Route = createFileRoute("/_authenticated/app/settings/integrations")({
  component: IntegrationsSettings,
  head: () => ({
    meta: [
      { title: "Integrations · Coithub" },
      {
        name: "description",
        content:
          "Connect Gmail, Slack, Notion, GitHub and 250+ apps through Composio so your AI agents can act across the whole workspace.",
      },
      { property: "og:title", content: "Integrations · Coithub" },
      {
        property: "og:description",
        content: "Give your agents real tools with Composio integrations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Integration = {
  toolkit: string;
  status: string;
  enabled: boolean;
  connected_account_id: string | null;
};

function IntegrationsSettings() {
  const { data: workspace } = useWorkspace();
  const qc = useQueryClient();
  const doSearch = useServerFn(searchToolkits);
  const doConnect = useServerFn(connectToolkit);
  const doRefresh = useServerFn(refreshIntegration);
  const doDisconnect = useServerFn(disconnectToolkit);

  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace) return;
    supabase
      .from("workspace_api_keys" as never)
      .select("provider")
      .eq("workspace_id", workspace.id)
      .eq("provider", "composio")
      .maybeSingle()
      .then(({ data }) => setHasKey(!!data));
  }, [workspace?.id]);

  const { data: integrations } = useQuery({
    queryKey: ["workspace_integrations", workspace?.id],
    enabled: !!workspace,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_integrations" as never)
        .select("toolkit, status, enabled, connected_account_id")
        .eq("workspace_id", workspace!.id);
      if (error) throw error;
      return (data ?? []) as unknown as Integration[];
    },
  });

  const { data: toolkits, isFetching } = useQuery({
    queryKey: ["composio_toolkits", workspace?.id, query],
    enabled: !!workspace && hasKey,
    queryFn: async () => (await doSearch({ data: { workspaceId: workspace!.id, search: query } })).toolkits,
  });

  async function saveKey() {
    if (!workspace || !apiKey.trim()) return;
    setBusy("key");
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("workspace_api_keys" as never).upsert(
      {
        workspace_id: workspace.id,
        provider: "composio",
        api_key: apiKey.trim(),
        updated_at: new Date().toISOString(),
        updated_by: user.user?.id ?? null,
      } as never,
      { onConflict: "workspace_id,provider" },
    );
    setBusy(null);
    if (error) return setMsg(error.message);
    setApiKey("");
    setHasKey(true);
    setMsg("Composio key saved for the whole workspace.");
  }

  async function connect(toolkit: string) {
    if (!workspace) return;
    setBusy(toolkit);
    setMsg(null);
    try {
      const res = await doConnect({ data: { workspaceId: workspace.id, toolkit } });
      await qc.invalidateQueries({ queryKey: ["workspace_integrations", workspace.id] });
      if (res.redirectUrl) {
        window.open(res.redirectUrl, "_blank", "noopener");
        setMsg("Finish authorising in the new tab, then hit Refresh below.");
      } else {
        setMsg(`${toolkit} connected.`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function refresh(toolkit: string) {
    if (!workspace) return;
    setBusy(toolkit);
    try {
      await doRefresh({ data: { workspaceId: workspace.id, toolkit } });
      await qc.invalidateQueries({ queryKey: ["workspace_integrations", workspace.id] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(toolkit: string) {
    if (!workspace) return;
    setBusy(toolkit);
    try {
      await doDisconnect({ data: { workspaceId: workspace.id, toolkit } });
      await qc.invalidateQueries({ queryKey: ["workspace_integrations", workspace.id] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const byToolkit = Object.fromEntries((integrations ?? []).map((i) => [i.toolkit, i]));

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Settings · Integrations
        </div>
        <h1 className="mt-2 font-display text-4xl">Give your agents real tools</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Composio connects Gmail, Slack, Notion, GitHub, Linear, Calendar and 250+ other apps.
          Connect once as an admin and every agent in this workspace can read and act through them.
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <PetAvatar petId="co" size="lg" />
          <div className="min-w-0">
            <div className="font-display text-base">Meet CO — your Composio operator</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Type <code className="rounded bg-secondary px-1">@co</code> in any channel to have CO
              run a connected tool for you, or press{" "}
              <code className="rounded bg-secondary px-1">!</code> in the composer to browse every
              available tool with a ready-made example prompt.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-base">Composio API key</div>
              <div className="text-xs text-muted-foreground">
                Shared across the workspace.{" "}
                <a
                  href="https://platform.composio.dev/developers"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary underline"
                >
                  Register / copy your API key
                </a>{" "}
                on Composio, paste it here, then authorise each app below.
              </div>
            </div>
            {hasKey && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                Connected
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "•••••••• (replace key)" : "Composio API key"}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              onClick={saveKey}
              disabled={busy === "key" || !apiKey.trim()}
              className="btn-pill disabled:opacity-50"
            >
              {busy === "key" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-xs">{msg}</div>
        )}

        {(integrations ?? []).length > 0 && (
          <div className="mt-8">
            <div className="font-display text-lg">Connected</div>
            <div className="mt-3 space-y-2">
              {(integrations ?? []).map((i) => (
                <div
                  key={i.toolkit}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
                >
                  <div className="flex items-center gap-3">
                    <ToolkitIcon slug={i.toolkit} size={28} />
                    <div>
                    <div className="text-sm font-medium capitalize">{i.toolkit.replace(/_/g, " ")}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.status === "ACTIVE"
                        ? "Active — @co and every agent can use it"
                        : `Awaiting permission on Composio (${i.status}) — reconnect, approve access, then Refresh`}
                    </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => refresh(i.toolkit)}
                      disabled={busy === i.toolkit}
                      className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={() => disconnect(i.toolkit)}
                      disabled={busy === i.toolkit}
                      className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <div className="font-display text-lg">Browse apps</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(search.trim());
              }}
              className="flex gap-2"
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Composio apps…"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
              <button className="rounded-md border border-border px-3 py-1.5 text-sm">Search</button>
            </form>
          </div>

          {!hasKey && (
            <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Add your Composio API key above to browse and connect apps.
            </div>
          )}

          {hasKey && isFetching && (
            <div className="mt-4 text-sm text-muted-foreground">Loading apps…</div>
          )}

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {(toolkits ?? []).map((t) => {
              const existing = byToolkit[t.slug];
              return (
                <div key={t.slug} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-start gap-3">
                    <ToolkitIcon slug={t.slug} logo={t.logo} size={26} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">{t.description}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{t.toolsCount} tools</div>
                    </div>
                    <button
                      onClick={() => connect(t.slug)}
                      disabled={busy === t.slug}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
                    >
                      {existing ? "Reconnect" : busy === t.slug ? "…" : "Connect"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
