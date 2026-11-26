-- Migration 004: Grant Table Privileges to Authenticated Users (RLS Remains Strictly Enforced)
-- Without table-level GRANTs, PostgreSQL rejects queries with 42501 ("permission denied for table ...")
-- before Row Level Security policies can even be evaluated.
-- Anonymous (anon) retains zero table privileges.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentoring_relationships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_private_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_items TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.action_item_session_links TO authenticated;
GRANT SELECT, INSERT ON public.action_item_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
