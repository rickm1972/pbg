-- Kitchen PAC Safety Quiz V1: response capture table + RPCs for anon clients.

begin;

create table if not exists public.quiz_responses (
  response_id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  user_email text null,
  final_score int null,
  letter_grade text null,
  tier text null,
  scored_answers jsonb not null default '{}'::jsonb,
  awareness_answers jsonb not null default '{}'::jsonb,
  motivation_answers jsonb not null default '{}'::jsonb,
  user_agent text null
);

alter table public.quiz_responses enable row level security;

-- No direct public select/update policies: quiz writes happen via security definer RPCs.

create or replace function public.quiz_response_create(p_user_agent text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.quiz_responses (user_agent)
  values (nullif(trim(p_user_agent), ''))
  returning response_id into v_id;

  return v_id;
end;
$$;

comment on function public.quiz_response_create(text) is
  'Creates a new quiz_responses row and returns response_id (anon-safe).';

revoke all on function public.quiz_response_create(text) from public;
grant execute on function public.quiz_response_create(text) to anon, authenticated;

create or replace function public.quiz_response_patch(
  p_response_id uuid,
  p_completed_at timestamptz default null,
  p_user_email text default null,
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
    final_score = coalesce(p_final_score, final_score),
    letter_grade = coalesce(nullif(trim(p_letter_grade), ''), letter_grade),
    tier = coalesce(nullif(trim(p_tier), ''), tier),
    scored_answers = coalesce(p_scored_answers, scored_answers),
    awareness_answers = coalesce(p_awareness_answers, awareness_answers),
    motivation_answers = coalesce(p_motivation_answers, motivation_answers)
  where response_id = p_response_id;
end;
$$;

comment on function public.quiz_response_patch(uuid,timestamptz,text,int,text,text,jsonb,jsonb,jsonb) is
  'Patch a quiz_responses row by response_id (anon-safe; row id acts as capability token).';

revoke all on function public.quiz_response_patch(uuid,timestamptz,text,int,text,text,jsonb,jsonb,jsonb) from public;
grant execute on function public.quiz_response_patch(uuid,timestamptz,text,int,text,text,jsonb,jsonb,jsonb) to anon, authenticated;

commit;

