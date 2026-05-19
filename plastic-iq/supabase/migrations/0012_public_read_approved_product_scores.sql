-- Allow public product pages to read approved Agent 3 scores

begin;

drop policy if exists "Public read approved product_scores" on public.product_scores;
create policy "Public read approved product_scores"
on public.product_scores
for select
to anon, authenticated
using (review_status = 'approved');

commit;
