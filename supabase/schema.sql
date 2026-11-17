-- =========================================================================
-- ACAEMAT Táchira — esquema de base de datos para Supabase
-- PREPARADO, NO APLICADO. Se ejecuta una sola vez en el proyecto de Supabase
-- de la academia (SQL Editor › New query › pegar › Run) cuando haya "carta blanca".
--
-- Roles:  admin (administración) · instructor (docente) · student (estudiante)
-- Regla clave: los montos (precios, cuotas, pagos) SOLO los ven la administración
-- y el propio estudiante. El docente ve la solvencia con solvencia_alumno().
-- Los videos NO se guardan aquí: van en YouTube o Google Drive (solo el enlace).
-- =========================================================================

create extension if not exists pgcrypto;
create schema if not exists private;          -- no expuesto por la API
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------- tipos ----------
create type public.rol as enum ('admin', 'instructor', 'student');
create type public.metodo_tipo as enum ('pagomovil', 'transferencia', 'zelle', 'binance', 'efectivo');
create type public.pago_estado as enum ('pendiente', 'aprobado', 'rechazado');
create type public.leccion_tipo as enum ('video', 'pdf', 'text', 'link', 'quiz');
create type public.plataforma as enum ('meet', 'zoom', 'jitsi', 'youtube', 'otra');

-- ---------- perfiles (1 a 1 con auth.users) ----------
create table public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  rol         public.rol not null default 'student',
  nombre      text not null,
  cedula      text unique,
  telefono    text,
  correo      text not null,
  creado      timestamptz not null default now()
);

-- Al registrarse, se crea el perfil como estudiante (nunca como admin)
create or replace function private.nuevo_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre, correo, cedula, telefono)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
          new.email,
          nullif(new.raw_user_meta_data ->> 'cedula', ''),
          nullif(new.raw_user_meta_data ->> 'telefono', ''));
  return new;
end $$;
create trigger al_registrarse after insert on auth.users
  for each row execute function private.nuevo_usuario();

-- ---------- funciones de rol (usadas por las políticas) ----------
create or replace function private.mi_rol()
returns public.rol language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = (select auth.uid())
$$;
create or replace function private.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select private.mi_rol()) = 'admin', false)
$$;
create or replace function private.es_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select private.mi_rol()) in ('admin', 'instructor'), false)
$$;

-- ---------- programas ----------
create table public.cursos (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  titulo      text not null,
  categoria   text,
  horas       integer not null default 0 check (horas >= 0),
  modalidad   text,
  nivel       text,
  resumen     text,
  descripcion text,
  color       text,
  portada_url text,
  publicado   boolean not null default false,
  docente_id  uuid references public.perfiles (id) on delete set null,
  creado      timestamptz not null default now()
);
create index cursos_docente_idx on public.cursos (docente_id);

create table public.modulos (
  id        uuid primary key default gen_random_uuid(),
  curso_id  uuid not null references public.cursos (id) on delete cascade,
  titulo    text not null,
  orden     integer not null default 0
);
create index modulos_curso_idx on public.modulos (curso_id, orden);

create table public.lecciones (
  id         uuid primary key default gen_random_uuid(),
  modulo_id  uuid not null references public.modulos (id) on delete cascade,
  tipo       public.leccion_tipo not null,
  titulo     text not null,
  minutos    integer not null default 0,
  url        text,          -- YouTube / Drive / enlace externo
  archivo    text,          -- ruta en Storage (PDF), bucket "materiales"
  cuerpo     text,          -- texto o preguntas del examen (JSON)
  orden      integer not null default 0
);
create index lecciones_modulo_idx on public.lecciones (modulo_id, orden);

create or replace function private.dicta(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.es_admin())
      or exists (select 1 from public.cursos where id = c and docente_id = (select auth.uid()))
$$;

-- ---------- inscripciones y avance ----------
create table public.inscripciones (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid not null references public.perfiles (id) on delete cascade,
  curso_id    uuid not null references public.cursos (id) on delete cascade,
  fecha       timestamptz not null default now(),
  unique (alumno_id, curso_id)
);
create index inscripciones_curso_idx on public.inscripciones (curso_id);

create or replace function private.inscrito(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.inscripciones where curso_id = c and alumno_id = (select auth.uid()))
$$;

create table public.avance (
  alumno_id   uuid not null references public.perfiles (id) on delete cascade,
  leccion_id  uuid not null references public.lecciones (id) on delete cascade,
  completado  timestamptz not null default now(),
  nota        numeric(5,2),
  primary key (alumno_id, leccion_id)
);
create index avance_leccion_idx on public.avance (leccion_id);

-- ---------- clases en vivo ----------
create table public.clases_vivo (
  id          uuid primary key default gen_random_uuid(),
  curso_id    uuid not null references public.cursos (id) on delete cascade,
  titulo      text not null,
  inicio      timestamptz not null,
  minutos     integer not null default 90 check (minutos between 15 and 480),
  plataforma  public.plataforma not null default 'meet',
  url         text not null,
  grabacion   text,
  notas       text,
  creado_por  uuid references public.perfiles (id) on delete set null
);
create index clases_curso_inicio_idx on public.clases_vivo (curso_id, inicio);

-- ---------- certificados ----------
create table public.certificados (
  codigo      text primary key,                -- ACAEMAT-XXXXXX-XXXXXX
  alumno_id   uuid not null references public.perfiles (id) on delete cascade,
  curso_id    uuid not null references public.cursos (id) on delete restrict,
  emitido     timestamptz not null default now(),
  vence       date,
  unique (alumno_id, curso_id)
);
create index certificados_curso_idx on public.certificados (curso_id);

-- ---------- solicitudes de información (formulario público) ----------
create table public.solicitudes (
  id        uuid primary key default gen_random_uuid(),
  fecha     timestamptz not null default now(),
  nombre    text not null check (length(nombre) between 2 and 120),
  telefono  text check (length(telefono) <= 30),
  correo    text check (length(correo) <= 160),
  curso_id  uuid references public.cursos (id) on delete set null,
  mensaje   text check (length(mensaje) <= 1500),
  estado    text not null default 'nueva'
);
create index solicitudes_curso_idx on public.solicitudes (curso_id);

-- =========================================================================
-- PAGOS (solo administración y el propio estudiante)
-- Montos en USD; los pagos en bolívares guardan monto en Bs y la tasa usada.
-- =========================================================================
create table public.config_pagos (
  id               boolean primary key default true check (id),   -- una sola fila
  tasa_bs          numeric(14,4) not null default 0 check (tasa_bs >= 0),
  tasa_fecha       timestamptz not null default now(),
  dias_gracia      integer not null default 7 check (dias_gracia between 0 and 60),
  bloquear_eval    boolean not null default true,
  cert_solvente    boolean not null default true
);
insert into public.config_pagos default values;

create table public.metodos_pago (
  id       uuid primary key default gen_random_uuid(),
  tipo     public.metodo_tipo not null,
  nombre   text not null,
  datos    text not null,      -- banco, teléfono, cuenta, correo Zelle, ID Binance
  activo   boolean not null default true,
  orden    integer not null default 0
);

create table public.precios (
  curso_id     uuid primary key references public.cursos (id) on delete cascade,
  precio       numeric(10,2) not null check (precio >= 0),
  inscripcion  numeric(10,2) not null default 0 check (inscripcion >= 0),
  cuotas       integer not null default 1 check (cuotas between 1 and 12),
  check (inscripcion <= precio)
);

create table public.cargos (                      -- plan de pago de cada inscripción
  id              uuid primary key default gen_random_uuid(),
  inscripcion_id  uuid not null references public.inscripciones (id) on delete cascade,
  concepto        text not null,
  monto           numeric(10,2) not null check (monto > 0),
  vence           date not null
);
create index cargos_inscripcion_idx on public.cargos (inscripcion_id, vence);

create sequence public.recibo_seq;
create table public.pagos (
  id              uuid primary key default gen_random_uuid(),
  inscripcion_id  uuid not null references public.inscripciones (id) on delete cascade,
  alumno_id       uuid not null references public.perfiles (id) on delete cascade,
  metodo_id       uuid references public.metodos_pago (id) on delete set null,
  tipo            public.metodo_tipo not null,
  monto_usd       numeric(10,2) not null check (monto_usd > 0),
  monto_bs        numeric(14,2),
  tasa            numeric(14,4),
  referencia      text,
  fecha_pago      date not null,
  comprobante     text,                         -- ruta en Storage, bucket "comprobantes"
  nota            text,
  estado          public.pago_estado not null default 'pendiente',
  motivo          text,
  recibo          text unique,                  -- R-000001
  revisado_por    uuid references public.perfiles (id) on delete set null,
  revisado        timestamptz,
  creado          timestamptz not null default now()
);
create index pagos_inscripcion_idx on public.pagos (inscripcion_id);
create index pagos_alumno_idx on public.pagos (alumno_id);
create index pagos_pendientes_idx on public.pagos (creado) where estado = 'pendiente';
create index pagos_metodo_idx on public.pagos (metodo_id);
create index pagos_revisor_idx on public.pagos (revisado_por);

-- El estudiante solo puede reportar pagos "pendiente" de SUS inscripciones.
-- Al aprobar, se asigna el número de recibo automáticamente.
create or replace function private.pagos_guardia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.es_admin()) then
    if tg_op = 'UPDATE' then raise exception 'Solo la administración modifica pagos'; end if;
    if new.alumno_id <> (select auth.uid())
       or not exists (select 1 from public.inscripciones i where i.id = new.inscripcion_id and i.alumno_id = new.alumno_id) then
      raise exception 'Inscripción no válida';
    end if;
    new.estado := 'pendiente'; new.recibo := null; new.revisado_por := null; new.revisado := null; new.motivo := null;
  end if;
  if new.estado = 'aprobado' and new.recibo is null then
    new.recibo := 'R-' || lpad(nextval('public.recibo_seq')::text, 6, '0');
    new.revisado := coalesce(new.revisado, now());
    new.revisado_por := coalesce(new.revisado_por, (select auth.uid()));
  end if;
  return new;
end $$;
create trigger pagos_guardia before insert or update on public.pagos
  for each row execute function private.pagos_guardia();

-- Plan de pago automático al inscribir (según el precio vigente del programa)
create or replace function private.crear_plan()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.precios; resto numeric; cada numeric; k int; desfase int := 0;
begin
  select * into p from public.precios where curso_id = new.curso_id;
  if not found or p.precio = 0 then return new; end if;
  if p.inscripcion > 0 then
    insert into public.cargos (inscripcion_id, concepto, monto, vence) values (new.id, 'Inscripción', p.inscripcion, new.fecha::date);
    desfase := 1;
  end if;
  resto := p.precio - p.inscripcion;
  if resto <= 0 then return new; end if;
  cada := floor(resto / p.cuotas * 100) / 100;
  for k in 1..p.cuotas loop
    insert into public.cargos (inscripcion_id, concepto, monto, vence) values (
      new.id,
      case when p.cuotas = 1 then 'Pago único' else 'Cuota ' || k || ' de ' || p.cuotas end,
      case when k = p.cuotas then resto - cada * (p.cuotas - 1) else cada end,
      (new.fecha + make_interval(days => 30 * (k - 1 + desfase)))::date);
  end loop;
  return new;
end $$;
create trigger al_inscribir after insert on public.inscripciones
  for each row execute function private.crear_plan();

-- Estado de cuenta por inscripción (cobra primero las cuotas más antiguas)
create or replace function private.estado_inscripcion(i uuid)
returns text language sql stable security definer set search_path = '' as $$
  with cfg as (select dias_gracia from public.config_pagos),
  pagado as (select coalesce(sum(monto_usd), 0) v from public.pagos where inscripcion_id = i and estado = 'aprobado'),
  c as (
    select vence, monto, sum(monto) over (order by vence, id) acumulado
    from public.cargos where inscripcion_id = i
  ),
  deuda as (
    select min(c.vence) primera_vencida
    from c, pagado where c.acumulado > pagado.v and c.vence < current_date
  )
  select case
    when not exists (select 1 from c) then 'sinplan'
    when (select v from pagado) >= (select coalesce(sum(monto), 0) from c) then 'solvente'
    when (select primera_vencida from deuda) is null then 'aldia'
    when current_date - (select primera_vencida from deuda) > (select dias_gracia from cfg) then 'moroso'
    else 'vencido'
  end
$$;

-- Lo que ve el DOCENTE: solo el estado, sin montos, y solo de sus programas
create or replace function public.solvencia_alumno(p_alumno uuid, p_curso uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare ins uuid;
begin
  if not ((select private.dicta(p_curso)) or p_alumno = (select auth.uid())) then
    raise exception 'Sin permiso';
  end if;
  select id into ins from public.inscripciones where alumno_id = p_alumno and curso_id = p_curso;
  if ins is null then return 'sinplan'; end if;
  return private.estado_inscripcion(ins);
end $$;
revoke execute on function public.solvencia_alumno(uuid, uuid) from public, anon;
grant execute on function public.solvencia_alumno(uuid, uuid) to authenticated;

-- =========================================================================
-- SEGURIDAD (RLS): todo cerrado salvo lo que se permite abajo
-- =========================================================================
alter table public.perfiles      enable row level security;
alter table public.cursos        enable row level security;
alter table public.modulos       enable row level security;
alter table public.lecciones     enable row level security;
alter table public.inscripciones enable row level security;
alter table public.avance        enable row level security;
alter table public.clases_vivo   enable row level security;
alter table public.certificados  enable row level security;
alter table public.solicitudes   enable row level security;
alter table public.config_pagos  enable row level security;
alter table public.metodos_pago  enable row level security;
alter table public.precios       enable row level security;
alter table public.cargos        enable row level security;
alter table public.pagos         enable row level security;

-- perfiles
create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select private.es_staff()));
create policy perfiles_editar_propio on public.perfiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and rol = (select private.mi_rol()));   -- no puede subirse de rol
create policy perfiles_admin on public.perfiles for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

-- cursos, módulos, lecciones: catálogo público; edita admin o el docente del curso
create policy cursos_ver_publico on public.cursos for select to anon using (publicado);
create policy cursos_ver on public.cursos for select to authenticated
  using (publicado or (select private.es_staff()));
create policy cursos_admin on public.cursos for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
create policy cursos_docente on public.cursos for update to authenticated
  using (docente_id = (select auth.uid())) with check (docente_id = (select auth.uid()));

create policy modulos_ver_publico on public.modulos for select to anon
  using (exists (select 1 from public.cursos c where c.id = curso_id and c.publicado));
create policy modulos_ver on public.modulos for select to authenticated
  using (exists (select 1 from public.cursos c where c.id = curso_id and (c.publicado or (select private.es_staff()))));
create policy modulos_editar on public.modulos for all to authenticated
  using ((select private.dicta(curso_id))) with check ((select private.dicta(curso_id)));

-- El contenido de las lecciones lo ven los inscritos y el personal (el título del temario es público vía módulos)
create policy lecciones_ver on public.lecciones for select to authenticated
  using (exists (select 1 from public.modulos m where m.id = modulo_id
                 and ((select private.inscrito(m.curso_id)) or (select private.es_staff()))));
create policy lecciones_editar on public.lecciones for all to authenticated
  using (exists (select 1 from public.modulos m where m.id = modulo_id and (select private.dicta(m.curso_id))))
  with check (exists (select 1 from public.modulos m where m.id = modulo_id and (select private.dicta(m.curso_id))));

-- inscripciones: solo administración inscribe; el alumno ve las suyas; el docente las de sus cursos
create policy inscripciones_ver on public.inscripciones for select to authenticated
  using (alumno_id = (select auth.uid()) or (select private.dicta(curso_id)));
create policy inscripciones_admin on public.inscripciones for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

-- avance: el alumno marca el suyo; el docente lo ve
create policy avance_propio on public.avance for all to authenticated
  using (alumno_id = (select auth.uid())) with check (alumno_id = (select auth.uid()));
create policy avance_staff on public.avance for select to authenticated
  using ((select private.es_staff()));

-- clases en vivo
create policy clases_ver on public.clases_vivo for select to authenticated
  using ((select private.inscrito(curso_id)) or (select private.es_staff()));
create policy clases_editar on public.clases_vivo for all to authenticated
  using ((select private.dicta(curso_id))) with check ((select private.dicta(curso_id)));

-- certificados: la verificación pública se hace con verificar_certificado()
create policy cert_ver on public.certificados for select to authenticated
  using (alumno_id = (select auth.uid()) or (select private.es_staff()));
create policy cert_admin on public.certificados for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

create or replace function public.verificar_certificado(p_codigo text)
returns table (alumno text, cedula text, programa text, horas integer, emitido timestamptz, vence date)
language sql stable security definer set search_path = '' as $$
  select p.nombre, p.cedula, c.titulo, c.horas, k.emitido, k.vence
  from public.certificados k
  join public.perfiles p on p.id = k.alumno_id
  join public.cursos c on c.id = k.curso_id
  where k.codigo = upper(trim(p_codigo))
$$;
grant execute on function public.verificar_certificado(text) to anon, authenticated;

-- solicitudes: cualquiera envía; solo el personal lee
create policy solicitudes_enviar on public.solicitudes for insert to anon, authenticated with check (estado = 'nueva');
create policy solicitudes_staff on public.solicitudes for all to authenticated
  using ((select private.es_staff())) with check ((select private.es_staff()));

-- pagos: configuración y métodos (el alumno ve tasa y métodos activos para pagar)
create policy config_ver on public.config_pagos for select to authenticated using (true);
create policy config_admin on public.config_pagos for update to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
create policy metodos_ver on public.metodos_pago for select to authenticated
  using (activo or (select private.es_admin()));
create policy metodos_admin on public.metodos_pago for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

-- precios: catálogo público (para mostrar el precio en la web) y solo admin edita
create policy precios_ver on public.precios for select to anon, authenticated using (true);
create policy precios_admin on public.precios for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

-- cargos: admin y el propio alumno (el docente NO)
create policy cargos_ver on public.cargos for select to authenticated
  using ((select private.es_admin())
         or exists (select 1 from public.inscripciones i where i.id = inscripcion_id and i.alumno_id = (select auth.uid())));
create policy cargos_admin on public.cargos for all to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));

-- pagos: admin todo; el alumno ve los suyos y reporta nuevos (el trigger fuerza "pendiente")
create policy pagos_ver on public.pagos for select to authenticated
  using (alumno_id = (select auth.uid()) or (select private.es_admin()));
create policy pagos_reportar on public.pagos for insert to authenticated
  with check (alumno_id = (select auth.uid()) or (select private.es_admin()));
create policy pagos_admin on public.pagos for update to authenticated
  using ((select private.es_admin())) with check ((select private.es_admin()));
create policy pagos_borrar on public.pagos for delete to authenticated
  using ((select private.es_admin()));

-- funciones privadas: solo usables dentro de políticas por usuarios autenticados
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- =========================================================================
-- ALMACENAMIENTO (Storage): materiales PDF y comprobantes de pago
-- Los comprobantes van en carpetas por alumno: comprobantes/<uid>/archivo.jpg
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('materiales', 'materiales', false, 20971520, array['application/pdf']),
  ('comprobantes', 'comprobantes', false, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy materiales_leer on storage.objects for select to authenticated
  using (bucket_id = 'materiales');
create policy materiales_staff on storage.objects for all to authenticated
  using (bucket_id = 'materiales' and (select private.es_staff()))
  with check (bucket_id = 'materiales' and (select private.es_staff()));

create policy comprobantes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy comprobantes_ver on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.es_admin())));
create policy comprobantes_admin on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes' and (select private.es_admin()));

-- =========================================================================
-- DESPUÉS DE EJECUTAR: crear el usuario de la dirección en Authentication
-- y convertirlo en administrador (cambie el correo):
--   update public.perfiles set rol = 'admin' where correo = 'direccion@acaemat.com';
-- =========================================================================
