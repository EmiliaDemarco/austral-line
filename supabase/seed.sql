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

-- GRUPO ALUMNOS: alumnos de prueba con perfil, para probar "Compañeros afines".
-- Logins con contraseña austral123: carla@, diego@ y elena@alumnos.austral.edu.ar. Ana arranca sin perfil.
insert into personas (nombre, email, rol) values
  ('Carla Alumna', 'carla@alumnos.austral.edu.ar', 'alumno'),
  ('Diego Alumno', 'diego@alumnos.austral.edu.ar', 'alumno'),
  ('Elena Alumna', 'elena@alumnos.austral.edu.ar', 'alumno');

select pg_temp.crear_login(email) from personas
  where email in ('carla@alumnos.austral.edu.ar', 'diego@alumnos.austral.edu.ar', 'elena@alumnos.austral.edu.ar');

insert into alumnos_perfiles (persona_id, carrera, intereses, no_intereses, sobre_mi, busca_equipo)
select pe.id, v.carrera, v.intereses, v.no_intereses, v.sobre_mi, v.busca_equipo
from personas pe join (values
  ('carla@alumnos.austral.edu.ar', 'Marketing', array['Salud', 'Impacto social'], array['Finanzas y fintech'],
    'Me interesa mejorar el acceso a la salud en el interior.', true),
  ('diego@alumnos.austral.edu.ar', 'Agronegocios', array['Agro y alimentos', 'Sustentabilidad y ambiente'], array['Moda y diseño'],
    'Vengo de una familia de productores, me gustaría algo de agro.', true),
  ('elena@alumnos.austral.edu.ar', 'Administración de Empresas', array['Agro y alimentos', 'Finanzas y fintech'], array['Salud'],
    null, true),
  ('bruno@alumnos.austral.edu.ar', 'Negocios Digitales', array['Educación', 'Tecnología y software'], array[]::text[],
    'Ya estoy en Tutorly.', false)
) as v(email, carrera, intereses, no_intereses, sobre_mi, busca_equipo) on v.email = pe.email;
