begin;

drop table if exists scan_logs cascade;
drop table if exists mpesa_intents cascade;
drop table if exists tickets cascade;
drop table if exists contact_inquiries cascade;
drop table if exists site_content cascade;

create extension if not exists "pgcrypto";

create table tickets (
  id uuid primary key,
  event_id text not null,
  holder_name text not null,
  holder_email text not null,
  payment_status text not null default 'free',
  payment_reference text,
  token_hash text not null,
  status text not null default 'issued',
  checked_in boolean not null default false,
  issued_at timestamptz not null default now(),
  checked_in_at timestamptz,
  source text
);

create index idx_tickets_event_id on tickets(event_id);
create index idx_tickets_checked_in on tickets(checked_in);
create unique index idx_tickets_token_hash on tickets(token_hash);

create table scan_logs (
  id uuid primary key,
  ticket_id uuid,
  event_id text not null,
  scanned_at timestamptz not null default now(),
  scanner_ip text,
  outcome text not null
);

create index idx_scan_logs_event_id on scan_logs(event_id);
create index idx_scan_logs_ticket_id on scan_logs(ticket_id);

create table mpesa_intents (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  checkout_request_id text unique,
  merchant_request_id text,
  holder_name text not null,
  holder_email text not null,
  phone_number text not null,
  tier_name text not null,
  unit_price_ksh integer not null,
  quantity integer not null default 1,
  total_amount_ksh integer not null,
  status text not null default 'initiated',
  result_code text,
  result_desc text,
  mpesa_receipt text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_mpesa_intents_event_id on mpesa_intents(event_id);
create index idx_mpesa_intents_status on mpesa_intents(status);

create table contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  organization text,
  event_date date,
  location text,
  message text not null,
  status text not null default 'new',
  source text,
  created_at timestamptz not null default now()
);

create index idx_contact_inquiries_created_at on contact_inquiries(created_at desc);
create index idx_contact_inquiries_status on contact_inquiries(status);

create table site_content (
  path text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

commit;
