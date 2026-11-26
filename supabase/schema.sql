-- Tabela de lotes esterilizados
create table if not exists public.lotes (
  codigo text primary key check (codigo ~ '^[0-9]{10}$'),
  item text not null default '',
  esterilizacao date not null,
  validade date not null check (validade >= esterilizacao),
  responsavel text not null,
  criado_em timestamptz not null default now()
);

-- Habilitar RLS (Row Level Security) para lotes
alter table public.lotes enable row level security;

drop policy if exists "Permitir leitura de lotes" on public.lotes;
create policy "Permitir leitura de lotes"
  on public.lotes for select
  using (true);

drop policy if exists "Permitir inserção de lotes" on public.lotes;
create policy "Permitir inserção de lotes"
  on public.lotes for insert
  with check (true);

drop policy if exists "Permitir atualização de lotes" on public.lotes;
create policy "Permitir atualização de lotes"
  on public.lotes for update
  using (true);

-- Tabela de usuários do sistema (login por usuário e senha sem e-mail)
create table if not exists public.usuarios (
  usuario text primary key check (char_length(usuario) >= 2),
  nome text not null,
  role text not null default 'operador' check (role in ('admin', 'operador')),
  salt text not null,
  hash text not null,
  criado_em timestamptz not null default now()
);

-- Habilitar RLS para usuários
alter table public.usuarios enable row level security;

drop policy if exists "Permitir leitura de usuarios" on public.usuarios;
create policy "Permitir leitura de usuarios"
  on public.usuarios for select
  using (true);

drop policy if exists "Permitir insercao de usuarios" on public.usuarios;
create policy "Permitir insercao de usuarios"
  on public.usuarios for insert
  with check (true);

drop policy if exists "Permitir atualizacao de usuarios" on public.usuarios;
create policy "Permitir atualizacao de usuarios"
  on public.usuarios for update
  using (true);

-- Configuração do Storage para a logo (bucket público 'config')
insert into storage.buckets (id, name, public)
values ('config', 'config', true)
on conflict (id) do nothing;

drop policy if exists "Permitir leitura pública de arquivos de config" on storage.objects;
create policy "Permitir leitura pública de arquivos de config"
  on storage.objects for select
  using (bucket_id = 'config');

drop policy if exists "Permitir upload de config" on storage.objects;
create policy "Permitir upload de config"
  on storage.objects for insert
  with check (bucket_id = 'config');
