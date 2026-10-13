-- GRUPO ALUMNOS: perfil de cada alumno para el armado de equipos.
-- Carrera (para la interdisciplinariedad) + temas que le interesan y que no,
-- y si quiere aparecer como "busco equipo" para otros alumnos.

create table alumnos_perfiles (
  persona_id uuid primary key references personas(id) on delete cascade,
  carrera text not null,
  intereses text[] not null default '{}',
  no_intereses text[] not null default '{}',
  sobre_mi text,
  busca_equipo boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table alumnos_perfiles enable row level security;

-- El admin ve y edita todo.
create policy "admin todo" on alumnos_perfiles for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- El alumno ve su propio perfil y el de quienes marcaron "busco equipo".
create policy "alumno ve lo suyo y quienes buscan equipo" on alumnos_perfiles for select to authenticated
  using (
    mi_rol() = 'alumno'
    and (busca_equipo or persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')))
  );

-- El alumno solo crea y edita su propio perfil.
create policy "alumno crea lo suyo" on alumnos_perfiles for insert to authenticated
  with check (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
create policy "alumno edita lo suyo" on alumnos_perfiles for update to authenticated
  using (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')))
  with check (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
