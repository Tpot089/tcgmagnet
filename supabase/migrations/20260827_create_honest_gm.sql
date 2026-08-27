create extension if not exists pgcrypto;

create table if not exists public.honest_gm_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  premise text not null check (char_length(premise) between 1 and 250000),
  premise_hash text generated always as (encode(extensions.digest(premise, 'sha256'), 'hex')) stored,
  access_key uuid not null default gen_random_uuid() unique,
  character_name text check (character_name is null or char_length(character_name) <= 120),
  character_state jsonb not null default '{}'::jsonb check (jsonb_typeof(character_state) = 'object'),
  status text not null default 'active' check (status in ('active', 'archived'))
);

create table if not exists public.honest_gm_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.honest_gm_campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  event_type text not null check (char_length(event_type) between 1 and 60),
  summary text not null check (char_length(summary) between 1 and 4000),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create table if not exists public.honest_gm_canon (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.honest_gm_campaigns(id) on delete cascade,
  event_id uuid references public.honest_gm_events(id) on delete set null,
  created_at timestamptz not null default now(),
  category text not null default 'fact' check (char_length(category) between 1 and 60),
  subject text not null default 'Campaign' check (char_length(subject) between 1 and 200),
  fact text not null check (char_length(fact) between 1 and 4000)
);

create table if not exists public.honest_gm_rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.honest_gm_campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  roll_kind text not null check (roll_kind in ('check', 'damage')),
  label text not null check (char_length(label) between 1 and 200),
  die_sides integer not null check (die_sides between 2 and 1000),
  rolls integer[] not null check (coalesce(array_length(rolls, 1), 0) between 1 and 50),
  selected_roll integer,
  modifier integer not null default 0 check (modifier between -100 and 100),
  total integer not null,
  dc integer,
  success boolean,
  mode text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_honest_gm_campaigns_created_at
  on public.honest_gm_campaigns(created_at desc);
create index if not exists idx_honest_gm_events_campaign_created_at
  on public.honest_gm_events(campaign_id, created_at desc);
create index if not exists idx_honest_gm_canon_campaign_created_at
  on public.honest_gm_canon(campaign_id, created_at desc);
create index if not exists idx_honest_gm_canon_campaign_subject
  on public.honest_gm_canon(campaign_id, subject);
create index if not exists idx_honest_gm_rolls_campaign_created_at
  on public.honest_gm_rolls(campaign_id, created_at desc);

create or replace function public.set_honest_gm_campaign_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_honest_gm_premise_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.premise is distinct from old.premise then
    raise exception 'Honest GM premise is immutable once the campaign is created'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_honest_gm_campaign_updated_at on public.honest_gm_campaigns;
create trigger trg_honest_gm_campaign_updated_at
before update on public.honest_gm_campaigns
for each row execute function public.set_honest_gm_campaign_updated_at();

drop trigger if exists trg_honest_gm_premise_immutable on public.honest_gm_campaigns;
create trigger trg_honest_gm_premise_immutable
before update on public.honest_gm_campaigns
for each row execute function public.prevent_honest_gm_premise_change();

create or replace function public.honest_gm_record_event(
  p_campaign_id uuid,
  p_event_type text,
  p_summary text,
  p_details jsonb default '{}'::jsonb,
  p_canon_facts jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_fact jsonb;
  v_fact_text text;
  v_subject text;
  v_category text;
begin
  if char_length(trim(coalesce(p_event_type, ''))) = 0 then
    raise exception 'event_type is required' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_summary, ''))) = 0 then
    raise exception 'summary is required' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_details, '{}'::jsonb)) <> 'object' then
    raise exception 'details must be a JSON object' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_canon_facts, '[]'::jsonb)) <> 'array' then
    raise exception 'canon facts must be a JSON array' using errcode = '22023';
  end if;

  insert into public.honest_gm_events (campaign_id, event_type, summary, details)
  values (p_campaign_id, trim(p_event_type), trim(p_summary), coalesce(p_details, '{}'::jsonb))
  returning id into v_event_id;

  for v_fact in select value from jsonb_array_elements(coalesce(p_canon_facts, '[]'::jsonb))
  loop
    v_fact_text := trim(coalesce(v_fact ->> 'fact', ''));
    if char_length(v_fact_text) = 0 then
      raise exception 'every canon fact requires fact text' using errcode = '22023';
    end if;
    v_subject := coalesce(nullif(trim(v_fact ->> 'subject'), ''), 'Campaign');
    v_category := coalesce(nullif(trim(v_fact ->> 'category'), ''), 'fact');

    insert into public.honest_gm_canon (campaign_id, event_id, category, subject, fact)
    values (p_campaign_id, v_event_id, v_category, v_subject, v_fact_text);
  end loop;

  return v_event_id;
end;
$$;

create or replace function public.honest_gm_update_character(
  p_campaign_id uuid,
  p_patch jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state jsonb;
  v_reason text;
begin
  if jsonb_typeof(coalesce(p_patch, '{}'::jsonb)) <> 'object' then
    raise exception 'character patch must be a JSON object' using errcode = '22023';
  end if;

  update public.honest_gm_campaigns
  set character_state = character_state || coalesce(p_patch, '{}'::jsonb)
  where id = p_campaign_id
  returning character_state into v_state;

  if v_state is null then
    raise exception 'campaign not found' using errcode = 'P0002';
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if char_length(v_reason) > 0 then
    insert into public.honest_gm_events (campaign_id, event_type, summary, details)
    values (
      p_campaign_id,
      'character_update',
      v_reason,
      jsonb_build_object('patch', coalesce(p_patch, '{}'::jsonb))
    );
  end if;

  return v_state;
end;
$$;

alter table public.honest_gm_campaigns enable row level security;
alter table public.honest_gm_events enable row level security;
alter table public.honest_gm_canon enable row level security;
alter table public.honest_gm_rolls enable row level security;

create policy honest_gm_campaigns_staff_select
  on public.honest_gm_campaigns for select to authenticated
  using (public.is_staff());
create policy honest_gm_campaigns_staff_insert
  on public.honest_gm_campaigns for insert to authenticated
  with check (public.is_staff() and (created_by is null or created_by = auth.uid()));
create policy honest_gm_campaigns_staff_update
  on public.honest_gm_campaigns for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy honest_gm_campaigns_staff_delete
  on public.honest_gm_campaigns for delete to authenticated
  using (public.is_admin());

create policy honest_gm_events_staff_select
  on public.honest_gm_events for select to authenticated
  using (public.is_staff());
create policy honest_gm_events_staff_insert
  on public.honest_gm_events for insert to authenticated
  with check (public.is_staff());
create policy honest_gm_canon_staff_select
  on public.honest_gm_canon for select to authenticated
  using (public.is_staff());
create policy honest_gm_canon_staff_insert
  on public.honest_gm_canon for insert to authenticated
  with check (public.is_staff());
create policy honest_gm_rolls_staff_select
  on public.honest_gm_rolls for select to authenticated
  using (public.is_staff());
create policy honest_gm_rolls_staff_insert
  on public.honest_gm_rolls for insert to authenticated
  with check (public.is_staff());

grant select, insert, update, delete on public.honest_gm_campaigns to authenticated;
grant select, insert on public.honest_gm_events to authenticated;
grant select, insert on public.honest_gm_canon to authenticated;
grant select, insert on public.honest_gm_rolls to authenticated;

revoke all on function public.honest_gm_record_event(uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.honest_gm_record_event(uuid, text, text, jsonb, jsonb) to service_role;
revoke all on function public.honest_gm_update_character(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.honest_gm_update_character(uuid, jsonb, text) to service_role;

comment on table public.honest_gm_campaigns is 'Honest GM campaigns. The premise is immutable after creation and is the authoritative world bible.';
comment on column public.honest_gm_campaigns.access_key is 'Private bearer-style key used to scope the Honest GM MCP endpoint to one campaign.';
comment on table public.honest_gm_canon is 'Append-only facts established during play.';
comment on table public.honest_gm_events is 'Chronological campaign history established during play.';
comment on table public.honest_gm_rolls is 'Server-generated dice results used as the mechanical audit trail.';
