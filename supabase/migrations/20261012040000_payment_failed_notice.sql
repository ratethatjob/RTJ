-- In-app notice when a Pro card payment fails (written by the Stripe webhook, also emailed).
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'review_published', 'reply', 'application_status', 'followed_review', 'followed_job', 'new_application',
  'application_message', 'trial_ending', 'trial_ended', 'payment_failed'));
