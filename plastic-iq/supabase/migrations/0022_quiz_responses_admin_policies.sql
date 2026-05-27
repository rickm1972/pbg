-- Allow authenticated admin UI to read/delete quiz responses.

begin;

drop policy if exists "Authenticated read quiz_responses" on public.quiz_responses;
create policy "Authenticated read quiz_responses"
on public.quiz_responses
for select
to authenticated
using (true);

drop policy if exists "Authenticated delete quiz_responses" on public.quiz_responses;
create policy "Authenticated delete quiz_responses"
on public.quiz_responses
for delete
to authenticated
using (true);

commit;

