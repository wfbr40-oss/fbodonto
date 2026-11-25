-- Tabela de lotes esterilizados
create table if not exists public.lotes (
  codigo text primary key check (codigo ~ '^[0-9]{10}$'),
  item text not null,
  esterilizacao date not null,
  validade date not null check (validade >= esterilizacao),
  responsavel text not null,
  criado_em timestamptz not null default now()
);

-- Habilitar RLS (Row Level Security)
alter table public.lotes enable row level security;

-- Políticas de acesso para lotes (permitindo inserção e leitura públicas para facilitar o uso no consultório)
create policy "Permitir leitura de lotes"
  on public.lotes for select
  using (true);

create policy "Permitir inserção de lotes"
  on public.lotes for insert
  with check (true);

create policy "Permitir atualização de lotes"
  on public.lotes for update
  using (true);

-- Sem política de delete (proibido exclusão)

-- Configuração do Storage para a logo (bucket público 'config')
insert into storage.buckets (id, name, public) 
values ('config', 'config', true) 
on conflict (id) do nothing;

create policy "Permitir leitura pública de arquivos de config"
  on storage.objects for select
  using (bucket_id = 'config');

create policy "Permitir upload de config"
  on storage.objects for insert
  with check (bucket_id = 'config');
