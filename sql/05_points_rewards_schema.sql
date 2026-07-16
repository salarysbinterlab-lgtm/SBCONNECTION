-- 05_points_rewards_schema.sql
create table if not exists point_transactions (
  tx_id text primary key,
  emp_id text not null references app_users(emp_id) on delete cascade,
  tx_type point_tx_type not null,
  amount integer not null,
  description text,
  balance_after integer not null default 0,
  source_type text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists rewards (
  reward_id text primary key,
  name text not null,
  points_required integer not null default 0 check (points_required >= 0),
  stock integer not null default 0 check (stock >= 0),
  detail text,
  image_url text,
  status content_status not null default 'active',
  created_by_emp_id text references app_users(emp_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reward_redemptions (
  redemption_id text primary key,
  emp_id text not null references app_users(emp_id) on delete cascade,
  reward_id text references rewards(reward_id) on delete set null,
  reward_name text,
  points_spent integer not null default 0,
  status text not null default 'Pending',
  redeemed_at timestamptz not null default now(),
  approved_by_emp_id text references app_users(emp_id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists overall_logs (
  log_id text primary key,
  employee_id text references app_users(emp_id) on delete set null,
  source_type text,
  source_id text,
  point_before integer,
  points_change integer,
  point_after integer,
  activity_date date,
  activity_time time,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists checkin_logs (
  log_id text primary key,
  emp_id text not null references app_users(emp_id) on delete cascade,
  checkin_date date not null,
  checkin_time time,
  points_earned integer not null default 1,
  status text not null default 'Success',
  created_at timestamptz not null default now(),
  unique(emp_id, checkin_date)
);
