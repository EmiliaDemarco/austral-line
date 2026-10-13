-- GRUPO JURADO: planilla de evaluación en vivo.
-- Cada jurado puntúa cada proyecto de 1 a 10 por criterio y deja feedback en palabras.

-- Qué se evalúa. Viven en la base para poder cambiarlos sin tocar código.
create table jurado_criterios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

insert into jurado_criterios (nombre, descripcion, orden) values
  ('Propuesta de valor', '¿Qué problema resuelve y por qué es mejor que lo que existe?', 1),
  ('Equipo', '¿Es el equipo indicado para llevarlo adelante?', 2),
  ('Mercado', '¿Hay clientes dispuestos a pagar y es una oportunidad grande?', 3),
  ('Pitch', '¿Fue claro, convincente y respetó el tiempo?', 4);

-- Una evaluación por jurado y proyecto. Se puede editar hasta el final (los jurados ajustan sus notas).
create table jurado_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  jurado_id uuid not null references personas(id) on delete cascade,
  propuesta_valor text, -- la propuesta de valor como la entendió el jurado, para alinear en la deliberación
  comentarios text,     -- feedback cualitativo para el equipo
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, jurado_id)
);

create table jurado_puntajes (
  evaluacion_id uuid not null references jurado_evaluaciones(id) on delete cascade,
  criterio_id uuid not null references jurado_criterios(id) on delete cascade,
  puntaje smallint not null check (puntaje between 1 and 10),
  primary key (evaluacion_id, criterio_id)
);

-- Permisos: el admin edita los criterios y ve todas las evaluaciones, pero no carga notas (eso es solo del jurado).
-- El jurado lee los criterios y carga solo sus propias evaluaciones.
alter table jurado_criterios enable row level security;
create policy "admin todo" on jurado_criterios for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "jurado lee" on jurado_criterios for select to authenticated
  using (mi_rol() = 'jurado');

alter table jurado_evaluaciones enable row level security;
create policy "admin lee" on jurado_evaluaciones for select to authenticated
  using (mi_rol() = 'admin');
-- Los borradores todavía no se presentan: no se pueden evaluar.
create policy "jurado lo suyo" on jurado_evaluaciones for all to authenticated
  using (mi_rol() = 'jurado' and jurado_id = (select id from personas where email = auth.jwt() ->> 'email'))
  with check (mi_rol() = 'jurado' and jurado_id = (select id from personas where email = auth.jwt() ->> 'email')
    and proyecto_id in (select id from proyectos where estado in ('publicado', 'finalista', 'ganador')));

alter table jurado_puntajes enable row level security;
create policy "admin lee" on jurado_puntajes for select to authenticated
  using (mi_rol() = 'admin');
create policy "jurado lo suyo" on jurado_puntajes for all to authenticated
  using (mi_rol() = 'jurado' and evaluacion_id in (
    select id from jurado_evaluaciones where jurado_id = (select id from personas where email = auth.jwt() ->> 'email')))
  with check (mi_rol() = 'jurado' and evaluacion_id in (
    select id from jurado_evaluaciones where jurado_id = (select id from personas where email = auth.jwt() ->> 'email')));
