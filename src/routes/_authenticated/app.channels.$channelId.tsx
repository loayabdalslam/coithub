import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { HumanAvatar, PetAvatar } from "@/components/PetAvatar";
import { Markdown } from "@/components/Markdown";
import { detectMentionedPets, PET_PROMPTS, type PetSlug } from "@/lib/pets";
import { invokePet } from "@/lib/pets.functions";
import { useWorkspace } from "@/lib/workspace";
import { usePetConfigs } from "@/lib/pet-configs";
import { RunWidgetDialog } from "@/components/RunWidgetDialog";

type Message = {
  id: string;
  channel_id: string;
  author_id: string | null;
  pet_id: string | null;
  body: string;
  created_at: string;
  parent_id: string | null;
};

type Profile = { id: string; display_name: string | null; avatar_url: string | null };

export const Route = createFileRoute("/_authenticated/app/channels/$channelId")({
  head: () => ({ meta: [{ title: "Channel — Coithub" }] }),
  component: ChannelView,
  errorComponent: ({ error }) => (
    <div className="p-10 text-destructive">Failed to load channel: {error.message}</div>
  ),
});

function ChannelView() {
  const { channelId } = Route.useParams();
  const queryClient = useQueryClient();
  const [threadParentId, setThreadParentId] = useState<string | null>(null);

  const { data: channel } = useQuery({
    queryKey: ["channel", channelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, topic, workspace_id")
        .eq("id", channelId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", channelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, channel_id, author_id, pet_id, body, created_at, parent_id")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(400);
      if (error) throw error;
      return data as Message[];
    },
  });

  const topLevel = (messages ?? []).filter((m) => !m.parent_id);
  const replyCounts = new Map<string, number>();
  for (const m of messages ?? []) {
    if (m.parent_id) replyCounts.set(m.parent_id, (replyCounts.get(m.parent_id) ?? 0) + 1);
  }

  const authorIds = Array.from(
    new Set(
      (messages ?? [])
        .map((m) => m.author_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  );
  const { data: profiles } = useQuery({
    queryKey: ["profiles", authorIds.sort().join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", authorIds);
      if (error) throw error;
      const map: Record<string, Profile> = {};
      (data ?? []).forEach((p) => (map[p.id] = p));
      return map;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [channelId, queryClient]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Reset thread when switching channels
  useEffect(() => setThreadParentId(null), [channelId]);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
          <div>
            <div className="text-sm font-medium">
              <span className="text-muted-foreground">#</span> {channel?.name ?? "…"}
            </div>
            <div className="text-xs text-muted-foreground">{channel?.topic}</div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-6">
          {topLevel.length === 0 ? (
            <div className="mx-auto max-w-md py-20 text-center text-muted-foreground">
              <div className="font-display text-2xl text-foreground">#{channel?.name}</div>
              <p className="mt-2 text-sm">
                This channel is quiet. Say hi below to get things started.
              </p>
            </div>
          ) : (
            <ul className="space-y-5">
              {topLevel.map((m) => (
                <MessageRow
                  key={m.id}
                  m={m}
                  profiles={profiles}
                  replyCount={replyCounts.get(m.id) ?? 0}
                  onOpenThread={() => setThreadParentId(m.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <Composer
          channelId={channelId}
          channelName={channel?.name ?? ""}
          workspaceId={channel?.workspace_id ?? ""}
          parentId={null}
        />
      </div>

      {threadParentId && (
        <ThreadPanel
          channelId={channelId}
          workspaceId={channel?.workspace_id ?? ""}
          channelName={channel?.name ?? ""}
          parentId={threadParentId}
          allMessages={messages ?? []}
          profiles={profiles}
          onClose={() => setThreadParentId(null)}
        />
      )}
    </div>
  );
}

function MessageRow({
  m,
  profiles,
  replyCount,
  onOpenThread,
}: {
  m: Message;
  profiles: Record<string, Profile> | undefined;
  replyCount: number;
  onOpenThread: () => void;
}) {
  const time = new Date(m.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (m.pet_id) {
    const pet = PET_PROMPTS[m.pet_id as PetSlug];
    return (
      <li className="group flex gap-3">
        <PetAvatar petId={m.pet_id as PetSlug} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium">{pet?.name ?? m.pet_id}</span>
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              AI Agent · {pet?.role}
            </span>
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
          <div className="mt-1"><Markdown>{m.body}</Markdown></div>
          <ThreadAffordance replyCount={replyCount} onOpenThread={onOpenThread} />
        </div>
      </li>
    );
  }
  const p = m.author_id ? profiles?.[m.author_id] : null;
  const name = p?.display_name ?? "Someone";
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <li className="group flex gap-3">
      <HumanAvatar initials={initials} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <div className="mt-1"><Markdown>{m.body}</Markdown></div>
        <ThreadAffordance replyCount={replyCount} onOpenThread={onOpenThread} />
      </div>
    </li>
  );
}

function ThreadAffordance({
  replyCount,
  onOpenThread,
}: {
  replyCount: number;
  onOpenThread: () => void;
}) {
  return (
    <button
      onClick={onOpenThread}
      className="mt-1 text-[11px] text-muted-foreground opacity-0 transition hover:text-primary group-hover:opacity-100 data-[has=true]:opacity-100"
      data-has={replyCount > 0}
    >
      {replyCount > 0
        ? `💬 ${replyCount} ${replyCount === 1 ? "reply" : "replies"} in thread`
        : "Reply in thread"}
    </button>
  );
}

function ThreadPanel({
  channelId,
  workspaceId,
  channelName,
  parentId,
  allMessages,
  profiles,
  onClose,
}: {
  channelId: string;
  workspaceId: string;
  channelName: string;
  parentId: string;
  allMessages: Message[];
  profiles: Record<string, Profile> | undefined;
  onClose: () => void;
}) {
  const parent = allMessages.find((m) => m.id === parentId);
  const replies = allMessages.filter((m) => m.parent_id === parentId);
  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        <div className="text-sm font-medium">Thread</div>
        <button
          onClick={onClose}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
        >
          Close
        </button>
      </div>
      <div className="flex-1 overflow-auto px-4 py-4">
        {parent && (
          <div className="border-b border-border pb-4">
            <MessageRow
              m={parent}
              profiles={profiles}
              replyCount={0}
              onOpenThread={() => {}}
            />
          </div>
        )}
        <ul className="mt-4 space-y-4">
          {replies.map((m) => (
            <MessageRow key={m.id} m={m} profiles={profiles} replyCount={0} onOpenThread={() => {}} />
          ))}
        </ul>
      </div>
      <Composer
        channelId={channelId}
        channelName={`${channelName} thread`}
        workspaceId={workspaceId}
        parentId={parentId}
      />
    </aside>
  );
}

function Composer({
  channelId,
  channelName,
  workspaceId,
  parentId,
}: {
  channelId: string;
  channelName: string;
  workspaceId: string;
  parentId: string | null;
}) {
  const { data: workspace } = useWorkspace();
  const { data: configs } = usePetConfigs(workspaceId || undefined);
  const autoRespond = workspace?.auto_respond !== false;
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState<PetSlug | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const queryClient = useQueryClient();
  const invoke = useServerFn(invokePet);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setErr(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setErr("Not signed in");
      setSending(false);
      return;
    }
    const idem = crypto.randomUUID();
    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({
        channel_id: channelId,
        author_id: userData.user.id,
        body: text,
        idempotency_key: idem,
        parent_id: parentId,
      })
      .select("id")
      .single();
    if (error) {
      setErr(error.message);
      setSending(false);
      return;
    }
    setBody("");
    queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    setSending(false);

    const mentioned = detectMentionedPets(text);
    const enabledPets = (configs ?? []).filter((c) => c.enabled).map((c) => c.pet_slug);
    // Only mentioned agents (or auto-respond with all hired). If none hired
    // and nothing mentioned, don't fabricate replies.
    const pets =
      mentioned.length > 0
        ? mentioned.filter((p) => enabledPets.includes(p))
        : autoRespond
          ? enabledPets
          : [];

    if (pets.length > 0 && inserted) {
      // Sequential typing: one agent at a time with a small "thinking" delay
      for (const pet of pets) {
        setTyping(pet);
        // Simulated typing latency (feels human, ~600–1100ms) before real call
        await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
        try {
          await invoke({
            data: {
              channelId,
              pet,
              triggerMessageId: inserted.id,
              parentId: parentId,
            },
          });
        } catch (petErr) {
          setErr(petErr instanceof Error ? petErr.message : String(petErr));
        }
      }
      setTyping(null);
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-background p-4">
      <form onSubmit={send} className="surface-panel flex items-end gap-3 p-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e as unknown as FormEvent);
            }
          }}
          className="max-h-40 min-h-[60px] flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          placeholder={parentId ? "Reply in thread…" : `Message #${channelName}`}
        />
        <button
          type="button"
          onClick={() => setWidgetOpen(true)}
          className="rounded-md border border-border-strong px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
          title="Run as background widget"
        >
          ⊕ Widget
        </button>
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
      {widgetOpen && workspaceId && (
        <RunWidgetDialog
          workspaceId={workspaceId}
          defaultPrompt={body}
          onClose={() => setWidgetOpen(false)}
        />
      )}
      {typing && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <PetAvatar petId={typing} size="xs" />
          <span className="font-medium text-foreground">{PET_PROMPTS[typing].name}</span>
          <span>is typing</span>
          <TypingDots />
        </div>
      )}
      {err && <div className="mt-2 text-[11px] text-destructive">{err}</div>}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="size-1 animate-pulse rounded-full bg-primary [animation-delay:0ms]" />
      <span className="size-1 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
      <span className="size-1 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
    </span>
  );
}
