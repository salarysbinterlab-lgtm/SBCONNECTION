-- 06_chat_notifications_schema.sql
create table if not exists notifications (
  notification_id text primary key,
  emp_id text references app_users(emp_id) on delete cascade, -- null or ALL = broadcast via notification_targets
  title text not null,
  message text,
  type notification_type not null default 'system',
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists notification_targets (
  id bigserial primary key,
  notification_id text not null references notifications(notification_id) on delete cascade,
  emp_id text not null references app_users(emp_id) on delete cascade,
  is_read boolean not null default false,
  read_at timestamptz,
  unique(notification_id, emp_id)
);

create table if not exists chat_faq (
  keyword text primary key,
  response text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists direct_messages (
  msg_id text primary key,
  sender_emp_id text references app_users(emp_id) on delete set null,
  receiver_emp_id text references app_users(emp_id) on delete set null,
  content text,
  reply_to_id text references direct_messages(msg_id) on delete set null,
  sent_at timestamptz not null default now(),
  status message_status not null default 'sent',
  reply_to_content text,
  room_key text generated always as (
    case
      when sender_emp_id is null or receiver_emp_id is null then null
      when sender_emp_id < receiver_emp_id then sender_emp_id || '_' || receiver_emp_id
      else receiver_emp_id || '_' || sender_emp_id
    end
  ) stored,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists ai_chat_logs (
  id bigserial primary key,
  emp_id text references app_users(emp_id) on delete set null,
  question text,
  answer text,
  created_at timestamptz not null default now()
);
