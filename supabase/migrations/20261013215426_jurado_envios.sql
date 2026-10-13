-- GRUPO JURADO: registro de los mails que se mandan a los jurados (recordatorios y post-evento) con Resend.
-- Sirve para no mandar dos veces lo mismo, para cancelar recordatorios si cambia el horario y como historial.
create table jurado_envios (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  tipo text not null check (tipo in ('recordatorio_24h', 'recordatorio_1h', 'post_evento', 'prueba')),
  persona_id uuid references personas(id) on delete set null,
  email text not null,
  asunto text not null,
  programado_para timestamptz, -- null = se mandó en el momento
  estado text not null check (estado in ('programado', 'enviado', 'simulado', 'cancelado', 'error')),
  resend_id text,             -- id del mail en Resend, para poder cancelarlo
  error text,
  created_at timestamptz not null default now()
);

-- Solo el admin/organizador manda mails y ve el historial.
alter table jurado_envios enable row level security;
create policy "admin todo" on jurado_envios for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');

-- Material del mail post-evento (3 fotos destacadas + 1 video resumen), guardado para no tener que volver a cargarlo.
create table jurado_material_post (
  evento_id uuid primary key references eventos(id) on delete cascade,
  foto_1 text,
  foto_2 text,
  foto_3 text,
  video text,
  mensaje text,
  updated_at timestamptz not null default now()
);

alter table jurado_material_post enable row level security;
create policy "admin todo" on jurado_material_post for all to authenticated
  using (mi_rol() = 'admin') with check (mi_rol() = 'admin');
