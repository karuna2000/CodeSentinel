-- Graph Nodes
create type public.graph_node_type as enum (
  'REPO', 'FOLDER', 'FILE', 'FUNCTION', 'CLASS', 'INTERFACE', 'TYPE', 'ROUTE', 'COMPONENT', 'VARIABLE'
);

create table public.graph_nodes (
  id uuid default gen_random_uuid() primary key,
  repo_id uuid not null references public.repositories(id) on delete cascade,
  file_id uuid references public.files(id) on delete cascade,
  type public.graph_node_type not null,
  name text not null,
  code_snippet text,
  start_line integer,
  end_line integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.graph_nodes enable row level security;

create policy "Allow all on graph_nodes for service role"
  on public.graph_nodes for all
  using ( true )
  with check ( true );

-- Graph Edges
create type public.graph_edge_type as enum (
  'CONTAINS', 'IMPORTS', 'CALLS', 'INHERITS', 'READS_STORE', 'FETCHES_ROUTE'
);

create table public.graph_edges (
  id uuid default gen_random_uuid() primary key,
  repo_id uuid not null references public.repositories(id) on delete cascade,
  source_node_id uuid not null references public.graph_nodes(id) on delete cascade,
  target_node_id uuid not null references public.graph_nodes(id) on delete cascade,
  type public.graph_edge_type not null,
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.graph_edges enable row level security;

create policy "Allow all on graph_edges for service role"
  on public.graph_edges for all
  using ( true )
  with check ( true );

-- Add indexes for graph traversal performance
create index idx_graph_nodes_repo_id on public.graph_nodes(repo_id);
create index idx_graph_nodes_file_id on public.graph_nodes(file_id);
create index idx_graph_edges_source_node_id on public.graph_edges(source_node_id);
create index idx_graph_edges_target_node_id on public.graph_edges(target_node_id);
create index idx_graph_edges_repo_id on public.graph_edges(repo_id);

-- Grant permissions
grant all on table public.graph_nodes to postgres, anon, authenticated, service_role;
grant all on table public.graph_edges to postgres, anon, authenticated, service_role;
