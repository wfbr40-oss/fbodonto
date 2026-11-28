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

-- Tabela de configurações do consultório, etiqueta, validade e regra de numeração
create table if not exists public.configuracoes (
  id text primary key default 'default',
  nome_consultorio text not null default 'FB Odonto',
  largura_mm integer not null default 60 check (largura_mm between 20 and 150),
  altura_mm integer not null default 25 check (altura_mm between 15 and 100),
  modo text not null default 'avulsa' check (modo in ('avulsa', 'a4')),
  dias_validade integer not null default 30 check (dias_validade between 1 and 365),
  regra_numeracao text not null default 'turno_manha_tarde' check (regra_numeracao in ('turno_manha_tarde', 'sequencial')),
  hora_corte_tarde integer not null default 12 check (hora_corte_tarde between 0 and 23),
  atualizado_em timestamptz not null default now()
);

-- Habilitar RLS para configurações
alter table public.configuracoes enable row level security;

drop policy if exists "Permitir leitura de configuracoes" on public.configuracoes;
create policy "Permitir leitura de configuracoes"
  on public.configuracoes for select
  using (true);

drop policy if exists "Permitir insercao de configuracoes" on public.configuracoes;
create policy "Permitir insercao de configuracoes"
  on public.configuracoes for insert
  with check (true);

drop policy if exists "Permitir atualizacao de configuracoes" on public.configuracoes;
create policy "Permitir atualizacao de configuracoes"
  on public.configuracoes for update
  using (true);

insert into public.configuracoes (id)
values ('default')
on conflict (id) do nothing;

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

-- Tabela de sessões persistentes (login contínuo entre acessos)
create table if not exists public.sessoes (
  token_hash text primary key,
  usuario text not null,
  nome text not null,
  role text not null default 'operador' check (role in ('admin', 'operador')),
  expira_em timestamptz not null,
  criado_em timestamptz not null default now()
);

alter table public.sessoes enable row level security;

drop policy if exists "Permitir leitura de sessoes" on public.sessoes;
create policy "Permitir leitura de sessoes"
  on public.sessoes for select
  using (true);

drop policy if exists "Permitir insercao de sessoes" on public.sessoes;
create policy "Permitir insercao de sessoes"
  on public.sessoes for insert
  with check (true);

drop policy if exists "Permitir atualizacao de sessoes" on public.sessoes;
create policy "Permitir atualizacao de sessoes"
  on public.sessoes for update
  using (true);

drop policy if exists "Permitir exclusao de sessoes" on public.sessoes;
create policy "Permitir exclusao de sessoes"
  on public.sessoes for delete
  using (true);
