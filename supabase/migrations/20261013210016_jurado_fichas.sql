-- GRUPO JURADO: ficha de cada proyecto para que el jurado llegue informado al pitch.
-- La carga el admin/organizador (por ejemplo, pegándola desde Notion). Una ficha por proyecto.
create table jurado_fichas (
  proyecto_id uuid primary key references proyectos(id) on delete cascade,
  problema text,
  solucion text,
  propuesta_valor text, -- la oficial del equipo, para contrastar con lo que entendió cada jurado
  mercado text,
  modelo_negocio text,
  etapa text check (etapa in ('idea', 'prototipo', 'primeras_ventas', 'creciendo')),
  traccion text,
  link_presentacion text,
  updated_at timestamptz not null default now()
);

alter table jurado_fichas enable row level security;
create policy "admin todo" on jurado_fichas for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
create policy "jurado lee" on jurado_fichas for select to authenticated
  using (mi_rol() = 'jurado');
