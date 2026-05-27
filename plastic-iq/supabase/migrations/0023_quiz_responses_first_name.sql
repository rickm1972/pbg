-- Add first_name to quiz_responses and extend quiz_response_patch RPC.

begin;

alter table public.quiz_responses
  add column if not exists first_name text null;

drop function if exists public.quiz_response_patch(
  uuid,
  timestamptz,
  text,
  int,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
);

create or replace function public.quiz_response_patch(
  p_response_id uuid,
  p_completed_at timestamptz default null,
  p_user_email text default null,
  p_first_name text default null,
  p_final_score int default null,
  p_letter_grade text default null,
  p_tier text default null,
  p_scored_answers jsonb default null,
  p_awareness_answers jsonb default null,
  p_motivation_answers jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quiz_responses
  set
    completed_at = coalesce(p_completed_at, completed_at),
    user_email = coalesce(nullif(trim(p_user_email), ''), user_email),
    first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
    final_score = coalesce(p_final_score, final_score),
    letter_grade = coalesce(nullif(trim(p_letter_grade), ''), letter_grade),
    tier = coalesce(nullif(trim(p_tier), ''), tier),
    scored_answers = coalesce(p_scored_answers, scored_answers),
    awareness_answers = coalesce(p_awareness_answers, awareness_answers),
    motivation_answers = coalesce(p_motivation_answers, motivation_answers)
  where response_id = p_response_id;
end;
$$;

comment on function public.quiz_response_patch(uuid,timestamptz,text,text,int,text,text,jsonb,jsonb,jsonb) is
  'Patch a quiz_responses row by response_id (anon-safe; row id acts as capability token).';

revoke all on function public.quiz_response_patch(uuid,timestamptz,text,text,int,text,text,jsonb,jsonb,jsonb) from public;
grant execute on function public.quiz_response_patch(uuid,timestamptz,text,text,int,text,text,jsonb,jsonb,jsonb) to anon, authenticated;

commit;
