-- Admin approval flow: drafts stay private until one of the configured
-- administrators approves them from /admin/aprobaciones.

alter table articles
  add column if not exists reviewed_by_username text,
  add column if not exists reviewed_by_name text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_by_username text,
  add column if not exists approved_by_name text;

alter table articles drop constraint if exists articles_status_check;
alter table articles
  add constraint articles_status_check
  check (status in ('auto_published', 'draft', 'pending_review', 'discarded', 'published'));

create index if not exists idx_articles_pending_review
  on articles (drafted_at desc)
  where status = 'pending_review';
