-- GRUPO ALUMNOS: repositorio del grupo (Agente de Documentación).
-- Cada grupo sube sus entregas por hito del cuatrimestre (tabla eventos del core), como archivos con
-- versiones: nunca se pisa una versión, se sube una nueva. Profesores y mentores dejan devoluciones
-- sobre cada versión. Lo ven el grupo, sus mentores y los profesores; los otros grupos no.
-- Mentor de un grupo = quien tiene o tuvo una reunión con ese proyecto (tabla mentores_reuniones,
-- del grupo Mentores: solo se lee, no se modifica).

-- ¿La persona logueada es integrante del proyecto? ¿Es su mentor? -------------------------------
create function public.alumnos_yo() returns uuid
language sql stable security invoker set search_path = public as $$
  select id from personas where lower(email) = lower(auth.jwt() ->> 'email')
$$;

-- Reciben el id como texto: así también sirven para la carpeta de un archivo, sin romper si no es un id.
create function public.alumnos_soy_integrante(p_proyecto text) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (select 1 from proyecto_integrantes where proyecto_id::text = p_proyecto and persona_id = alumnos_yo())
$$;

create function public.alumnos_soy_mentor(p_proyecto text) returns boolean
language sql stable security invoker set search_path = public as $$
  select mi_rol() = 'mentor'
    and exists (select 1 from mentores_reuniones where proyecto_id::text = p_proyecto and mentor_id = alumnos_yo())
$$;

revoke execute on function public.alumnos_yo(), public.alumnos_soy_integrante(text), public.alumnos_soy_mentor(text)
  from public, anon;
grant execute on function public.alumnos_yo(), public.alumnos_soy_integrante(text), public.alumnos_soy_mentor(text)
  to authenticated;

-- Entregas (una fila por versión) ---------------------------------------------------------------
create table alumnos_entregas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  evento_id uuid not null references eventos(id) on delete cascade,
  version integer not null check (version >= 1),
  archivo_path text not null unique,
  nombre_archivo text not null check (char_length(nombre_archivo) between 1 and 200),
  tamano_bytes bigint not null check (tamano_bytes > 0),
  nota text check (char_length(nota) <= 500),
  subida_por uuid references personas(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (proyecto_id, evento_id, version)
);

alter table alumnos_entregas enable row level security;

create policy "admin todo" on alumnos_entregas for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "grupo ve lo suyo" on alumnos_entregas for select to authenticated
  using (mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text));
create policy "mentor ve sus grupos" on alumnos_entregas for select to authenticated
  using (alumnos_soy_mentor(proyecto_id::text));
-- Cualquier integrante sube una versión nueva, a su nombre. No se editan ni borran (queda el historial).
create policy "grupo sube a su nombre" on alumnos_entregas for insert to authenticated
  with check (mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text) and subida_por = alumnos_yo());

-- Devoluciones sobre una versión ------------------------------------------------------------------
create table alumnos_entregas_devoluciones (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references alumnos_entregas(id) on delete cascade,
  autor_id uuid references personas(id) on delete set null,
  texto text not null check (char_length(btrim(texto)) between 2 and 2000),
  created_at timestamptz not null default now()
);

create index alumnos_entregas_devoluciones_entrega on alumnos_entregas_devoluciones (entrega_id, created_at);

alter table alumnos_entregas_devoluciones enable row level security;

create policy "admin todo" on alumnos_entregas_devoluciones for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "grupo lee las suyas" on alumnos_entregas_devoluciones for select to authenticated
  using (mi_rol() = 'alumno' and exists (
    select 1 from alumnos_entregas e where e.id = entrega_id and alumnos_soy_integrante(e.proyecto_id::text)));
create policy "mentor lee en sus grupos" on alumnos_entregas_devoluciones for select to authenticated
  using (exists (select 1 from alumnos_entregas e where e.id = entrega_id and alumnos_soy_mentor(e.proyecto_id::text)));
create policy "mentor escribe a su nombre en sus grupos" on alumnos_entregas_devoluciones for insert to authenticated
  with check (
    autor_id = alumnos_yo()
    and exists (select 1 from alumnos_entregas e where e.id = entrega_id and alumnos_soy_mentor(e.proyecto_id::text))
  );

-- Archivos: bucket privado propio del grupo Alumnos ---------------------------------------------
-- Ruta de cada archivo: <proyecto_id>/<evento_id>/v<version>-<nombre>. Las políticas son solo para este bucket.
insert into storage.buckets (id, name, public, file_size_limit)
values ('alumnos-entregas', 'alumnos-entregas', false, 52428800) -- 50 MB por archivo
on conflict (id) do nothing;

create policy "alumnos-entregas: admin todo" on storage.objects for all to authenticated
  using (bucket_id = 'alumnos-entregas' and mi_rol() = 'admin')
  with check (bucket_id = 'alumnos-entregas' and mi_rol() = 'admin');
create policy "alumnos-entregas: grupo y mentores leen" on storage.objects for select to authenticated
  using (
    bucket_id = 'alumnos-entregas'
    and (
      (mi_rol() = 'alumno' and alumnos_soy_integrante((storage.foldername(name))[1]))
      or alumnos_soy_mentor((storage.foldername(name))[1])
    )
  );
create policy "alumnos-entregas: grupo sube" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'alumnos-entregas'
    and mi_rol() = 'alumno'
    and alumnos_soy_integrante((storage.foldername(name))[1])
  );
