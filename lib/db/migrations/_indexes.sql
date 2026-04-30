-- ----------------------------------------------------------------------------
-- Extensions and specialised indexes that Drizzle's schema DSL can't express.
-- Run AFTER the Drizzle table migrations.
-- Idempotent.
-- ----------------------------------------------------------------------------

create extension if not exists pg_trgm;

-- Trigram indexes for fast fuzzy search on members.
-- "rohit" → matches "Rohit Sharma", "Rohitash"; "9876" → matches "+919876543210".
create index if not exists members_name_trgm
  on public.members using gin (name gin_trgm_ops);

create index if not exists members_phone_trgm
  on public.members using gin (phone gin_trgm_ops);
