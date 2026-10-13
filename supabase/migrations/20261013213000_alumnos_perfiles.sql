-- GRUPO ALUMNOS: perfil de cada alumno para el armado de equipos.
-- Carrera (del maestro de carreras, fija una vez elegida), si quiere aparecer como
-- "busco equipo", y cuánto le interesa cada tema del maestro de intereses (1 a 5 estrellas).

-- Perfil -----------------------------------------------------------------------
create table alumnos_perfiles (
  persona_id uuid primary key references personas(id) on delete cascade,
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

-- Maestro de carreras -------------------------------------------------------------
-- Carreras que cursan el taller. Lo lee cualquiera con rol; solo el admin lo modifica.
create table alumnos_carreras_maestro (
  id smallint generated always as identity primary key,
  nombre text not null unique,
  orden smallint not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table alumnos_carreras_maestro enable row level security;

create policy "leer con rol" on alumnos_carreras_maestro for select to authenticated
  using (mi_rol() is not null);
create policy "admin escribe" on alumnos_carreras_maestro for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

insert into alumnos_carreras_maestro (nombre, orden) values
  ('Administración de Empresas', 1),
  ('Negocios Digitales', 2),
  ('Economía Empresarial', 3),
  ('Agronegocios', 4),
  ('Marketing', 5);

-- Carrera de cada alumno -------------------------------------------------------------
-- Una por alumno. El alumno la elige UNA vez (no tiene permiso para cambiarla ni borrarla);
-- solo el admin (los profesores) la corrige.
create table alumnos_carreras (
  persona_id uuid primary key references personas(id) on delete cascade,
  carrera_id smallint not null references alumnos_carreras_maestro(id),
  created_at timestamptz not null default now()
);

alter table alumnos_carreras enable row level security;

create policy "admin todo" on alumnos_carreras for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- El alumno ve su carrera y la de quienes buscan equipo (para la interdisciplinariedad).
create policy "alumno ve lo suyo y quienes buscan equipo" on alumnos_carreras for select to authenticated
  using (
    mi_rol() = 'alumno'
    and (
      persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'))
      or exists (select 1 from alumnos_perfiles p where p.persona_id = alumnos_carreras.persona_id and p.busca_equipo)
    )
  );

-- El alumno solo carga la suya, y solo una vez (sin políticas de update ni delete para alumnos).
create policy "alumno elige la suya" on alumnos_carreras for insert to authenticated
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

-- Historial de cambios de intereses ------------------------------------------------
-- Se completa solo (trigger): queda registro de cada vez que un alumno califica,
-- cambia o quita un tema. Sirve para ver la evolución y para resolver reclamos.
create table alumnos_intereses_historial (
  id bigint generated always as identity primary key,
  persona_id uuid not null references personas(id) on delete cascade,
  interes_id smallint not null references alumnos_intereses_maestro(id) on delete cascade,
  estrellas_antes smallint,
  estrellas_despues smallint,
  cambiado_en timestamptz not null default now()
);

alter table alumnos_intereses_historial enable row level security;

create policy "admin ve todo" on alumnos_intereses_historial for select to authenticated
  using (mi_rol() = 'admin');
create policy "alumno ve lo suyo" on alumnos_intereses_historial for select to authenticated
  using (mi_rol() = 'alumno' and persona_id = (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
-- Nadie escribe directo: solo el trigger (security definer).

create function public.alumnos_registrar_cambio_interes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.alumnos_intereses_historial (persona_id, interes_id, estrellas_antes, estrellas_despues)
  values (
    coalesce(new.persona_id, old.persona_id),
    coalesce(new.interes_id, old.interes_id),
    case when tg_op = 'INSERT' then null else old.estrellas end,
    case when tg_op = 'DELETE' then null else new.estrellas end
  );
  return null;
end $$;

create trigger historial_alta after insert on alumnos_intereses
  for each row execute function public.alumnos_registrar_cambio_interes();
create trigger historial_cambio after update on alumnos_intereses
  for each row when (old.estrellas is distinct from new.estrellas)
  execute function public.alumnos_registrar_cambio_interes();
create trigger historial_baja after delete on alumnos_intereses
  for each row execute function public.alumnos_registrar_cambio_interes();
