import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { previewInvite, acceptInvite, setSelectedWorkspaceId } from "@/lib/workspace";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Join workspace — Coithub" }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "invalid"; reason: string }
    | { kind: "ready"; workspaceName: string; isAuthed: boolean }
    | { kind: "joining" }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const preview = await previewInvite(token);
        if (!preview || !preview.valid) {
          setState({ kind: "invalid", reason: preview?.reason ?? "invalid" });
          return;
        }
        const { data } = await supabase.auth.getUser();
        setState({
          kind: "ready",
          workspaceName: preview.workspace_name ?? "the workspace",
          isAuthed: !!data.user,
        });
      } catch (e) {
        setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      }
    })();
  }, [token]);

  async function join() {
    setState({ kind: "joining" });
    try {
      const workspaceId = await acceptInvite(token);
      if (workspaceId) setSelectedWorkspaceId(workspaceId);
      navigate({ to: "/app" });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="atmospheric-bg absolute inset-0 opacity-50" />
      <div className="surface-panel relative z-10 mx-4 w-full max-w-md p-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          You’ve been invited
        </div>

        {state.kind === "loading" && (
          <p className="mt-4 text-sm text-muted-foreground">Checking invitation…</p>
        )}

        {state.kind === "invalid" && (
          <>
            <h1 className="mt-2 font-display text-3xl">Invitation not valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This link is {state.reason}. Ask the person who sent it for a fresh one.
            </p>
          </>
        )}

        {state.kind === "error" && (
          <>
            <h1 className="mt-2 font-display text-3xl">Something went wrong</h1>
            <p className="mt-2 text-sm text-destructive">{state.message}</p>
          </>
        )}

        {state.kind === "ready" && (
          <>
            <h1 className="mt-2 font-display text-3xl">Join {state.workspaceName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You’ll be added as a member and can start collaborating right away.
            </p>
            {state.isAuthed ? (
              <button onClick={join} className="btn-pill mt-6 w-full">
                Accept & join workspace →
              </button>
            ) : (
              <button
                onClick={() => {
                  try {
                    localStorage.setItem("pending_invite", token);
                  } catch { /* ignore */ }
                  navigate({ to: "/auth" });
                }}
                className="btn-pill mt-6 w-full"
              >
                Sign in to accept →
              </button>
            )}
          </>
        )}

        {state.kind === "joining" && (
          <p className="mt-4 text-sm text-muted-foreground">Joining…</p>
        )}
      </div>
    </div>
  );
}
