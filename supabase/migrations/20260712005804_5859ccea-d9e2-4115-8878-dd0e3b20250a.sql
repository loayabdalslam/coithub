
-- Ensure the auto-create-membership trigger exists (function was created earlier but trigger was never attached)
DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- Atomic security-definer RPC: create a workspace for the current user, add owner membership + default channel.
-- Bypasses RLS timing issues where the workspaces INSERT check runs before the membership row exists.
CREATE OR REPLACE FUNCTION public.create_workspace_for_current_user(_name text, _slug text)
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ws public.workspaces%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.workspaces (name, slug, created_by)
  VALUES (_name, _slug, _uid)
  RETURNING * INTO _ws;

  RETURN QUERY SELECT _ws.id, _ws.name, _ws.slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace_for_current_user(text, text) TO authenticated;
