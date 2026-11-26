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
