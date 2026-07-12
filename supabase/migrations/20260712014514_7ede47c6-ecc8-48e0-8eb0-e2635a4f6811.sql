
-- Phase 1: wipe all workspace data (starts everyone over cleanly)
TRUNCATE
  public.reactions,
  public.mentions,
  public.files,
  public.messages,
  public.channel_members,
  public.channels,
  public.pet_configs,
  public.workspace_api_keys,
  public.memberships,
  public.workspaces
CASCADE;

-- Phase 2: shareable invite links to bring real people into a workspace
CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  expires_at timestamptz,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invites TO authenticated;
GRANT ALL ON public.workspace_invites TO service_role;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view invites" ON public.workspace_invites
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "admins create invites" ON public.workspace_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[])
              AND created_by = auth.uid());
CREATE POLICY "admins delete invites" ON public.workspace_invites
  FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[]));

-- Lookup invite (bypasses RLS so the accept page can preview it)
CREATE OR REPLACE FUNCTION public.get_invite_preview(_token text)
RETURNS TABLE(workspace_id uuid, workspace_name text, valid boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _inv public.workspace_invites%ROWTYPE;
  _ws public.workspaces%ROWTYPE;
BEGIN
  SELECT * INTO _inv FROM public.workspace_invites WHERE token = _token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, 'invalid';
    RETURN;
  END IF;
  SELECT * INTO _ws FROM public.workspaces WHERE id = _inv.workspace_id;
  IF _inv.expires_at IS NOT NULL AND _inv.expires_at < now() THEN
    RETURN QUERY SELECT _ws.id, _ws.name, false, 'expired';
    RETURN;
  END IF;
  IF _inv.max_uses IS NOT NULL AND _inv.uses >= _inv.max_uses THEN
    RETURN QUERY SELECT _ws.id, _ws.name, false, 'exhausted';
    RETURN;
  END IF;
  RETURN QUERY SELECT _ws.id, _ws.name, true, 'ok';
END $$;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO authenticated, anon;

-- Accept invite: adds current user to the workspace
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _inv public.workspace_invites%ROWTYPE;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _inv FROM public.workspace_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid invite'; END IF;
  IF _inv.expires_at IS NOT NULL AND _inv.expires_at < now() THEN RAISE EXCEPTION 'invite expired'; END IF;
  IF _inv.max_uses IS NOT NULL AND _inv.uses >= _inv.max_uses THEN RAISE EXCEPTION 'invite exhausted'; END IF;
  INSERT INTO public.memberships (workspace_id, user_id, role)
    VALUES (_inv.workspace_id, _uid, _inv.role)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  UPDATE public.workspace_invites SET uses = uses + 1 WHERE id = _inv.id;
  RETURN _inv.workspace_id;
END $$;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(text) TO authenticated;

-- Rename semantics: pet_configs now stores only the agents the workspace has
-- explicitly added from the Agents Hub. Nothing schema-level to change; the
-- app layer stops seeding all 20 agents by default.
