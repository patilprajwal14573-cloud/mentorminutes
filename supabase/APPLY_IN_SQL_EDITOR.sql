-- Combined MentorMinutes Supabase Setup Script (Idempotent)
-- Safe to run in Supabase Dashboard -> SQL Editor

-- === supabase/migrations/202611260001_initial_schema.sql ===
-- Migration 001: Initial MentorMinutes PostgreSQL Schema
-- Safe & idempotent: does not drop or overwrite existing tables or data.

-- ---------------------------------------------------------------------------
-- Helper utility functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. profiles (linked 1:1 to auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'learner' CHECK (role IN ('mentor', 'learner')),
  title text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  avatar text NOT NULL DEFAULT '',
  company_or_school text NOT NULL DEFAULT '',
  expertise text[] NOT NULL DEFAULT '{}',
  interests text[] NOT NULL DEFAULT '{}',
  invite_code text UNIQUE,
  settings jsonb NOT NULL DEFAULT '{"emailNotifications": true, "sessionReminders": true, "theme": "light"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_invite_code ON public.profiles (invite_code) WHERE invite_code IS NOT NULL;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Prevent direct client-side role/email/id tampering on profiles
CREATE OR REPLACE FUNCTION public.protect_profile_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Cannot change profile id' USING ERRCODE = '42501';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change profile role directly' USING ERRCODE = '42501';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Email is managed by authentication settings' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_fields ON public.profiles;
CREATE TRIGGER trg_profiles_protect_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_immutable_fields();

-- Generate unique mentor invite code (defined after public.profiles exists)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i integer;
  exists_already boolean;
BEGIN
  LOOP
    result := 'MM-';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, 1 + floor(random() * length(chars))::integer, 1);
    END LOOP;
    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE invite_code = result
    ) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN result;
END;
$$;

-- Automatically provision profile row when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role text;
  meta_name text;
  meta_title text;
  meta_org text;
  generated_code text;
BEGIN
  meta_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'learner');
  IF meta_role NOT IN ('mentor', 'learner') THEN
    meta_role := 'learner';
  END IF;

  meta_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(COALESCE(NEW.email, 'User'), '@', 1)
  );
  meta_title := COALESCE(trim(NEW.raw_user_meta_data->>'title'), '');
  meta_org := COALESCE(trim(NEW.raw_user_meta_data->>'companyOrSchool'), '');

  IF meta_role = 'mentor' THEN
    generated_code := public.generate_invite_code();
  ELSE
    generated_code := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, email, name, role, title, company_or_school, invite_code
  ) VALUES (
    NEW.id,
    lower(COALESCE(NEW.email, '')),
    meta_name,
    meta_role,
    meta_title,
    meta_org,
    generated_code
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. mentoring_relationships
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.mentoring_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic text NOT NULL CHECK (char_length(trim(topic)) > 0 AND char_length(topic) <= 150),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  meeting_frequency text NOT NULL DEFAULT 'Weekly' CHECK (meeting_frequency IN ('Weekly', 'Bi-weekly', 'Monthly', 'As-needed')),
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_mentor_not_learner CHECK (mentor_id <> learner_id)
);

CREATE INDEX IF NOT EXISTS idx_relationships_mentor ON public.mentoring_relationships (mentor_id, status);
CREATE INDEX IF NOT EXISTS idx_relationships_learner ON public.mentoring_relationships (learner_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_unique_active_pair
  ON public.mentoring_relationships (mentor_id, learner_id)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_relationships_updated_at ON public.mentoring_relationships;
CREATE TRIGGER trg_relationships_updated_at
  BEFORE UPDATE ON public.mentoring_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. sessions (shared session information; private notes live separately)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES public.mentoring_relationships(id) ON DELETE CASCADE,
  session_number integer NOT NULL CHECK (session_number >= 1),
  title text NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 200),
  scheduled_date timestamptz NOT NULL DEFAULT now(),
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes >= 15 AND duration_minutes <= 480),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  agenda text NOT NULL DEFAULT '',
  topics_discussed text NOT NULL DEFAULT '',
  key_takeaways text NOT NULL DEFAULT '',
  shared_summary text NOT NULL DEFAULT '',
  learner_feedback text NOT NULL DEFAULT '',
  next_session_date timestamptz,
  carried_actions_count integer NOT NULL DEFAULT 0 CHECK (carried_actions_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_session_number_per_relationship UNIQUE (relationship_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_sessions_relationship_date ON public.sessions (relationship_id, scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions (status);

DROP TRIGGER IF EXISTS trg_sessions_updated_at ON public.sessions;
CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Learners can update ONLY learner_feedback on sessions
CREATE OR REPLACE FUNCTION public.enforce_session_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  is_mentor boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.mentoring_relationships mr
    WHERE mr.id = OLD.relationship_id
      AND mr.mentor_id = auth.uid()
  ) INTO is_mentor;

  IF NOT is_mentor THEN
    IF NEW.relationship_id IS DISTINCT FROM OLD.relationship_id
      OR NEW.session_number IS DISTINCT FROM OLD.session_number
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date
      OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.agenda IS DISTINCT FROM OLD.agenda
      OR NEW.topics_discussed IS DISTINCT FROM OLD.topics_discussed
      OR NEW.key_takeaways IS DISTINCT FROM OLD.key_takeaways
      OR NEW.shared_summary IS DISTINCT FROM OLD.shared_summary
      OR NEW.next_session_date IS DISTINCT FROM OLD.next_session_date
      OR NEW.carried_actions_count IS DISTINCT FROM OLD.carried_actions_count
    THEN
      RAISE EXCEPTION 'Learners can only update learner_feedback on a session' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_enforce_update_permissions ON public.sessions;
CREATE TRIGGER trg_sessions_enforce_update_permissions
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_update_permissions();

-- ---------------------------------------------------------------------------
-- 4. mentor_private_notes (strictly mentor-only, isolated table)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.mentor_private_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  relationship_id uuid NOT NULL REFERENCES public.mentoring_relationships(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentor_private_notes_relationship ON public.mentor_private_notes (relationship_id, mentor_id);

DROP TRIGGER IF EXISTS trg_mentor_private_notes_updated_at ON public.mentor_private_notes;
CREATE TRIGGER trg_mentor_private_notes_updated_at
  BEFORE UPDATE ON public.mentor_private_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. goals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES public.mentoring_relationships(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  category text NOT NULL DEFAULT 'technical' CHECK (category IN ('technical', 'career', 'project', 'soft-skills', 'academic', 'other')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  start_date timestamptz NOT NULL DEFAULT now(),
  target_date timestamptz,
  status text NOT NULL DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'completed', 'on-hold')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  completion_notes text NOT NULL DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_relationship_status ON public.goals (relationship_id, status);

DROP TRIGGER IF EXISTS trg_goals_updated_at ON public.goals;
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. milestones
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 200),
  completed boolean NOT NULL DEFAULT false,
  due_date timestamptz,
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milestones_goal ON public.milestones (goal_id, sort_order, created_at);

DROP TRIGGER IF EXISTS trg_milestones_updated_at ON public.milestones;
CREATE TRIGGER trg_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.recalculate_goal_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_goal_id uuid;
  total_count integer;
  completed_count integer;
  new_progress integer;
  current_status text;
BEGIN
  target_goal_id := COALESCE(NEW.goal_id, OLD.goal_id);

  SELECT status INTO current_status
  FROM public.goals
  WHERE id = target_goal_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE completed = true)
  INTO total_count, completed_count
  FROM public.milestones
  WHERE goal_id = target_goal_id;

  IF total_count = 0 THEN
    RETURN NULL;
  END IF;

  new_progress := round((completed_count::numeric / total_count::numeric) * 100)::integer;

  UPDATE public.goals
  SET
    progress = new_progress,
    status = CASE
      WHEN new_progress = 100 THEN 'completed'
      WHEN current_status = 'completed' AND new_progress < 100 THEN 'in-progress'
      WHEN current_status = 'not-started' AND new_progress > 0 THEN 'in-progress'
      ELSE current_status
    END,
    completed_at = CASE
      WHEN new_progress = 100 THEN COALESCE(completed_at, now())
      ELSE NULL
    END
  WHERE id = target_goal_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_milestones_recalculate_goal ON public.milestones;
CREATE TRIGGER trg_milestones_recalculate_goal
  AFTER INSERT OR UPDATE OR DELETE ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_goal_progress();

-- ---------------------------------------------------------------------------
-- 7. action_items (canonical action task; never duplicated on carry-forward)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES public.mentoring_relationships(id) ON DELETE CASCADE,
  original_session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  current_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  assigned_to uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to_role text NOT NULL DEFAULT 'learner' CHECK (assigned_to_role IN ('mentor', 'learner')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  completed_at timestamptz,
  carry_count integer NOT NULL DEFAULT 0 CHECK (carry_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_items_relationship_status ON public.action_items (relationship_id, status);
CREATE INDEX IF NOT EXISTS idx_action_items_original_session ON public.action_items (original_session_id);
CREATE INDEX IF NOT EXISTS idx_action_items_current_session ON public.action_items (current_session_id);
CREATE INDEX IF NOT EXISTS idx_action_items_assigned_to ON public.action_items (assigned_to, status);

DROP TRIGGER IF EXISTS trg_action_items_updated_at ON public.action_items;
CREATE TRIGGER trg_action_items_updated_at
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. action_item_session_links (relational link across sessions)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.action_item_session_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_item_id uuid NOT NULL REFERENCES public.action_items(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  is_original boolean NOT NULL DEFAULT false,
  carried_from_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_action_item_session_link UNIQUE (action_item_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_action_links_session ON public.action_item_session_links (session_id, action_item_id);
CREATE INDEX IF NOT EXISTS idx_action_links_action ON public.action_item_session_links (action_item_id, linked_at);

-- ---------------------------------------------------------------------------
-- 9. action_item_events (audit trail for creation, carry-forward, status)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.action_item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_item_id uuid NOT NULL REFERENCES public.action_items(id) ON DELETE CASCADE,
  relationship_id uuid NOT NULL REFERENCES public.mentoring_relationships(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created', 'carried_forward', 'status_changed', 'updated')),
  from_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  to_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  previous_status text,
  new_status text,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_events_action ON public.action_item_events (action_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_events_relationship ON public.action_item_events (relationship_id, created_at DESC);

-- Triggers to auto-link original session and record lifecycle events
CREATE OR REPLACE FUNCTION public.handle_action_item_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.action_item_session_links (
    action_item_id, session_id, is_original, carried_from_session_id
  ) VALUES (
    NEW.id, NEW.original_session_id, true, NULL
  )
  ON CONFLICT (action_item_id, session_id) DO NOTHING;

  INSERT INTO public.action_item_events (
    action_item_id,
    relationship_id,
    event_type,
    to_session_id,
    new_status,
    actor_id,
    reason
  ) VALUES (
    NEW.id,
    NEW.relationship_id,
    'created',
    NEW.original_session_id,
    NEW.status,
    COALESCE(auth.uid(), NEW.created_by),
    'Action item created'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_action_items_after_insert ON public.action_items;
CREATE TRIGGER trg_action_items_after_insert
  AFTER INSERT ON public.action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_action_item_after_insert();

CREATE OR REPLACE FUNCTION public.handle_action_item_status_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'completed' THEN
      NEW.completed_at = COALESCE(NEW.completed_at, now());
    ELSE
      NEW.completed_at = NULL;
    END IF;

    INSERT INTO public.action_item_events (
      action_item_id,
      relationship_id,
      event_type,
      previous_status,
      new_status,
      actor_id,
      reason
    ) VALUES (
      NEW.id,
      NEW.relationship_id,
      'status_changed',
      OLD.status,
      NEW.status,
      auth.uid(),
      format('Status changed from %s to %s', OLD.status, NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_action_items_status_audit ON public.action_items;
CREATE TRIGGER trg_action_items_status_audit
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_action_item_status_audit();

-- Keep action_items intact when a later carried-into session is deleted
CREATE OR REPLACE FUNCTION public.handle_session_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.action_items ai
  SET
    current_session_id = COALESCE(
      (
        SELECT l.session_id
        FROM public.action_item_session_links l
        JOIN public.sessions s ON s.id = l.session_id
        WHERE l.action_item_id = ai.id
          AND l.session_id <> OLD.id
        ORDER BY s.session_number DESC
        LIMIT 1
      ),
      ai.original_session_id
    ),
    carry_count = GREATEST(
      0,
      (
        SELECT COUNT(*) - 1
        FROM public.action_item_session_links l
        WHERE l.action_item_id = ai.id
          AND l.session_id <> OLD.id
      )
    )
  WHERE ai.current_session_id = OLD.id
    AND ai.original_session_id <> OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_before_delete ON public.sessions;
CREATE TRIGGER trg_sessions_before_delete
  BEFORE DELETE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_session_before_delete();

-- ---------------------------------------------------------------------------
-- 10. notifications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) > 0),
  message text NOT NULL CHECK (char_length(trim(message)) > 0),
  type text NOT NULL DEFAULT 'system' CHECK (type IN ('session', 'action', 'goal', 'relationship', 'system')),
  link text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.notifications (recipient_id, read, created_at DESC);


-- === supabase/migrations/202611260002_rls_policies.sql ===
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


-- === supabase/migrations/202611260003_carry_forward_and_rpcs.sql ===
-- Migration 003: Atomic Automatic Action Carry-Forward & Secure RPC Functions

-- ---------------------------------------------------------------------------
-- 1. Preview eligible carry-forward actions for a relationship
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.preview_carry_forward(p_relationship_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_last_session public.sessions%ROWTYPE;
  v_actions jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_relationship_participant(p_relationship_id) THEN
    RAISE EXCEPTION 'Not authorized to preview carry-forward for this relationship' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_last_session
  FROM public.sessions
  WHERE relationship_id = p_relationship_id
  ORDER BY session_number DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'hasPreviousSession', false,
      'lastSession', NULL,
      'eligibleActions', '[]'::jsonb,
      'nextSessionNumber', 1
    );
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ai.id,
        'title', ai.title,
        'description', ai.description,
        'status', ai.status,
        'priority', ai.priority,
        'due_date', ai.due_date,
        'carry_count', ai.carry_count,
        'original_session_id', ai.original_session_id,
        'assigned_to_role', ai.assigned_to_role,
        'assigned_to', jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'email', p.email,
          'avatar', p.avatar,
          'role', p.role
        )
      )
      ORDER BY ai.due_date ASC NULLS LAST, ai.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_actions
  FROM public.action_item_session_links l
  JOIN public.action_items ai ON ai.id = l.action_item_id
  JOIN public.profiles p ON p.id = ai.assigned_to
  WHERE l.session_id = v_last_session.id
    AND ai.status IN ('pending', 'in-progress');

  RETURN jsonb_build_object(
    'hasPreviousSession', true,
    'lastSession', jsonb_build_object(
      'id', v_last_session.id,
      'session_number', v_last_session.session_number,
      'title', v_last_session.title,
      'scheduled_date', v_last_session.scheduled_date
    ),
    'eligibleActions', v_actions,
    'nextSessionNumber', v_last_session.session_number + 1
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Idempotent, atomic carry-forward engine (links, never duplicates)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.carry_forward_actions(
  p_relationship_id uuid,
  p_new_session_id uuid,
  p_selected_action_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_new_session public.sessions%ROWTYPE;
  v_prev_session public.sessions%ROWTYPE;
  v_action record;
  v_link_id uuid;
  v_carried_count integer := 0;
  v_carried_ids uuid[] := '{}';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_relationship_mentor(p_relationship_id) THEN
    RAISE EXCEPTION 'Only the mentor can execute action carry-forward' USING ERRCODE = '42501';
  END IF;

  -- Lock target session row to serialize concurrent/repeated carry-forward calls
  SELECT *
  INTO v_new_session
  FROM public.sessions
  WHERE id = p_new_session_id
    AND relationship_id = p_relationship_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target session not found in this relationship' USING ERRCODE = 'P0002';
  END IF;

  -- Identify relevant previous session within the same mentoring relationship
  SELECT *
  INTO v_prev_session
  FROM public.sessions
  WHERE relationship_id = p_relationship_id
    AND id <> v_new_session.id
    AND session_number < v_new_session.session_number
  ORDER BY session_number DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('carriedCount', 0, 'carriedActionIds', '[]'::jsonb);
  END IF;

  -- If mentor explicitly passed an empty selection array, carry nothing
  IF p_selected_action_ids IS NOT NULL AND coalesce(array_length(p_selected_action_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('carriedCount', 0, 'carriedActionIds', '[]'::jsonb);
  END IF;

  FOR v_action IN
    SELECT ai.*
    FROM public.action_item_session_links l
    JOIN public.action_items ai ON ai.id = l.action_item_id
    WHERE l.session_id = v_prev_session.id
      AND ai.relationship_id = p_relationship_id
      AND ai.status IN ('pending', 'in-progress')
      AND (
        p_selected_action_ids IS NULL
        OR ai.id = ANY(p_selected_action_ids)
      )
    ORDER BY ai.created_at ASC
    FOR UPDATE OF ai
  LOOP
    v_link_id := NULL;

    -- Unique constraint (action_item_id, session_id) guarantees zero duplicate links
    INSERT INTO public.action_item_session_links (
      action_item_id,
      session_id,
      is_original,
      carried_from_session_id
    ) VALUES (
      v_action.id,
      v_new_session.id,
      false,
      v_prev_session.id
    )
    ON CONFLICT (action_item_id, session_id) DO NOTHING
    RETURNING id INTO v_link_id;

    -- Only record event / increment counter if a brand-new link was created
    IF v_link_id IS NOT NULL THEN
      UPDATE public.action_items
      SET
        carry_count = carry_count + 1,
        current_session_id = v_new_session.id
        -- Note: status, completed_at, and original_session_id are NEVER reset or overwritten
      WHERE id = v_action.id;

      INSERT INTO public.action_item_events (
        action_item_id,
        relationship_id,
        event_type,
        from_session_id,
        to_session_id,
        previous_status,
        new_status,
        actor_id,
        reason,
        metadata
      ) VALUES (
        v_action.id,
        p_relationship_id,
        'carried_forward',
        v_prev_session.id,
        v_new_session.id,
        v_action.status,
        v_action.status,
        v_user_id,
        format('Carried forward from Session #%s (%s)', v_prev_session.session_number, v_action.status),
        jsonb_build_object(
          'from_session_number', v_prev_session.session_number,
          'to_session_number', v_new_session.session_number
        )
      );

      INSERT INTO public.notifications (
        recipient_id,
        title,
        message,
        type,
        link
      ) VALUES (
        v_action.assigned_to,
        'Action Item Carried Forward',
        format('Task "%s" was carried forward into Session #%s', v_action.title, v_new_session.session_number),
        'action',
        format('/sessions/%s', v_new_session.id)
      );

      v_carried_count := v_carried_count + 1;
      v_carried_ids := array_append(v_carried_ids, v_action.id);
    END IF;
  END LOOP;

  IF v_carried_count > 0 THEN
    UPDATE public.sessions
    SET carried_actions_count = (
      SELECT COUNT(*)
      FROM public.action_item_session_links l
      WHERE l.session_id = v_new_session.id
        AND l.is_original = false
    )
    WHERE id = v_new_session.id;
  END IF;

  RETURN jsonb_build_object(
    'carriedCount', v_carried_count,
    'carriedActionIds', to_jsonb(v_carried_ids)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Atomic create_session_with_carry_forward RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_session_with_carry_forward(
  p_relationship_id uuid,
  p_title text DEFAULT NULL,
  p_scheduled_date timestamptz DEFAULT now(),
  p_duration_minutes integer DEFAULT 60,
  p_agenda text DEFAULT '',
  p_topics_discussed text DEFAULT '',
  p_key_takeaways text DEFAULT '',
  p_shared_summary text DEFAULT '',
  p_mentor_private_notes text DEFAULT '',
  p_learner_feedback text DEFAULT '',
  p_next_session_date timestamptz DEFAULT NULL,
  p_selected_carry_action_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rel public.mentoring_relationships%ROWTYPE;
  v_mentor_name text;
  v_next_number integer;
  v_session public.sessions%ROWTYPE;
  v_carry_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Lock the relationship row so concurrent creates cannot collide on session_number
  SELECT *
  INTO v_rel
  FROM public.mentoring_relationships
  WHERE id = p_relationship_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Relationship not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_rel.mentor_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the mentor of this relationship can create sessions' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(MAX(session_number), 0) + 1
  INTO v_next_number
  FROM public.sessions
  WHERE relationship_id = p_relationship_id;

  INSERT INTO public.sessions (
    relationship_id,
    session_number,
    title,
    scheduled_date,
    duration_minutes,
    status,
    agenda,
    topics_discussed,
    key_takeaways,
    shared_summary,
    learner_feedback,
    next_session_date
  ) VALUES (
    p_relationship_id,
    v_next_number,
    COALESCE(NULLIF(trim(p_title), ''), format('Session #%s', v_next_number)),
    COALESCE(p_scheduled_date, now()),
    COALESCE(p_duration_minutes, 60),
    'scheduled',
    COALESCE(p_agenda, ''),
    COALESCE(p_topics_discussed, ''),
    COALESCE(p_key_takeaways, ''),
    COALESCE(p_shared_summary, ''),
    COALESCE(p_learner_feedback, ''),
    p_next_session_date
  )
  RETURNING * INTO v_session;

  IF COALESCE(trim(p_mentor_private_notes), '') <> '' THEN
    INSERT INTO public.mentor_private_notes (
      session_id,
      relationship_id,
      mentor_id,
      content
    ) VALUES (
      v_session.id,
      p_relationship_id,
      v_user_id,
      p_mentor_private_notes
    );
  END IF;

  v_carry_result := public.carry_forward_actions(
    p_relationship_id,
    v_session.id,
    p_selected_carry_action_ids
  );

  SELECT name INTO v_mentor_name FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.notifications (
    recipient_id,
    title,
    message,
    type,
    link
  ) VALUES (
    v_rel.learner_id,
    'New Session Scheduled',
    format('%s scheduled Session #%s: "%s"', COALESCE(v_mentor_name, 'Your mentor'), v_session.session_number, v_session.title),
    'session',
    format('/sessions/%s', v_session.id)
  );

  -- Reload updated carried_actions_count
  SELECT * INTO v_session FROM public.sessions WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'session', to_jsonb(v_session),
    'carriedActionsCount', COALESCE((v_carry_result->>'carriedCount')::integer, 0),
    'carriedActionIds', COALESCE(v_carry_result->'carriedActionIds', '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Relationship Invite Code & Email Lookup RPCs (zero profile leak)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_relationship_by_invite_code(
  p_invite_code text,
  p_topic text DEFAULT 'General Mentorship'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user public.profiles%ROWTYPE;
  v_mentor public.profiles%ROWTYPE;
  v_existing_id uuid;
  v_rel_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_user FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND OR v_user.role <> 'learner' THEN
    RAISE EXCEPTION 'Only learners can join via mentor invite code' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_mentor
  FROM public.profiles
  WHERE invite_code = upper(trim(COALESCE(p_invite_code, '')))
    AND role = 'mentor';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code. No mentor found with this code.' USING ERRCODE = 'P0002';
  END IF;

  SELECT id
  INTO v_existing_id
  FROM public.mentoring_relationships
  WHERE mentor_id = v_mentor.id
    AND learner_id = v_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'You already have an active relationship with this mentor' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.mentoring_relationships (
    mentor_id,
    learner_id,
    topic
  ) VALUES (
    v_mentor.id,
    v_user_id,
    COALESCE(NULLIF(trim(p_topic), ''), 'General Mentorship')
  )
  RETURNING id INTO v_rel_id;

  INSERT INTO public.notifications (
    recipient_id,
    title,
    message,
    type,
    link
  ) VALUES (
    v_mentor.id,
    'New Learner Connected',
    format('%s joined your mentorship using your invite code', v_user.name),
    'relationship',
    format('/relationships')
  );

  RETURN v_rel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_relationship_by_learner_email(
  p_learner_email text,
  p_topic text,
  p_description text DEFAULT '',
  p_meeting_frequency text DEFAULT 'Weekly'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_mentor public.profiles%ROWTYPE;
  v_learner public.profiles%ROWTYPE;
  v_existing_id uuid;
  v_rel_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_mentor FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND OR v_mentor.role <> 'mentor' THEN
    RAISE EXCEPTION 'Only mentors can create a mentoring relationship directly' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_learner
  FROM public.profiles
  WHERE lower(email) = lower(trim(COALESCE(p_learner_email, '')));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Learner user not found. Check the email or have them register first.' USING ERRCODE = 'P0002';
  END IF;

  IF v_learner.role <> 'learner' THEN
    RAISE EXCEPTION 'Selected user is not registered as a learner' USING ERRCODE = '22023';
  END IF;

  SELECT id
  INTO v_existing_id
  FROM public.mentoring_relationships
  WHERE mentor_id = v_user_id
    AND learner_id = v_learner.id
    AND status = 'active'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'An active relationship already exists with this learner' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.mentoring_relationships (
    mentor_id,
    learner_id,
    topic,
    description,
    meeting_frequency
  ) VALUES (
    v_user_id,
    v_learner.id,
    trim(p_topic),
    COALESCE(p_description, ''),
    COALESCE(NULLIF(trim(p_meeting_frequency), ''), 'Weekly')
  )
  RETURNING id INTO v_rel_id;

  INSERT INTO public.notifications (
    recipient_id,
    title,
    message,
    type,
    link
  ) VALUES (
    v_learner.id,
    'New Mentoring Relationship',
    format('%s created a new mentorship with you on "%s"', v_mentor.name, trim(p_topic)),
    'relationship',
    '/relationships'
  );

  RETURN v_rel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_mentor_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  IF v_role <> 'mentor' THEN
    RAISE EXCEPTION 'Only mentors can regenerate an invite code' USING ERRCODE = '42501';
  END IF;

  v_code := public.generate_invite_code();
  UPDATE public.profiles SET invite_code = v_code WHERE id = v_user_id;
  RETURN v_code;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Sync overdue action & approaching goal deadline reminders
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_due_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_48h timestamptz := now() + interval '48 hours';
  v_7d_ago timestamptz := now() - interval '7 days';
  v_created integer := 0;
  v_action record;
  v_goal record;
  v_msg text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_action IN
    SELECT ai.title, ai.current_session_id, ai.due_date
    FROM public.action_items ai
    WHERE ai.assigned_to = v_user_id
      AND ai.status IN ('pending', 'in-progress')
      AND ai.due_date IS NOT NULL
      AND ai.due_date < v_now
  LOOP
    v_msg := format('Task "%s" is past its due date (%s)', v_action.title, to_char(v_action.due_date, 'Mon DD, YYYY'));
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = v_user_id
        AND n.title = 'Overdue Action Item'
        AND n.message = v_msg
        AND n.created_at >= v_7d_ago
    ) THEN
      INSERT INTO public.notifications (recipient_id, title, message, type, link)
      VALUES (v_user_id, 'Overdue Action Item', v_msg, 'action', format('/sessions/%s', v_action.current_session_id));
      v_created := v_created + 1;
    END IF;
  END LOOP;

  FOR v_goal IN
    SELECT g.title, g.target_date
    FROM public.goals g
    JOIN public.mentoring_relationships mr ON mr.id = g.relationship_id
    WHERE (mr.mentor_id = v_user_id OR mr.learner_id = v_user_id)
      AND mr.status = 'active'
      AND g.status <> 'completed'
      AND g.target_date IS NOT NULL
      AND g.target_date >= v_now
      AND g.target_date <= v_48h
  LOOP
    v_msg := format('Goal "%s" is due by %s', v_goal.title, to_char(v_goal.target_date, 'Mon DD, YYYY'));
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = v_user_id
        AND n.title = 'Goal Deadline Approaching'
        AND n.message = v_msg
        AND n.created_at >= v_7d_ago
    ) THEN
      INSERT INTO public.notifications (recipient_id, title, message, type, link)
      VALUES (v_user_id, 'Goal Deadline Approaching', v_msg, 'goal', '/goals');
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN v_created;
END;
$$;

-- Restrict RPC execution grants cleanly
REVOKE ALL ON FUNCTION public.preview_carry_forward(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.carry_forward_actions(uuid, uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_session_with_carry_forward(uuid, text, timestamptz, integer, text, text, text, text, text, text, timestamptz, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_relationship_by_invite_code(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_relationship_by_learner_email(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.regenerate_mentor_invite_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_due_reminders() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.preview_carry_forward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.carry_forward_actions(uuid, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_session_with_carry_forward(uuid, text, timestamptz, integer, text, text, text, text, text, text, timestamptz, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_relationship_by_invite_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_relationship_by_learner_email(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_mentor_invite_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_due_reminders() TO authenticated;


-- === supabase/migrations/202611260004_table_grants.sql ===
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
