-- 04_content_schema.sql
create table if not exists missions (
  mission_id text primary key,
  title text not null,
  description text,
  points integer not null default 0 check (points >= 0),
  image_url text,
  status content_status not null default 'active',
  tasks_json jsonb not null default '[]'::jsonb,
  limit_per_user integer,
  created_by_emp_id text references app_users(emp_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_missions (
  id bigserial primary key,
  emp_id text not null references app_users(emp_id) on delete cascade,
  mission_id text not null references missions(mission_id) on delete cascade,
  completed_at timestamptz,
  status text not null default 'Completed',
  is_synced boolean not null default true,
  evidence_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(emp_id, mission_id)
);

create table if not exists news_posts (
  news_id text primary key,
  topic text not null,
  detail text,
  news_type text,
  publish_date date,
  pinned boolean not null default false,
  image_url text,
  points integer not null default 0 check (points >= 0),
  status content_status not null default 'active',
  created_by_emp_id text references app_users(emp_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_news_reads (
  id bigserial primary key,
  emp_id text not null references app_users(emp_id) on delete cascade,
  news_id text references news_posts(news_id) on delete set null,
  topic text,
  read_at timestamptz not null default now(),
  points integer not null default 0,
  unique(emp_id, news_id)
);

create table if not exists referrals (
  id bigserial primary key,
  referrer_emp_id text references app_users(emp_id) on delete cascade,
  referee_emp_id text references app_users(emp_id) on delete cascade,
  referral_date timestamptz,
  status text,
  created_at timestamptz not null default now(),
  unique(referrer_emp_id, referee_emp_id)
);
