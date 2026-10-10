-- No SMS: invites go by email or shareable link only. (Checked: no 'sms' invites existed.)
alter type public.invite_channel rename to invite_channel_old;
create type public.invite_channel as enum ('email', 'link');
alter table public.invites
  alter column channel type public.invite_channel using channel::text::public.invite_channel;
drop type public.invite_channel_old;
