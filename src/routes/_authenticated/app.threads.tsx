import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PetAvatar } from "@/components/PetAvatar";
import { PET_LIST, PET_PROMPTS, type PetSlug } from "@/lib/pets";
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

type ThreadSummary = {
  parent: Message;
  replies: Message[];
  channelName: string;
  latestAt: string;
};

export const Route = createFileRoute("/_authenticated/app/threads")({
  head: () => ({ meta: [{ title: "Threads — Coithub" }] }),
  component: ThreadsPage,
});

function ThreadsPage() {
  const { data: workspace } = useWorkspace();
  const { data: channels } = useChannels(workspace?.id);
  const channelIds = (channels ?? []).map((c) => c.id);
  const channelNames = Object.fromEntries((channels ?? []).map((c) => [c.id, c.name]));

  const { data: threads, isLoading } = useQuery({
    queryKey: ["workspace-threads", workspace?.id, channelIds.join(",")],
    enabled: channelIds.length > 0,
    queryFn: async (): Promise<ThreadSummary[]> => {
      const { data: replies, error: repliesError } = await supabase
        .from("messages")
        .select("id, channel_id, author_id, pet_id, body, created_at, parent_id")
        .in("channel_id", channelIds)
        .not("parent_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(300);

      if (repliesError) throw repliesError;
      const replyRows = (replies ?? []) as Message[];
      const parentIds = Array.from(new Set(replyRows.map((m) => m.parent_id).filter((id): id is string => Boolean(id))));
      if (parentIds.length === 0) return [];

      const { data: parents, error: parentsError } = await supabase
        .from("messages")
        .select("id, channel_id, author_id, pet_id, body, created_at, parent_id")
        .in("id", parentIds);

      if (parentsError) throw parentsError;
      const parentMap = new Map(((parents ?? []) as Message[]).map((m) => [m.id, m]));
      const grouped = new Map<string, Message[]>();
      for (const reply of replyRows) {
        if (!reply.parent_id) continue;
        grouped.set(reply.parent_id, [...(grouped.get(reply.parent_id) ?? []), reply]);
      }

      return Array.from(grouped.entries())
        .map(([parentId, group]) => {
          const parent = parentMap.get(parentId);
          if (!parent) return null;
          const sortedReplies = [...group].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
          return {
            parent,
            replies: sortedReplies,
            channelName: channelNames[parent.channel_id] ?? "channel",
            latestAt: sortedReplies[sortedReplies.length - 1]?.created_at ?? parent.created_at,
          } satisfies ThreadSummary;
        })
        .filter((thread): thread is ThreadSummary => Boolean(thread))
        .sort((a, b) => Date.parse(b.latestAt) - Date.parse(a.latestAt));
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div>
          <div className="text-sm font-medium">Threads</div>
          <div className="text-xs text-muted-foreground">Every active conversation across your channels</div>
        </div>
        <div className="text-xs text-muted-foreground">{threads?.length ?? 0} active</div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading threads…</div>
        ) : (threads ?? []).length === 0 ? (
          <div className="mx-auto max-w-md py-20 text-center">
            <div className="font-display text-2xl text-foreground">No threads yet</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Open any channel message and reply in thread. Active thread conversations will appear here.
            </p>
          </div>
        ) : (
          <ul className="mx-auto max-w-4xl space-y-3">
            {(threads ?? []).map((thread) => (
              <li key={thread.parent.id}>
                <Link
                  to="/app/channels/$channelId"
                  params={{ channelId: thread.parent.channel_id }}
                  search={{ thread: thread.parent.id }}
                  className="block rounded-md border border-border bg-surface p-4 transition hover:border-primary/50 hover:bg-secondary/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">
                        <span className="text-primary">#{thread.channelName}</span> · {thread.replies.length}{" "}
                        {thread.replies.length === 1 ? "reply" : "replies"}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                        {thread.parent.body}
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        Latest: {thread.replies[thread.replies.length - 1]?.body}
                      </div>
                    </div>
                    <ThreadActors messages={[thread.parent, ...thread.replies]} />
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

function ThreadActors({ messages }: { messages: Message[] }) {
  const agents = Array.from(
    new Set(
      messages
        .map((m) => m.pet_id)
        .filter((id): id is PetSlug => Boolean(id) && PET_LIST.includes(id as PetSlug)),
    ),
  ).slice(0, 4);

  if (agents.length === 0) {
    return <span className="shrink-0 rounded bg-secondary px-2 py-1 text-[10px] text-muted-foreground">Team</span>;
  }

  return (
    <div className="flex shrink-0 -space-x-1">
      {agents.map((agent) => (
        <span key={agent} title={PET_PROMPTS[agent].name} className="rounded-full bg-surface">
          <PetAvatar petId={agent} size="xs" />
        </span>
      ))}
    </div>
  );
}