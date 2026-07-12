
ALTER TABLE public.pet_configs ADD COLUMN IF NOT EXISTS custom_system text;

CREATE TABLE IF NOT EXISTS public.widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_slug text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('dashboard','file','docs','workflow')),
  title text NOT NULL,
  prompt text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','ready','error')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.widgets TO authenticated;
GRANT ALL ON public.widgets TO service_role;

ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read widgets" ON public.widgets FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "members insert widgets" ON public.widgets FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "members update widgets" ON public.widgets FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "creator delete widgets" ON public.widgets FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

CREATE TRIGGER widgets_touch_updated_at BEFORE UPDATE ON public.widgets
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.widgets;
