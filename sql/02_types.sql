-- 02_types.sql
do $$ begin
  create type app_role as enum ('user','manager','admin','admin_it','dev','exec');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('active','inactive','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type presence_status as enum ('online','offline','away');
exception when duplicate_object then null; end $$;

do $$ begin
  create type point_tx_type as enum ('earn','spend','adjust','refund');
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_status as enum ('active','inactive','draft','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum ('system','point_earn','checkin','redeem','mission','news','chat','it_request','it_status','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending','approved','rejected','closed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_status as enum ('sent','read','unsent','deleted');
exception when duplicate_object then null; end $$;
