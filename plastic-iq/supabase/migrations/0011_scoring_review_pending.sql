-- Add scoring_review_pending agent_status for Agent 3 review queue

begin;

alter table public.products
  drop constraint if exists products_agent_status_allowed;

alter table public.products
  add constraint products_agent_status_allowed check (
    agent_status in (
      'unscored',
      'evidence_pending',
      'evidence_in_progress',
      'evidence_awaiting_review',
      'evidence_approved',
      'evidence_rejected',
      'normalization_pending',
      'normalization_in_progress',
      'normalization_awaiting_review',
      'normalization_approved',
      'normalization_rejected',
      'in_testing_queue',
      'scoring_pending',
      'scoring_in_progress',
      'scoring_review_pending',
      'scoring_awaiting_review',
      'scoring_approved',
      'scoring_rejected',
      'qa_pending',
      'qa_in_progress',
      'qa_awaiting_review',
      'qa_approved',
      'qa_rejected',
      'ready_for_publish',
      'published'
    )
  );

commit;
