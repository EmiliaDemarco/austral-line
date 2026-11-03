-- GRUPO ALUMNOS: análisis de competencia con IA (Agente de Competencia y Originalidad).
-- El grupo completa un breve de su proyecto (problema, solución, a quién apunta y mercado). Con eso, la IA busca
-- en internet competidores actuales y arma un análisis: competidores con su fuente, diferenciales, alertas y
-- preguntas que desafíen la propuesta. Nunca dice que una idea es "original" de forma absoluta.
-- Lo ven el grupo, su mentor asignado y los profesores. Cada grupo puede pedir hasta 3 análisis por día
-- (hora de Argentina); se guardan todos, como historial.

-- Breve del proyecto (una fila por proyecto; la edita cualquier integrante) ----------------------
create table alumnos_competencia_breve (
  proyecto_id uuid primary key references proyectos(id) on delete cascade,
  problema text not null check (char_length(btrim(problema)) between 10 and 1500),
  solucion text not null check (char_length(btrim(solucion)) between 10 and 1500),
  publico text not null check (char_length(btrim(publico)) between 3 and 500),
  mercado text not null check (char_length(btrim(mercado)) between 2 and 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references personas(id) on delete set null
);

alter table alumnos_competencia_breve enable row level security;
create policy "admin todo" on alumnos_competencia_breve for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "grupo y mentor leen" on alumnos_competencia_breve for select to authenticated
  using ((mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text)) or alumnos_soy_mentor(proyecto_id::text));
create policy "grupo carga" on alumnos_competencia_breve for insert to authenticated
  with check (mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text) and updated_by = mi_persona_id());
create policy "grupo actualiza" on alumnos_competencia_breve for update to authenticated
  using (mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text))
  with check (mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text) and updated_by = mi_persona_id());

-- Análisis hechos (historial; no se editan ni se borran) -----------------------------------------
create table alumnos_competencia_analisis (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  breve jsonb not null,      -- copia del breve con el que se hizo
  resultado jsonb not null,  -- competidores, diferenciales, alertas, preguntas
  modelo text not null,
  pedido_por uuid references personas(id) on delete set null,
  created_at timestamptz not null default now()
);
create index alumnos_competencia_analisis_proyecto on alumnos_competencia_analisis (proyecto_id, created_at desc);

-- Cuántos análisis hizo hoy el grupo (día de Argentina). Security definer para contar sin depender de
-- quién mira; solo devuelve un número.
create function public.alumnos_analisis_hoy(p_proyecto uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from alumnos_competencia_analisis
  where proyecto_id = p_proyecto
    and created_at >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
$$;

alter table alumnos_competencia_analisis enable row level security;
create policy "admin todo" on alumnos_competencia_analisis for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "grupo y mentor leen" on alumnos_competencia_analisis for select to authenticated
  using ((mi_rol() = 'alumno' and alumnos_soy_integrante(proyecto_id::text)) or alumnos_soy_mentor(proyecto_id::text));
-- El grupo guarda el análisis que pidió, a su nombre y hasta 3 por día.
create policy "grupo guarda hasta 3 por dia" on alumnos_competencia_analisis for insert to authenticated
  with check (
    mi_rol() = 'alumno'
    and alumnos_soy_integrante(proyecto_id::text)
    and pedido_por = mi_persona_id()
    and alumnos_analisis_hoy(proyecto_id) < 3
  );

revoke execute on function public.alumnos_analisis_hoy(uuid) from public, anon;
grant execute on function public.alumnos_analisis_hoy(uuid) to authenticated;
