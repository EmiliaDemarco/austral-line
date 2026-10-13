-- CORE: tablas compartidas por los 4 grupos. Solo el profe las modifica.
-- Cada grupo crea SUS tablas con su prefijo (alumnos_, mentores_, jurado_, austral_).

create type rol as enum ('alumno', 'mentor', 'jurado', 'staff');

create table personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  rol rol not null,
  created_at timestamptz not null default now()
);

create table proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'publicado', 'finalista', 'ganador')),
  created_at timestamptz not null default now()
);

create table proyecto_integrantes (
  proyecto_id uuid not null references proyectos on delete cascade,
  persona_id uuid not null references personas on delete cascade,
  primary key (proyecto_id, persona_id)
);

create table eventos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null,
  inicio timestamptz not null,
  fin timestamptz,
  lugar text,
  created_at timestamptz not null default now()
);

-- ponytail: dashboard solo-admin => cualquier usuario logueado lee/escribe todo.
-- Si después entran alumnos/mentores con su propio login, acá van policies por rol.
do $$
declare t text;
begin
  foreach t in array array['personas', 'proyectos', 'proyecto_integrantes', 'eventos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "admins" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
