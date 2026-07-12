import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { ProviderIcon } from "@/components/ProviderIcon";

export const Route = createFileRoute("/_authenticated/app/settings/keys")({
  component: KeysSettings,
});

const BYO_PROVIDERS: ProviderId[] = ["google", "openai", "openrouter", "groq", "gemini", "chatgpt"];

type KeyRow = { provider: string; masked: string; hasKey: boolean };

function mask(k: string): string {
  if (!k) return "";
  if (k.length <= 8) return "•".repeat(k.length);
  return k.slice(0, 4) + "•".repeat(Math.max(4, k.length - 8)) + k.slice(-4);
}

function KeysSettings() {
  const { data: workspace } = useWorkspace();
  const [rows, setRows] = useState<Record<ProviderId, KeyRow>>(
    () =>
      Object.fromEntries(BYO_PROVIDERS.map((p) => [p, { provider: p, masked: "", hasKey: false }])) as Record<
        ProviderId,
        KeyRow
      >,
  );
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [autoRespond, setAutoRespond] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace) return;
    setAutoRespond(workspace.auto_respond !== false);
    supabase
      .from("workspace_api_keys" as never)
      .select("provider, api_key")
      .eq("workspace_id", workspace.id)
      .then(({ data }) => {
        const next = { ...rows };
        for (const p of BYO_PROVIDERS) {
          const row = (data as { provider: string; api_key: string }[] | null)?.find((r) => r.provider === p);
          next[p] = {
            provider: p,
            masked: row ? mask(row.api_key) : "",
            hasKey: !!row,
          };
        }
        setRows(next);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  async function saveKey(provider: ProviderId) {
    if (!workspace) return;
    const value = (inputs[provider] ?? "").trim();
    if (!value) return;
    setBusy(provider);
    setMsg(null);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("workspace_api_keys" as never).upsert(
      {
        workspace_id: workspace.id,
        provider,
        api_key: value,
        updated_at: new Date().toISOString(),
        updated_by: user.user?.id ?? null,
      } as never,
      { onConflict: "workspace_id,provider" },
    );
    setBusy(null);
    if (error) {
      setMsg(error.message);
      return;
    }
    setInputs((p) => ({ ...p, [provider]: "" }));
    setRows((prev) => ({
      ...prev,
      [provider]: { provider, masked: mask(value), hasKey: true },
    }));
    setMsg(`${PROVIDERS[provider].name} key saved.`);
  }

  async function deleteKey(provider: ProviderId) {
    if (!workspace) return;
    setBusy(provider);
    const { error } = await supabase
      .from("workspace_api_keys" as never)
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("provider", provider);
    setBusy(null);
    if (error) {
      setMsg(error.message);
      return;
    }
    setRows((prev) => ({ ...prev, [provider]: { provider, masked: "", hasKey: false } }));
    setMsg(`${PROVIDERS[provider].name} key removed.`);
  }

  async function toggleAuto(v: boolean) {
    if (!workspace) return;
    setAutoRespond(v);
    const { error } = await supabase
      .from("workspaces")
      .update({ auto_respond: v } as never)
      .eq("id", workspace.id);
    if (error) setMsg(error.message);
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Settings · API Keys
        </div>
        <h1 className="mt-2 font-display text-4xl">Bring your own AI providers</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Paste a key for any provider you want to use — Google Gemini, OpenAI, OpenRouter, Groq, or
          Google AI Studio. Keys are saved once by an admin and shared across the whole workspace, so
          everyone here can chat with the agents using them. Only admins can view or edit the keys.
        </p>

        <div className="mt-6 flex items-center justify-between rounded-lg border border-border bg-surface p-4">
          <div>
            <div className="font-medium">Auto-respond in every message</div>
            <div className="text-xs text-muted-foreground">
              When on, every enabled pet replies in-character to every message. Off means pets only
              respond to explicit @mentions.
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRespond}
              onChange={(e) => toggleAuto(e.target.checked)}
            />
            {autoRespond ? "On" : "Off"}
          </label>
        </div>

        <div className="mt-6 space-y-3">
          {BYO_PROVIDERS.map((p) => {
            const meta = PROVIDERS[p];
            const row = rows[p];
            return (
              <div key={p} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <ProviderIcon provider={p} className="mt-0.5 size-5" />
                    <div>
                      <div className="font-display text-base">{meta.name}</div>
                      <div className="text-xs text-muted-foreground">{meta.blurb}</div>
                      {meta.keyUrl && (
                        <a
                          href={meta.keyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs underline decoration-dotted"
                        >
                          Get a key →
                        </a>
                      )}
                    </div>
                  </div>
                  {row.hasKey && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                      Connected
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                  <input
                    type="password"
                    placeholder={row.hasKey ? row.masked : meta.keyHelp ?? "Paste API key"}
                    value={inputs[p] ?? ""}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [p]: e.target.value }))}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveKey(p)}
                      disabled={!inputs[p]?.trim() || busy === p}
                      className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {busy === p ? "Saving…" : row.hasKey ? "Replace" : "Save"}
                    </button>
                    {row.hasKey && (
                      <button
                        onClick={() => deleteKey(p)}
                        disabled={busy === p}
                        className="rounded-md border border-border px-3 py-2 text-xs disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <Link to="/app/settings/pets" className="btn-pill">
            Configure pet models
          </Link>
          <Link to="/app" className="btn-outline-pill">
            Back to workspace
          </Link>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
