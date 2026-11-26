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
