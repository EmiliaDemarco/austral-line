-- Solo corre en local. Un login de prueba por rol, todos con contraseña austral123:
-- admin@austral.edu.ar · ana@alumnos.austral.edu.ar · marta@empresa.com · julio@empresa.com
create function pg_temp.crear_login(mail text) returns void language sql as $$
  with u as (
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      mail, crypt('austral123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
    returning id, email
  )
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  select gen_random_uuid(), id, id, jsonb_build_object('sub', id, 'email', email), 'email', now(), now() from u;
$$;

insert into personas (nombre, email, rol) values
  ('Admin Austral', 'admin@austral.edu.ar', 'admin'),
  ('Ana Alumna', 'ana@alumnos.austral.edu.ar', 'alumno'),
  ('Bruno Alumno', 'bruno@alumnos.austral.edu.ar', 'alumno'),
  ('Marta Mentora', 'marta@empresa.com', 'mentor'),
  ('Julio Jurado', 'julio@empresa.com', 'jurado');

insert into proyectos (nombre, descripcion, estado) values
  ('AgroSense', 'Sensores para riego inteligente', 'publicado'),
  ('Tutorly', 'Marketplace de tutorías', 'borrador');

insert into proyecto_integrantes
  select p.id, pe.id from proyectos p, personas pe
  where (p.nombre, pe.email) in (('AgroSense', 'ana@alumnos.austral.edu.ar'), ('Tutorly', 'bruno@alumnos.austral.edu.ar'));

insert into eventos (nombre, tipo, inicio, lugar) values
  ('Kickoff', 'presentacion', now() + interval '7 days', 'Aula Magna'),
  ('Demo Day', 'final', now() + interval '60 days', 'Auditorio');

select pg_temp.crear_login(email) from personas
  where email in ('admin@austral.edu.ar', 'ana@alumnos.austral.edu.ar', 'marta@empresa.com', 'julio@empresa.com');

-- GRUPO JURADO: un proyecto finalista más para probar la planilla de evaluación.
insert into proyectos (nombre, descripcion, estado) values
  ('Reciclá', 'App que premia a los vecinos por separar residuos', 'finalista');

-- GRUPO JURADO: una segunda jurado con evaluaciones cargadas, para ver el tablero de deliberación.
insert into personas (nombre, email, rol) values ('Lucía Inversora', 'lucia@fondo.com', 'jurado');
select pg_temp.crear_login('lucia@fondo.com');

with ev as (
  insert into jurado_evaluaciones (proyecto_id, jurado_id, propuesta_valor, comentarios)
  select p.id, pe.id, v.propuesta, v.comentario
  from (values
    ('AgroSense', 'Ahorro de agua para productores medianos con sensores baratos', 'Equipo sólido. Falta mostrar tracción con clientes reales.'),
    ('Reciclá', 'Premios por reciclar para que los vecinos separen en origen', 'Buena idea, el modelo de ingresos no queda claro.')
  ) as v(proyecto, propuesta, comentario)
  join proyectos p on p.nombre = v.proyecto
  join personas pe on pe.email = 'lucia@fondo.com'
  returning id, proyecto_id
)
insert into jurado_puntajes (evaluacion_id, criterio_id, puntaje)
select ev.id, c.id,
  case when p.nombre = 'AgroSense' then 9 - c.orden + 1 else 4 + c.orden end
from ev join proyectos p on p.id = ev.proyecto_id cross join jurado_criterios c;
