
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

CREATE TABLE IF NOT EXISTS public.pet_configs (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  pet_slug text NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, pet_slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pet_configs TO authenticated;
GRANT ALL ON public.pet_configs TO service_role;

ALTER TABLE public.pet_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view pet configs" ON public.pet_configs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "admins manage pet configs" ON public.pet_configs FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
