-- Ranking do App Treino — banco no Supabase.
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode rodar de novo sem erro (recria funções e regras; não apaga dados).
--
-- Modelo de segurança (RLS):
--  - ninguém sem login acessa nada (o app usa login anônimo do Supabase);
--  - cada pessoa está em no máximo 1 grupo e só enxerga o próprio grupo;
--  - cada pessoa só grava os próprios totais diários (tabela dias);
--  - entrar/criar/sair/remover só por funções (RPC) que validam tudo;
--  - a lista de grupos não é legível: o código de convite não pode ser enumerado.

-- ---------- Tabelas ----------

create table if not exists public.grupos (
  codigo text primary key check (codigo ~ '^[A-HJ-NP-Z2-9]{6}$'),
  nome text not null check (char_length(nome) between 1 and 40),
  criado_por uuid not null references auth.users on delete cascade,
  criado_em timestamptz not null default now()
);

create table if not exists public.membros (
  user_id uuid primary key references auth.users on delete cascade, -- 1 grupo por pessoa
  grupo text not null references public.grupos on delete cascade,
  apelido text not null check (char_length(apelido) between 1 and 20),
  emoji text not null default '💪' check (char_length(emoji) between 1 and 8),
  entrou_em timestamptz not null default now()
);
create index if not exists membros_grupo on public.membros (grupo);

create table if not exists public.dias (
  user_id uuid not null references auth.users on delete cascade,
  data date not null,
  treinos smallint not null check (treinos between 0 and 20),
  cardio_min integer not null check (cardio_min between 0 and 1440),
  km numeric(6,2) not null check (km between 0 and 300),
  pontos integer not null check (pontos between 0 and 22),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, data)
);
create index if not exists dias_data on public.dias (data);

alter table public.grupos enable row level security;
alter table public.membros enable row level security;
alter table public.dias enable row level security;

-- ---------- Privilégios (começa do zero e libera só o necessário) ----------

revoke all on public.grupos, public.membros, public.dias from public, anon, authenticated;
grant select on public.grupos to authenticated;
grant select on public.membros to authenticated;
grant update (apelido, emoji) on public.membros to authenticated;
grant select, insert, update on public.dias to authenticated;

-- ---------- Função auxiliar: grupo de quem chama ----------
-- security definer: lê membros sem passar pelo RLS (evita recursão nas regras).

create or replace function public.meu_grupo() returns text
language sql stable security definer set search_path = '' as $$
  select m.grupo from public.membros m where m.user_id = auth.uid()
$$;

-- ---------- Regras (RLS) ----------

drop policy if exists grupos_ver on public.grupos;
create policy grupos_ver on public.grupos for select to authenticated
  using (codigo = public.meu_grupo());

drop policy if exists membros_ver on public.membros;
create policy membros_ver on public.membros for select to authenticated
  using (grupo = public.meu_grupo());

drop policy if exists membros_editar on public.membros;
create policy membros_editar on public.membros for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists dias_ver on public.dias;
create policy dias_ver on public.dias for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.membros m
               where m.user_id = dias.user_id and m.grupo = public.meu_grupo())
  );

drop policy if exists dias_inserir on public.dias;
create policy dias_inserir on public.dias for insert to authenticated
  with check (user_id = auth.uid() and data between current_date - 60 and current_date + 1);

drop policy if exists dias_atualizar on public.dias;
create policy dias_atualizar on public.dias for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and data between current_date - 60 and current_date + 1);

-- ---------- RPCs ----------

-- Código de 6 caracteres sem ambíguos (sem I, O, 0, 1), com aleatoriedade criptográfica.
create or replace function public._gerar_codigo() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 símbolos: 256 % 32 = 0 (uniforme)
  bytes bytea;
  v_codigo text;
begin
  loop
    bytes := uuid_send(gen_random_uuid());
    v_codigo := '';
    for i in 0..5 loop
      v_codigo := v_codigo || substr(alfabeto, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.grupos g where g.codigo = v_codigo);
  end loop;
  return v_codigo;
end $$;

-- Normaliza e valida apelido/emoji (erros em português, mostrados no app).
create or replace function public._validar_perfil(p_apelido text, p_emoji text, out apelido text, out emoji text)
language plpgsql immutable security definer set search_path = '' as $$
begin
  apelido := btrim(coalesce(p_apelido, ''));
  emoji := btrim(coalesce(p_emoji, ''));
  if char_length(apelido) not between 1 and 20 then
    raise exception 'O apelido precisa ter de 1 a 20 caracteres.';
  end if;
  if char_length(emoji) not between 1 and 8 then
    emoji := '💪';
  end if;
end $$;

create or replace function public.criar_grupo(p_nome text, p_apelido text, p_emoji text)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_nome text := btrim(coalesce(p_nome, ''));
  v_perfil record;
  v_codigo text;
begin
  if v_uid is null then raise exception 'Sessão inválida. Abra o app de novo.'; end if;
  if char_length(v_nome) not between 1 and 40 then
    raise exception 'O nome do grupo precisa ter de 1 a 40 caracteres.';
  end if;
  select * into v_perfil from public._validar_perfil(p_apelido, p_emoji);
  if exists (select 1 from public.membros m where m.user_id = v_uid) then
    raise exception 'Você já está em um grupo. Saia dele antes de criar outro.';
  end if;
  v_codigo := public._gerar_codigo();
  insert into public.grupos (codigo, nome, criado_por) values (v_codigo, v_nome, v_uid);
  insert into public.membros (user_id, grupo, apelido, emoji)
    values (v_uid, v_codigo, v_perfil.apelido, v_perfil.emoji);
  return v_codigo;
end $$;

create or replace function public.entrar_grupo(p_codigo text, p_apelido text, p_emoji text)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  v_nome text;
  v_perfil record;
begin
  if v_uid is null then raise exception 'Sessão inválida. Abra o app de novo.'; end if;
  select * into v_perfil from public._validar_perfil(p_apelido, p_emoji);
  if exists (select 1 from public.membros m where m.user_id = v_uid) then
    raise exception 'Você já está em um grupo. Saia dele antes de entrar em outro.';
  end if;
  -- trava a linha do grupo: duas pessoas entrando ao mesmo tempo não furam o limite de 30
  select g.nome into v_nome from public.grupos g where g.codigo = v_codigo for update;
  if not found then raise exception 'Código não encontrado. Confira as letras.'; end if;
  if (select count(*) from public.membros m where m.grupo = v_codigo) >= 30 then
    raise exception 'Este grupo já tem 30 pessoas.';
  end if;
  insert into public.membros (user_id, grupo, apelido, emoji)
    values (v_uid, v_codigo, v_perfil.apelido, v_perfil.emoji);
  return v_nome;
end $$;

-- Sai do grupo. Se quem sai é a criadora, passa a coroa para quem entrou primeiro;
-- se não sobrar ninguém, o grupo é apagado. Os totais (dias) ficam, mas somem do ranking.
create or replace function public.sair_grupo()
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_grupo text;
  v_herdeira uuid;
begin
  if v_uid is null then raise exception 'Sessão inválida. Abra o app de novo.'; end if;
  select m.grupo into v_grupo from public.membros m where m.user_id = v_uid;
  if v_grupo is null then return; end if;
  perform 1 from public.grupos g where g.codigo = v_grupo for update;
  delete from public.membros m where m.user_id = v_uid;
  if exists (select 1 from public.grupos g where g.codigo = v_grupo and g.criado_por = v_uid) then
    select m.user_id into v_herdeira from public.membros m
      where m.grupo = v_grupo order by m.entrou_em, m.user_id limit 1;
    if v_herdeira is null then
      delete from public.grupos g where g.codigo = v_grupo;
    else
      update public.grupos g set criado_por = v_herdeira where g.codigo = v_grupo;
    end if;
  end if;
end $$;

-- Só a criadora do grupo remove alguém (ex.: conta "fantasma" de backup antigo).
create or replace function public.remover_membro(p_user uuid)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_grupo text;
begin
  if v_uid is null then raise exception 'Sessão inválida. Abra o app de novo.'; end if;
  select m.grupo into v_grupo from public.membros m where m.user_id = v_uid;
  if v_grupo is null or not exists (
    select 1 from public.grupos g where g.codigo = v_grupo and g.criado_por = v_uid
  ) then
    raise exception 'Só quem criou o grupo pode remover pessoas.';
  end if;
  if p_user = v_uid then raise exception 'Para sair, use "Sair do grupo".'; end if;
  delete from public.membros m where m.user_id = p_user and m.grupo = v_grupo;
  if not found then raise exception 'Essa pessoa não está no seu grupo.'; end if;
end $$;

-- ---------- Quem pode chamar as funções ----------

revoke all on function public.meu_grupo() from public, anon;
revoke all on function public._gerar_codigo() from public, anon, authenticated;
revoke all on function public._validar_perfil(text, text) from public, anon, authenticated;
revoke all on function public.criar_grupo(text, text, text) from public, anon;
revoke all on function public.entrar_grupo(text, text, text) from public, anon;
revoke all on function public.sair_grupo() from public, anon;
revoke all on function public.remover_membro(uuid) from public, anon;

grant execute on function public.meu_grupo() to authenticated; -- usada pelas regras RLS
grant execute on function public.criar_grupo(text, text, text) to authenticated;
grant execute on function public.entrar_grupo(text, text, text) to authenticated;
grant execute on function public.sair_grupo() to authenticated;
grant execute on function public.remover_membro(uuid) to authenticated;
