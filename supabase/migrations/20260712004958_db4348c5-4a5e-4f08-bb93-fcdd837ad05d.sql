
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pet_id text;
ALTER TABLE public.messages ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.messages ADD CONSTRAINT messages_author_or_pet CHECK (author_id IS NOT NULL OR pet_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS messages_pet_idx ON public.messages(pet_id) WHERE pet_id IS NOT NULL;

-- Allow viewing pet-authored messages via existing channel visibility rule (policy already uses channel_id, so no change needed)

-- Ensure realtime is enabled for messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
END $$;
