import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PetAvatar } from "@/components/PetAvatar";
import { PET_LIST, PET_PROMPTS, type PetSlug } from "@/lib/pets";
import { usePetConfigs } from "@/lib/pet-configs";
import { useChannels, useWorkspace } from "@/lib/workspace";

type Message = {
  id: string;
  channel_id: string;
  author_id: string | null;
  pet_id: string | null;
  body: string;
  created_at: string;
  parent_id: string | null;
};

type MentionHit = {
  message: Message;
  channelName: string;
  tokens: string[];
};

export const Route = createFileRoute("/_authenticated/app/mentions")({
  head: () => ({ meta: [{ title: "Mentions — Coithub" }] }),
  component: MentionsPage,
});

function MentionsPage() {
  const { data: workspace } = useWorkspace();
  const { data: channels } = useChannels(workspace?.id);
  const { data: configs } = usePetConfigs(workspace?.id);
  const channelIds = (channels ?? []).map((c) => c.id);
  const channelNames = Object.fromEntries((channels ?? []).map((c) => [c.id, c.name]));
  const agentTargets = (configs ?? [])
    .filter((c) => c.enabled && PET_LIST.includes(c.pet_slug as PetSlug))
    .map((c) => c.pet_slug.toLowerCase());

  const { data: userAliases } = useQuery({
    queryKey: ["mention-user-aliases"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const emailName = data.user?.email?.split("@")[0] ?? "";
      const fullName = (data.user?.user_metadata?.full_name as string | undefined) ?? "";
      return [emailName, ...fullName.split(/\s+/)]
        .map((value) => value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ""))
        .filter(Boolean);
    },
  });

  const targets = Array.from(new Set([...agentTargets, ...(userAliases ?? [])]));

  const { data: mentions, isLoading } = useQuery({
    queryKey: ["workspace-mentions", workspace?.id, channelIds.join(","), targets.join(",")],
    enabled: channelIds.length > 0 && targets.length > 0,
    queryFn: async (): Promise<MentionHit[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, channel_id, author_id, pet_id, body, created_at, parent_id")
        .in("channel_id", channelIds)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return ((data ?? []) as Message[])
        .map((message) => {
          const tokens = Array.from(message.body.matchAll(/@([a-z0-9_-]+)/gi)).map((match) => match[1].toLowerCase());
          const matched = tokens.filter((token) => targets.includes(token));
          return matched.length > 0
            ? { message, channelName: channelNames[message.channel_id] ?? "channel", tokens: Array.from(new Set(matched)) }
            : null;
        })
        .filter((hit): hit is MentionHit => Boolean(hit));
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div>
          <div className="text-sm font-medium">Mentions</div>
          <div className="text-xs text-muted-foreground">Messages that mention you or your hired agents</div>
        </div>
        <div className="text-xs text-muted-foreground">{mentions?.length ?? 0} found</div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading mentions…</div>
        ) : targets.length === 0 ? (
          <EmptyMentions message="Hire agents or set your profile name to start tracking mentions." />
        ) : (mentions ?? []).length === 0 ? (
          <EmptyMentions message="No one has mentioned you or your hired agents yet." />
        ) : (
          <ul className="mx-auto max-w-4xl space-y-3">
            {(mentions ?? []).map(({ message, channelName, tokens }) => (
              <li key={message.id}>
                <Link
                  to="/app/channels/$channelId"
                  params={{ channelId: message.channel_id }}
                  search={message.parent_id ? { thread: message.parent_id } : {}}
                  className="block rounded-md border border-border bg-surface p-4 transition hover:border-primary/50 hover:bg-secondary/40"
                >
                  <div className="flex items-start gap-3">
                    {message.pet_id && PET_LIST.includes(message.pet_id as PetSlug) ? (
                      <PetAvatar petId={message.pet_id as PetSlug} size="sm" />
                    ) : (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
                        @
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-primary">#{channelName}</span>
                        <span>{new Date(message.created_at).toLocaleString()}</span>
                        {tokens.map((token) => (
                          <span key={token} className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                            @{token}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1 line-clamp-3 text-sm text-foreground">{message.body}</div>
                      {message.parent_id && (
                        <div className="mt-2 text-[11px] text-muted-foreground">Opens inside its thread</div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyMentions({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="font-display text-2xl text-foreground">No mentions</div>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}