import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/integrations/supabase/client";
import { AGENTS } from "@/lib/agents";
import { PetAvatar, HumanAvatar } from "@/components/PetAvatar";
import { Markdown } from "@/components/Markdown";

export const Route = createFileRoute("/_authenticated/app/decisions")({
  head: () => ({ meta: [{ title: "Decisions — Coithub" }] }),
  component: DecisionsView,
});

const DECISION_RE = /(^|\n)\s*(decision|decided|we will|let['']s go with|choose|agreed)\b/i;

function DecisionsView() {
  const { data: workspace } = useWorkspace();

  const { data } = useQuery({
    queryKey: ["decisions", workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const { data: channels } = await supabase
        .from("channels")
        .select("id, name")
        .eq("workspace_id", workspace!.id);
      const channelMap = new Map((channels ?? []).map((c) => [c.id, c.name]));
      const ids = (channels ?? []).map((c) => c.id);
      if (ids.length === 0) return [];
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("id, channel_id, author_id, pet_id, body, created_at")
        .in("channel_id", ids)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const filtered = (msgs ?? []).filter((m) => DECISION_RE.test(m.body));
      const humanIds = Array.from(
        new Set(filtered.filter((m) => m.author_id && !m.pet_id).map((m) => m.author_id as string)),
      );
      let names: Record<string, string> = {};
      if (humanIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", humanIds);
        names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name ?? "user"]));
      }
      return filtered.map((m) => ({
        ...m,
        channel_name: channelMap.get(m.channel_id) ?? "channel",
        author_name: m.author_id ? names[m.author_id] ?? "user" : null,
      }));
    },
  });

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Workspace</div>
        <h1 className="mt-2 font-display text-4xl">Decisions</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Anything that looks like a decision — messages containing “decision”, “decided”, “we will”, “agreed”, or similar — surfaces here across every channel.
        </p>

        <div className="mt-8 space-y-3">
          {(data ?? []).map((m) => {
            const agent = m.pet_id ? AGENTS[m.pet_id as keyof typeof AGENTS] : null;
            return (
              <article key={m.id} className="surface-panel flex gap-3 p-4">
                {agent ? (
                  <PetAvatar petId={m.pet_id!} />
                ) : (
                  <HumanAvatar initials={(m.author_name ?? "??").slice(0, 2).toUpperCase()} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {agent ? agent.name : m.author_name ?? "Someone"}
                    </span>
                    <span>in</span>
                    <Link
                      to="/app/channels/$channelId"
                      params={{ channelId: m.channel_id }}
                      className="text-primary hover:underline"
                    >
                      #{m.channel_name}
                    </Link>
                    <span>· {new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-1">
                    <Markdown>{m.body}</Markdown>
                  </div>
                </div>
              </article>
            );
          })}
          {(data ?? []).length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No decisions captured yet. Post a message containing “Decision:”, “We will…”, or “Agreed…” in any channel and it will show up here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
