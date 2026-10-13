-- GRUPO ALUMNOS: perfil de cada alumno para el armado de equipos.
-- Carrera (para la interdisciplinariedad), si quiere aparecer como "busco equipo",
-- y cuánto le interesa cada tema del maestro de intereses (1 a 5 estrellas).

-- Perfil -----------------------------------------------------------------------
create table alumnos_perfiles (
  persona_id uuid primary key references personas(id) on delete cascade,
  carrera text not null,
  sobre_mi text,
  busca_equipo boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table alumnos_perfiles enable row level security;

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

-- Maestro de intereses -----------------------------------------------------------
-- Listado oficial de temas. Lo lee cualquiera con rol; solo el admin lo modifica.
create table alumnos_intereses_maestro (
  id smallint generated always as identity primary key,
  nombre text not null unique,
  orden smallint not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table alumnos_intereses_maestro enable row level security;

create policy "leer con rol" on alumnos_intereses_maestro for select to authenticated
  using (mi_rol() is not null);
create policy "admin escribe" on alumnos_intereses_maestro for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

insert into alumnos_intereses_maestro (nombre, orden) values
  ('Salud', 1),
  ('Educación', 2),
  ('Agro y alimentos', 3),
  ('Finanzas y fintech', 4),
  ('Sustentabilidad y ambiente', 5),
  ('Impacto social', 6),
  ('Consumo y retail', 7),
  ('Tecnología y software', 8),
  ('Turismo y entretenimiento', 9),
  ('Logística y movilidad', 10),
  ('Deportes y bienestar', 11),
  ('Industria y manufactura', 12),
  ('Moda y diseño', 13),
  ('Inmobiliario y construcción', 14);

-- Respuestas de cada alumno: cuánto le interesa cada tema (1 a 5 estrellas) ----
create table alumnos_intereses (
  persona_id uuid not null references personas(id) on delete cascade,
  interes_id smallint not null references alumnos_intereses_maestro(id) on delete cascade,
  estrellas smallint not null check (estrellas between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (persona_id, interes_id)
);

alter table alumnos_intereses enable row level security;

create policy "admin todo" on alumnos_intereses for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- El alumno ve sus respuestas y las de quienes buscan equipo (para calcular afinidad).
create policy "alumno ve lo suyo y quienes buscan equipo" on alumnos_intereses for select to authenticated
  using (
    mi_rol() = 'alumno'
    and (
      persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'))
      or exists (select 1 from alumnos_perfiles p where p.persona_id = alumnos_intereses.persona_id and p.busca_equipo)
    )
  );

-- El alumno carga, cambia y quita solo sus propias respuestas.
create policy "alumno gestiona lo suyo" on alumnos_intereses for all to authenticated
  using (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')))
  with check (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
