-- Create a table for public profiles tied to Supabase Auth
create table public.users (
  id uuid not null references auth.users on delete cascade,
  email text,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  primary key (id)
);

-- Enable RLS
alter table public.users enable row level security;

-- Create policies
create policy "Public profiles are viewable by everyone."
  on public.users for select
  using ( true );

create policy "Users can insert their own profile."
  on public.users for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on public.users for update
  using ( auth.uid() = id );

-- Create a trigger to automatically create a profile for new users
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- GitHub App Installations
create table public.github_installations (
  id uuid default gen_random_uuid() primary key,
  installation_id bigint not null unique,
  user_id text not null,
  account_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.github_installations enable row level security;

create policy "Allow all on github_installations for service role"
  on public.github_installations for all
  using ( true )
  with check ( true );

-- Repositories
create table public.repositories (
  id uuid default gen_random_uuid() primary key,
  github_repo_id bigint not null unique,
  name text not null,
  owner text not null,
  default_branch text default 'main' not null,
  language text,
  description text,
  stars integer default 0,
  is_indexed boolean default false,
  file_count integer default 0,
  readme_content text,
  user_id text not null,
  last_synced timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.repositories enable row level security;

create policy "Allow all on repositories for service role"
  on public.repositories for all
  using ( true )
  with check ( true );

-- Files
create table public.files (
  id uuid default gen_random_uuid() primary key,
  repo_id uuid not null references public.repositories(id) on delete cascade,
  path text not null,
  content_hash text,
  size bigint,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(repo_id, path)
);

alter table public.files enable row level security;

create policy "Allow all on files for service role"
  on public.files for all
  using ( true )
  with check ( true );

-- Grant permissions to Supabase roles
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;


