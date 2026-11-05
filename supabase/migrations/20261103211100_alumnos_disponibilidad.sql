-- GRUPO ALUMNOS: disponibilidad semanal para reunirse (Agente de Organización de Agenda, primera parte).
-- Cada alumno marca en qué franjas de la semana puede reunirse. El grupo ve en qué horarios pueden todos (o
-- casi todos), y su mentor asignado y los profesores ven ese resumen para proponer reuniones. Cruzarlo con la
-- disponibilidad del mentor queda para cuando el grupo Mentores la tenga cargada.
-- Días: 1 lunes … 6 sábado. Franjas: 1 de 8 a 12, 2 de 12 a 16, 3 de 16 a 20, 4 de 20 a 23.

create table alumnos_disponibilidad (
  persona_id uuid not null references personas(id) on delete cascade,
  dia smallint not null check (dia between 1 and 6),
  franja smallint not null check (franja between 1 and 4),
  primary key (persona_id, dia, franja)
);

alter table alumnos_disponibilidad enable row level security;
create policy "admin todo" on alumnos_disponibilidad for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "alumno maneja la suya" on alumnos_disponibilidad for all to authenticated
  using (mi_rol() = 'alumno' and persona_id = mi_persona_id())
  with check (mi_rol() = 'alumno' and persona_id = mi_persona_id());

-- Resumen de un grupo: por cada día y franja, cuántos integrantes pueden y cuántos son. Lo piden los
-- integrantes, el mentor asignado y los profesores. Security definer para no abrir la disponibilidad
-- individual de cada uno: solo devuelve cantidades.
create function public.alumnos_disponibilidad_grupo(p_proyecto uuid)
returns table (dia smallint, franja smallint, pueden integer, integrantes integer, cargaron integer)
language sql stable security definer set search_path = public as $$
  with permiso as (
    select (mi_rol() = 'admin')
        or (mi_rol() = 'alumno' and alumnos_soy_integrante(p_proyecto::text))
        or alumnos_soy_mentor(p_proyecto::text) as ok
  ),
  miembros as (select persona_id from proyecto_integrantes where proyecto_id = p_proyecto),
  cargaron as (select count(distinct d.persona_id)::integer as n from alumnos_disponibilidad d join miembros m using (persona_id))
  select d.dia::smallint, f.franja::smallint,
         (select count(*)::integer from alumnos_disponibilidad a join miembros m using (persona_id) where a.dia = d.dia and a.franja = f.franja),
         (select count(*)::integer from miembros),
         (select n from cargaron)
  from generate_series(1, 6) as d(dia), generate_series(1, 4) as f(franja), permiso
  where permiso.ok
  order by 1, 2
$$;
revoke execute on function public.alumnos_disponibilidad_grupo(uuid) from public, anon;
grant execute on function public.alumnos_disponibilidad_grupo(uuid) to authenticated;
