-- Run this file in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  display_name text,
  email text unique,
  status text not null default 'active' check (status in ('active', 'inactive', 'banned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_roles (
  id smallserial primary key,
  role_name text not null unique check (role_name in ('owner', 'admin', 'member')),
  description text
);

insert into public.app_roles (role_name, description)
values
  ('owner', 'Toan quyen he thong'),
  ('admin', 'Quan tri nghiep vu va moderation'),
  ('member', 'Thanh vien gym')
on conflict (role_name) do nothing;

create table if not exists public.app_user_roles (
  id bigserial primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role_id smallint not null references public.app_roles(id) on delete restrict,
  assigned_by uuid references public.app_users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (user_id, role_id)
);

create table if not exists public.gym_member_profiles (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  membership_type text not null check (membership_type in ('STANDARD', 'VIP')),
  registration_date bigint,
  expiry_date bigint,
  total_attendance integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_attendance_records (
  id bigserial primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  attendance_date bigint not null,
  attendance_status text not null check (attendance_status in ('ABSENT', 'PRESENT')),
  recorded_by uuid references public.app_users(id) on delete set null,
  tx_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_actions (
  id bigserial primary key,
  admin_user_id uuid not null references public.app_users(id) on delete cascade,
  action_type text not null,
  target_user_id uuid references public.app_users(id) on delete set null,
  tx_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.gym_service_catalog (
  id bigserial primary key,
  service_code text not null unique,
  service_name text not null,
  service_type text not null check (service_type in ('membership', 'addon', 'product', 'service')),
  description text,
  price_wei text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'checked_out', 'abandoned', 'expired')),
  chain_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, status)
);

create table if not exists public.gym_cart_items (
  id bigserial primary key,
  cart_id uuid not null references public.gym_carts(id) on delete cascade,
  service_id bigint references public.gym_service_catalog(id) on delete set null,
  item_name text not null,
  unit_price_wei text not null,
  quantity integer not null default 1 check (quantity > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, service_id, item_name)
);

create table if not exists public.gym_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.app_users(id) on delete cascade,
  cart_id uuid references public.gym_carts(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  order_kind text not null default 'membership' check (order_kind in ('membership', 'addon', 'product', 'mixed')),
  chain_id integer,
  currency text not null default 'ETH',
  total_amount_wei text not null,
  tx_hash text unique,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_order_items (
  id bigserial primary key,
  order_id uuid not null references public.gym_orders(id) on delete cascade,
  service_id bigint references public.gym_service_catalog(id) on delete set null,
  item_name text not null,
  unit_price_wei text not null,
  quantity integer not null default 1 check (quantity > 0),
  line_total_wei text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.gym_payment_transactions (
  id bigserial primary key,
  order_id uuid references public.gym_orders(id) on delete set null,
  user_id uuid not null references public.app_users(id) on delete cascade,
  payment_kind text not null check (payment_kind in ('membership', 'addon', 'product', 'refund', 'withdrawal')),
  chain_id integer,
  from_address text,
  to_address text,
  amount_wei text not null,
  tx_hash text not null unique,
  status text not null default 'submitted' check (status in ('submitted', 'confirmed', 'failed', 'reverted')),
  block_number bigint,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_refunds (
  id bigserial primary key,
  payment_transaction_id bigint not null references public.gym_payment_transactions(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  amount_wei text not null,
  tx_hash text unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected', 'failed')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- MetaMask-only flow: the database is intended to be accessed from backend/server code
-- using the Supabase service role key. RLS is enabled so anonymous client access is blocked.
alter table public.app_users enable row level security;
alter table public.app_roles enable row level security;
alter table public.app_user_roles enable row level security;
alter table public.gym_member_profiles enable row level security;
alter table public.gym_attendance_records enable row level security;
alter table public.admin_actions enable row level security;
alter table public.gym_service_catalog enable row level security;
alter table public.gym_carts enable row level security;
alter table public.gym_cart_items enable row level security;
alter table public.gym_orders enable row level security;
alter table public.gym_order_items enable row level security;
alter table public.gym_payment_transactions enable row level security;
alter table public.gym_refunds enable row level security;


create index if not exists idx_app_users_wallet on public.app_users (wallet_address);
create index if not exists idx_app_user_roles_user on public.app_user_roles (user_id);
create index if not exists idx_gym_attendance_user on public.gym_attendance_records (user_id);
create index if not exists idx_admin_actions_admin on public.admin_actions (admin_user_id);
create index if not exists idx_gym_service_catalog_active on public.gym_service_catalog (is_active);
create index if not exists idx_gym_carts_user on public.gym_carts (user_id);
create index if not exists idx_gym_cart_items_cart on public.gym_cart_items (cart_id);
create index if not exists idx_gym_orders_user on public.gym_orders (user_id);
create index if not exists idx_gym_orders_status on public.gym_orders (status);
create index if not exists idx_gym_order_items_order on public.gym_order_items (order_id);
create index if not exists idx_gym_payment_transactions_user on public.gym_payment_transactions (user_id);
create index if not exists idx_gym_payment_transactions_order on public.gym_payment_transactions (order_id);
create index if not exists idx_gym_refunds_user on public.gym_refunds (user_id);

insert into public.app_users (wallet_address, display_name, email, status)
values
  ('0x1111111111111111111111111111111111111111', 'Gym Owner Demo', 'owner@gym.local', 'active'),
  ('0x2222222222222222222222222222222222222222', 'Gym Admin Demo', 'admin@gym.local', 'active'),
  ('0x3333333333333333333333333333333333333333', 'Gym Member Demo', 'member@gym.local', 'active')
on conflict (wallet_address) do nothing;

insert into public.app_user_roles (user_id, role_id)
select u.id, r.id
from public.app_users u
join public.app_roles r on r.role_name = 'owner'
where u.wallet_address = '0x1111111111111111111111111111111111111111'
on conflict do nothing;

insert into public.app_user_roles (user_id, role_id)
select u.id, r.id
from public.app_users u
join public.app_roles r on r.role_name = 'admin'
where u.wallet_address = '0x2222222222222222222222222222222222222222'
on conflict do nothing;

insert into public.app_user_roles (user_id, role_id)
select u.id, r.id
from public.app_users u
join public.app_roles r on r.role_name = 'member'
where u.wallet_address = '0x3333333333333333333333333333333333333333'
on conflict do nothing;

insert into public.gym_member_profiles (
  user_id,
  membership_type,
  registration_date,
  expiry_date,
  total_attendance,
  is_active
)
select
  u.id,
  'STANDARD',
  extract(epoch from now())::bigint,
  extract(epoch from now() + interval '30 days')::bigint,
  8,
  true
from public.app_users u
where u.wallet_address = '0x3333333333333333333333333333333333333333'
on conflict (user_id) do nothing;

insert into public.gym_service_catalog (
  service_code,
  service_name,
  service_type,
  description,
  price_wei,
  is_active,
  metadata
)
values
  ('MEM-STD', 'Standard Membership', 'membership', 'Goi tap STANDARD 30 ngay', '500000000000000000', true, '{"duration_days":30}'::jsonb),
  ('MEM-VIP', 'VIP Membership', 'membership', 'Goi tap VIP 30 ngay', '1000000000000000000', true, '{"duration_days":30}'::jsonb),
  ('ADD-PT-1', 'PT Session', 'addon', 'Buoi tap cung PT', '250000000000000000', true, '{"minutes":60}'::jsonb),
  ('PRD-WATER', 'Bottled Water', 'product', 'Nuoc uong dong chai', '10000000000000000', true, '{"unit":"bottle"}'::jsonb),
  ('SRV-TOWEL', 'Towel Service', 'service', 'Dich vu thue khan', '5000000000000000', true, '{"unit":"visit"}'::jsonb)
on conflict (service_code) do nothing;
