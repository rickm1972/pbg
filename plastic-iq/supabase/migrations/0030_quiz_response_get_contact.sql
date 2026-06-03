-- Include contact fields in quiz_response_get for client-side email gate on /loading and /result.

begin;

create or replace function public.quiz_response_get(p_response_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.quiz_responses%rowtype;
begin
  select * into v_row
  from public.quiz_responses
  where response_id = p_response_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'response_id', v_row.response_id,
    'scored_answers', v_row.scored_answers,
    'awareness_answers', v_row.awareness_answers,
    'motivation_answers', v_row.motivation_answers,
    'final_score', v_row.final_score,
    'letter_grade', v_row.letter_grade,
    'tier', v_row.tier,
    'completed_at', v_row.completed_at,
    'user_email', v_row.user_email,
    'first_name', v_row.first_name
  );
end;
$$;

commit;
