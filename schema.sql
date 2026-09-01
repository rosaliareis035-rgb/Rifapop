-- RifaPop: banco de dados Supabase
create extension if not exists pgcrypto;

 drop table if exists public.buyers cascade;
drop table if exists public.rifa_numbers cascade;
drop table if exists public.app_settings cascade;

create table public.rifa_numbers (
  number integer primary key check (number between 1 and 1000),
  status text not null default 'available' check (status in ('available','reserved','paid')),
  buyer_id uuid null,
  updated_at timestamptz not null default now()
);

insert into public.rifa_numbers(number)
select generate_series(1,1000);

create table public.buyers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  numbers integer[] not null,
  total numeric(10,2) not null,
  status text not null default 'reserved' check (status in ('reserved','paid','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz null
);

alter table public.rifa_numbers
  add constraint rifa_numbers_buyer_fk foreign key (buyer_id) references public.buyers(id) on delete set null;

create table public.app_settings (
  id boolean primary key default true check (id = true),
  pix text not null default '73981602717',
  whatsapp text not null default '5573981602717',
  price numeric(10,2) not null default 10,
  total_numbers integer not null default 1000,
  reservation_minutes integer not null default 30,
  updated_at timestamptz not null default now()
);
insert into public.app_settings(id) values (true);

alter table public.rifa_numbers enable row level security;
alter table public.buyers enable row level security;
alter table public.app_settings enable row level security;

create policy "public read numbers" on public.rifa_numbers for select using (true);
create policy "public read settings" on public.app_settings for select using (true);
create policy "admin read buyers" on public.buyers for select to authenticated using (true);
create policy "admin update buyers" on public.buyers for update to authenticated using (true) with check (true);
create policy "admin read numbers" on public.rifa_numbers for select to authenticated using (true);
create policy "admin update numbers" on public.rifa_numbers for update to authenticated using (true) with check (true);
create policy "admin update settings" on public.app_settings for update to authenticated using (true) with check (true);

create or replace function public.reserve_numbers(
  p_name text,
  p_phone text,
  p_numbers integer[]
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_buyer_id uuid;
  v_total numeric(10,2);
  v_price numeric(10,2);
  v_count integer;
  v_unavailable integer[];
  v_minutes integer;
begin
  if coalesce(trim(p_name),'') = '' or coalesce(trim(p_phone),'') = '' then
    raise exception 'Nome e WhatsApp são obrigatórios';
  end if;
  if p_numbers is null or array_length(p_numbers,1) is null then
    raise exception 'Selecione pelo menos um número';
  end if;

  select price, reservation_minutes into v_price, v_minutes from app_settings where id = true;
  v_minutes := coalesce(v_minutes,30);
  v_count := (select count(*) from unnest(p_numbers));

  select array_agg(r.number order by r.number)
    into v_unavailable
  from rifa_numbers r
  where r.number = any(p_numbers) and r.status <> 'available';

  if v_unavailable is not null then
    return jsonb_build_object('ok',false,'unavailable',v_unavailable);
  end if;

  insert into buyers(name,phone,numbers,total,status,expires_at)
  values (trim(p_name),trim(p_phone),p_numbers,v_count*v_price,'reserved',now() + make_interval(mins => v_minutes))
  returning id into v_buyer_id;

  update rifa_numbers
  set status='reserved', buyer_id=v_buyer_id, updated_at=now()
  where number = any(p_numbers);

  return jsonb_build_object('ok',true,'buyer_id',v_buyer_id,'total',v_count*v_price,'expires_at',(select expires_at from buyers where id=v_buyer_id));
end;
$$;

grant execute on function public.reserve_numbers(text,text,integer[]) to anon, authenticated;

-- Libera automaticamente reservas vencidas que ainda não foram pagas.
create or replace function public.release_expired_reservations()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update rifa_numbers r
  set status='available', buyer_id=null, updated_at=now()
  where r.status='reserved'
    and r.buyer_id in (
      select b.id from buyers b
      where b.status='reserved' and b.expires_at is not null and b.expires_at <= now()
    );

  get diagnostics v_count = row_count;

  update buyers
  set status='expired'
  where status='reserved' and expires_at is not null and expires_at <= now();

  return v_count;
end;
$$;

grant execute on function public.release_expired_reservations() to anon, authenticated;
