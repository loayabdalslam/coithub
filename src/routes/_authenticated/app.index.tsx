import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AGENTS } from "@/lib/agents";
import { PetAvatar } from "@/components/PetAvatar";
import { useWorkspace, useChannels } from "@/lib/workspace";
import { usePetConfigs } from "@/lib/pet-configs";

export const Route = createFileRoute("/_authenticated/app/")({
  component: AppHome,
});

function AppHome() {
  const { data: workspace } = useWorkspace();
  const { data: channels } = useChannels(workspace?.id);
  const { data: configs } = usePetConfigs(workspace?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (channels && channels.length > 0) {
      navigate({
        to: "/app/channels/$channelId",
        params: { channelId: channels[0].id },
        replace: true,
      });
    }
  }, [channels, navigate]);

  const hired = (configs ?? [])
    .map((c) => AGENTS[c.pet_slug as keyof typeof AGENTS])
    .filter(Boolean);

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Home</div>
        <h1 className="mt-2 font-display text-4xl">
          Welcome to {workspace?.name ?? "your workspace"}.
        </h1>
        <p className="mt-2 text-muted-foreground">
          Jump into a channel to start collaborating with your team and your hired AI agents.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section className="surface-panel p-5">
            <h2 className="font-display text-xl">Channels</h2>
            <ul className="mt-4 space-y-1">
              {(channels ?? []).map((c) => (
                <li key={c.id}>
                  <Link
                    to="/app/channels/$channelId"
                    params={{ channelId: c.id }}
                    className="flex items-center justify-between rounded px-2 py-2 hover:bg-secondary"
                  >
                    <span>
                      <span className="text-muted-foreground"># </span>
                      {c.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.topic}</span>
                  </Link>
                </li>
              ))}
              {channels && channels.length === 0 && (
                <li className="px-2 py-2 text-sm text-muted-foreground">
                  No channels yet. Create one from the sidebar.
                </li>
              )}
            </ul>
          </section>

          <section className="surface-panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Your Agents</h2>
              <Link to="/app/pets" className="text-xs text-primary hover:underline">
                Agents Hub →
              </Link>
            </div>
            {hired.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                You haven’t hired any agents yet.{" "}
                <Link to="/app/pets" className="text-primary hover:underline">
                  Open the Agents Hub
                </Link>{" "}
                to pick your team.
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {hired.map((p) => (
                  <li key={p.slug} className="flex items-start gap-3">
                    <PetAvatar petId={p.slug} />
                    <div>
                      <div className="text-sm font-medium">
                        {p.name}
                        <span className="ml-2 text-xs text-muted-foreground">{p.role}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{p.mission}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
