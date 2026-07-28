create extension if not exists pgcrypto;

create table if not exists public.tcg_collection_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'New' check (
    status in ('New', 'Reviewing', 'Contacted', 'Negotiating', 'Purchased', 'Follow Up', 'Declined', 'Lost')
  ),
  full_name text not null,
  email text not null,
  phone text not null,
  city text not null,
  province text not null,
  card_games text[] not null default '{}',
  collection_types text[] not null default '{}',
  approximate_card_count text not null,
  estimated_value text,
  important_items text not null,
  condition_notes text,
  selling_scope text not null check (selling_scope in ('All', 'Part', 'Unsure')),
  selling_timeline text not null check (
    selling_timeline in ('As soon as possible', 'Within one week', 'Within one month', 'Just exploring offers')
  ),
  willing_to_ship text not null check (willing_to_ship in ('Yes', 'No', 'Unsure')),
  additional_details text,
  photo_paths jsonb not null default '[]'::jsonb,
  consent_confirmed boolean not null default false,
  source text,
  medium text,
  campaign text,
  term text,
  content text,
  gclid text,
  landing_page text,
  referrer text,
  first_touch_at timestamptz,
  initial_offer numeric(12,2),
  final_purchase_price numeric(12,2),
  expected_resale_value numeric(12,2),
  actual_resale_value numeric(12,2),
  follow_up_date date
);

create table if not exists public.tcg_collection_lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.tcg_collection_leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_email text,
  note text not null
);

create or replace function public.set_tcg_collection_leads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tcg_collection_leads_updated_at on public.tcg_collection_leads;
create trigger trg_tcg_collection_leads_updated_at
before update on public.tcg_collection_leads
for each row execute function public.set_tcg_collection_leads_updated_at();

create index if not exists idx_tcg_collection_leads_created_at on public.tcg_collection_leads(created_at desc);
create index if not exists idx_tcg_collection_leads_status on public.tcg_collection_leads(status);
create index if not exists idx_tcg_collection_leads_province on public.tcg_collection_leads(province);
create index if not exists idx_tcg_collection_leads_card_games on public.tcg_collection_leads using gin(card_games);
create index if not exists idx_tcg_collection_leads_collection_types on public.tcg_collection_leads using gin(collection_types);
create index if not exists idx_tcg_collection_lead_notes_lead_id_created_at on public.tcg_collection_lead_notes(lead_id, created_at desc);

alter table public.tcg_collection_leads enable row level security;
alter table public.tcg_collection_lead_notes enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tcg-lead-photos',
  'tcg-lead-photos',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.tcg_collection_leads is 'TCG Magnet collection acquisition lead submissions.';
comment on column public.tcg_collection_leads.photo_paths is 'Private Supabase Storage object metadata for uploaded seller photos.';
comment on column public.tcg_collection_leads.initial_offer is 'Private ops-only financial field.';
comment on column public.tcg_collection_leads.final_purchase_price is 'Private ops-only financial field.';
comment on column public.tcg_collection_leads.expected_resale_value is 'Private ops-only financial field.';
comment on column public.tcg_collection_leads.actual_resale_value is 'Private ops-only financial field.';
