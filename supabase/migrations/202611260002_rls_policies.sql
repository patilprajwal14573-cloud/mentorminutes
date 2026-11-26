-- Migration 002: Row Level Security (RLS) Helpers & Policies for All 10 Tables
-- Enforces authorization in PostgreSQL so security never relies only on frontend routes.

-- ---------------------------------------------------------------------------
-- Non-recursive SECURITY DEFINER RLS helper functions
-- Created and granted BEFORE enabling RLS or creating policies.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_relationship_participant(p_relationship_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.mentoring_relationships mr
      WHERE mr.id = p_relationship_id
        AND (mr.mentor_id = auth.uid() OR mr.learner_id = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.is_relationship_mentor(p_relationship_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.mentoring_relationships mr
      WHERE mr.id = p_relationship_id
        AND mr.mentor_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_relationship_member_user(p_relationship_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.mentoring_relationships mr
      WHERE mr.id = p_relationship_id
        AND (mr.mentor_id = p_user_id OR mr.learner_id = p_user_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_goal(p_goal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.goals g
      JOIN public.mentoring_relationships mr ON mr.id = g.relationship_id
      WHERE g.id = p_goal_id
        AND (mr.mentor_id = auth.uid() OR mr.learner_id = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_action_item(p_action_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.action_items ai
      JOIN public.mentoring_relationships mr ON mr.id = ai.relationship_id
      WHERE ai.id = p_action_item_id
        AND (mr.mentor_id = auth.uid() OR mr.learner_id = auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_relationship_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_relationship_mentor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_relationship_member_user(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_goal(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_action_item(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_relationship_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_relationship_mentor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_relationship_member_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_goal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_action_item(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS on EVERY application table
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentoring_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_private_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_item_session_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_item_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 1. profiles policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS profiles_select_own_or_partner ON public.profiles;
CREATE POLICY profiles_select_own_or_partner
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.mentoring_relationships mr
      WHERE (mr.mentor_id = auth.uid() AND mr.learner_id = profiles.id)
         OR (mr.learner_id = auth.uid() AND mr.mentor_id = profiles.id)
    )
  );

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. mentoring_relationships policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS relationships_select_participants ON public.mentoring_relationships;
CREATE POLICY relationships_select_participants
  ON public.mentoring_relationships
  FOR SELECT
  TO authenticated
  USING (mentor_id = auth.uid() OR learner_id = auth.uid());

DROP POLICY IF EXISTS relationships_insert_mentor ON public.mentoring_relationships;
CREATE POLICY relationships_insert_mentor
  ON public.mentoring_relationships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    mentor_id = auth.uid()
    AND public.current_user_role() = 'mentor'
  );

DROP POLICY IF EXISTS relationships_update_mentor ON public.mentoring_relationships;
CREATE POLICY relationships_update_mentor
  ON public.mentoring_relationships
  FOR UPDATE
  TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS relationships_delete_mentor ON public.mentoring_relationships;
CREATE POLICY relationships_delete_mentor
  ON public.mentoring_relationships
  FOR DELETE
  TO authenticated
  USING (mentor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. sessions policies (shared info; learner_feedback only for learners)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS sessions_select_participants ON public.sessions;
CREATE POLICY sessions_select_participants
  ON public.sessions
  FOR SELECT
  TO authenticated
  USING (public.is_relationship_participant(relationship_id));

DROP POLICY IF EXISTS sessions_insert_mentor ON public.sessions;
CREATE POLICY sessions_insert_mentor
  ON public.sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_relationship_mentor(relationship_id));

DROP POLICY IF EXISTS sessions_update_participants ON public.sessions;
CREATE POLICY sessions_update_participants
  ON public.sessions
  FOR UPDATE
  TO authenticated
  USING (public.is_relationship_participant(relationship_id))
  WITH CHECK (public.is_relationship_participant(relationship_id));

DROP POLICY IF EXISTS sessions_delete_mentor ON public.sessions;
CREATE POLICY sessions_delete_mentor
  ON public.sessions
  FOR DELETE
  TO authenticated
  USING (public.is_relationship_mentor(relationship_id));

-- ---------------------------------------------------------------------------
-- 4. mentor_private_notes policies (STRICTLY mentor-only)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS mentor_private_notes_select_mentor ON public.mentor_private_notes;
CREATE POLICY mentor_private_notes_select_mentor
  ON public.mentor_private_notes
  FOR SELECT
  TO authenticated
  USING (
    mentor_id = auth.uid()
    AND public.is_relationship_mentor(relationship_id)
  );

DROP POLICY IF EXISTS mentor_private_notes_insert_mentor ON public.mentor_private_notes;
CREATE POLICY mentor_private_notes_insert_mentor
  ON public.mentor_private_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    mentor_id = auth.uid()
    AND public.is_relationship_mentor(relationship_id)
  );

DROP POLICY IF EXISTS mentor_private_notes_update_mentor ON public.mentor_private_notes;
CREATE POLICY mentor_private_notes_update_mentor
  ON public.mentor_private_notes
  FOR UPDATE
  TO authenticated
  USING (
    mentor_id = auth.uid()
    AND public.is_relationship_mentor(relationship_id)
  )
  WITH CHECK (
    mentor_id = auth.uid()
    AND public.is_relationship_mentor(relationship_id)
  );

DROP POLICY IF EXISTS mentor_private_notes_delete_mentor ON public.mentor_private_notes;
CREATE POLICY mentor_private_notes_delete_mentor
  ON public.mentor_private_notes
  FOR DELETE
  TO authenticated
  USING (
    mentor_id = auth.uid()
    AND public.is_relationship_mentor(relationship_id)
  );

-- ---------------------------------------------------------------------------
-- 5. goals policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS goals_select_participants ON public.goals;
CREATE POLICY goals_select_participants
  ON public.goals
  FOR SELECT
  TO authenticated
  USING (public.is_relationship_participant(relationship_id));

DROP POLICY IF EXISTS goals_insert_participants ON public.goals;
CREATE POLICY goals_insert_participants
  ON public.goals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_relationship_participant(relationship_id)
    AND created_by = auth.uid()
    AND (assigned_to IS NULL OR public.is_relationship_member_user(relationship_id, assigned_to))
  );

DROP POLICY IF EXISTS goals_update_participants ON public.goals;
CREATE POLICY goals_update_participants
  ON public.goals
  FOR UPDATE
  TO authenticated
  USING (public.is_relationship_participant(relationship_id))
  WITH CHECK (
    public.is_relationship_participant(relationship_id)
    AND (assigned_to IS NULL OR public.is_relationship_member_user(relationship_id, assigned_to))
  );

DROP POLICY IF EXISTS goals_delete_participants ON public.goals;
CREATE POLICY goals_delete_participants
  ON public.goals
  FOR DELETE
  TO authenticated
  USING (public.is_relationship_participant(relationship_id));

-- ---------------------------------------------------------------------------
-- 6. milestones policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS milestones_select_participants ON public.milestones;
CREATE POLICY milestones_select_participants
  ON public.milestones
  FOR SELECT
  TO authenticated
  USING (public.can_access_goal(goal_id));

DROP POLICY IF EXISTS milestones_insert_participants ON public.milestones;
CREATE POLICY milestones_insert_participants
  ON public.milestones
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_goal(goal_id));

DROP POLICY IF EXISTS milestones_update_participants ON public.milestones;
CREATE POLICY milestones_update_participants
  ON public.milestones
  FOR UPDATE
  TO authenticated
  USING (public.can_access_goal(goal_id))
  WITH CHECK (public.can_access_goal(goal_id));

DROP POLICY IF EXISTS milestones_delete_participants ON public.milestones;
CREATE POLICY milestones_delete_participants
  ON public.milestones
  FOR DELETE
  TO authenticated
  USING (public.can_access_goal(goal_id));

-- ---------------------------------------------------------------------------
-- 7. action_items policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS action_items_select_participants ON public.action_items;
CREATE POLICY action_items_select_participants
  ON public.action_items
  FOR SELECT
  TO authenticated
  USING (public.is_relationship_participant(relationship_id));

DROP POLICY IF EXISTS action_items_insert_participants ON public.action_items;
CREATE POLICY action_items_insert_participants
  ON public.action_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_relationship_participant(relationship_id)
    AND created_by = auth.uid()
    AND public.is_relationship_member_user(relationship_id, assigned_to)
  );

DROP POLICY IF EXISTS action_items_update_participants ON public.action_items;
CREATE POLICY action_items_update_participants
  ON public.action_items
  FOR UPDATE
  TO authenticated
  USING (public.is_relationship_participant(relationship_id))
  WITH CHECK (
    public.is_relationship_participant(relationship_id)
    AND public.is_relationship_member_user(relationship_id, assigned_to)
  );

DROP POLICY IF EXISTS action_items_delete_participants ON public.action_items;
CREATE POLICY action_items_delete_participants
  ON public.action_items
  FOR DELETE
  TO authenticated
  USING (public.is_relationship_participant(relationship_id));

-- ---------------------------------------------------------------------------
-- 8. action_item_session_links policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS action_links_select_participants ON public.action_item_session_links;
CREATE POLICY action_links_select_participants
  ON public.action_item_session_links
  FOR SELECT
  TO authenticated
  USING (public.can_access_action_item(action_item_id));

DROP POLICY IF EXISTS action_links_insert_participants ON public.action_item_session_links;
CREATE POLICY action_links_insert_participants
  ON public.action_item_session_links
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_action_item(action_item_id));

DROP POLICY IF EXISTS action_links_delete_mentor ON public.action_item_session_links;
CREATE POLICY action_links_delete_mentor
  ON public.action_item_session_links
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.action_items ai
      WHERE ai.id = action_item_id
        AND public.is_relationship_mentor(ai.relationship_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 9. action_item_events policies (append-only audit trail for participants)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS action_events_select_participants ON public.action_item_events;
CREATE POLICY action_events_select_participants
  ON public.action_item_events
  FOR SELECT
  TO authenticated
  USING (public.is_relationship_participant(relationship_id));

DROP POLICY IF EXISTS action_events_insert_participants ON public.action_item_events;
CREATE POLICY action_events_insert_participants
  ON public.action_item_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_relationship_participant(relationship_id)
    AND actor_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 10. notifications policies (strictly user-specific reads/updates/deletes)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS notifications_insert_own_or_partner ON public.notifications;
CREATE POLICY notifications_insert_own_or_partner
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.mentoring_relationships mr
      WHERE (mr.mentor_id = auth.uid() AND mr.learner_id = recipient_id)
         OR (mr.learner_id = auth.uid() AND mr.mentor_id = recipient_id)
    )
  );

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (recipient_id = auth.uid());
