alter table public.profiles
  add column focus_areas text[] not null default '{}',
  add column terms_accepted_at timestamptz,
  add column notifications_enabled boolean not null default false;

alter table public.profiles
  add constraint profiles_focus_areas_check check (
    focus_areas <@ array[
      'control_expenses',
      'remember_bills',
      'understand_categories',
      'track_available_balance'
    ]::text[]
  );
