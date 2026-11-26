-- Tabela de lotes esterilizados
create table if not exists public.lotes (
  codigo text primary key check (codigo ~ '^[0-9]{10}$'),
  item text not null default '',
  esterilizacao date not null,
  validade date not null check (validade >= esterilizacao),
  responsavel text not null,
  criado_em timestamptz not null default now()
);

-- Habilitar RLS (Row Level Security)
alter table public.lotes enable row level security;

-- Políticas de acesso para lotes
drop policy if exists "Permitir leitura de lotes" on public.lotes;
create policy "Permitir leitura de lotes"
  on public.lotes for select
  using (true);

drop policy if exists "Permitir inserção de lotes" on public.lotes;
create policy "Permitir inserção de lotes"
  on public.lotes for insert
  to authenticated
  with check (true);

drop policy if exists "Permitir atualização de lotes" on public.lotes;
create policy "Permitir atualização de lotes"
  on public.lotes for update
  to authenticated
  using (true);

-- Confirmar usuário admin@fbodonto.com.br (e usuários @fbodonto.com.br) caso a confirmação de e-mail esteja ativa no Auth
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email like '%@fbodonto.com.br'
  and email_confirmed_at is null;

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
