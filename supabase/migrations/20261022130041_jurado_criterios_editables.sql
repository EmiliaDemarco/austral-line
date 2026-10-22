-- GRUPO JURADO: criterios de evaluación editables desde la pantalla.
-- Solo suma: una columna con valor por defecto y protecciones nuevas. Los criterios actuales quedan activos.
--
-- Un criterio con notas cargadas no se borra: se desactiva. Deja de pedirse en las evaluaciones nuevas,
-- pero sus notas, los promedios y las devoluciones ya hechas no cambian.

alter table jurado_criterios add column activo boolean not null default true;

-- Borrar un criterio borraría en cascada todas sus notas: solo se puede si nunca se usó.
create policy "solo se borra un criterio sin notas" on jurado_criterios as restrictive for delete to authenticated
  using (not exists (select 1 from jurado_puntajes p where p.criterio_id = jurado_criterios.id));

-- Tiene que quedar al menos un criterio activo; si no, ninguna evaluación podría completarse.
create function jurado_criterio_ultimo_activo() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from jurado_criterios c where c.activo and c.id is distinct from old.id) then
    raise exception 'Tiene que quedar al menos un criterio activo';
  end if;
  return coalesce(new, old);
end $$;
create trigger jurado_criterio_ultimo_activo_baja before delete on jurado_criterios
  for each row when (old.activo) execute function jurado_criterio_ultimo_activo();
create trigger jurado_criterio_ultimo_activo_cambio before update of activo on jurado_criterios
  for each row when (old.activo and not new.activo) execute function jurado_criterio_ultimo_activo();

-- Las funciones de las devoluciones cuentan solo los criterios activos (y muestran los desactivados solo donde tienen notas).
create or replace function jurado_devolucion_guardar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := (select id from personas where lower(email) = lower(auth.jwt() ->> 'email'));
begin
  if tg_op = 'UPDATE' and (new.evento_id, new.proyecto_id) is distinct from (old.evento_id, old.proyecto_id) then
    raise exception 'Una devolución no se puede pasar a otro equipo o evento';
  end if;

  select round(avg(p.puntaje), 2), count(distinct e.id) into new.promedio_general, new.evaluaciones
  from jurado_evaluaciones e join jurado_puntajes p on p.evaluacion_id = e.id
  where e.evento_id = new.evento_id and e.proyecto_id = new.proyecto_id;

  select coalesce(jsonb_agg(jsonb_build_object('criterio', c.nombre, 'promedio', x.promedio) order by c.orden), '[]') into new.promedios
  from jurado_criterios c
  cross join lateral (
    select round(avg(p.puntaje), 2) as promedio
    from jurado_evaluaciones e join jurado_puntajes p on p.evaluacion_id = e.id
    where e.evento_id = new.evento_id and e.proyecto_id = new.proyecto_id and p.criterio_id = c.id
  ) x
  where c.activo or x.promedio is not null; -- un criterio desactivado solo aparece donde ya tiene notas

  new.huella := jurado_huella(new.evento_id, new.proyecto_id);
  new.revisada_por := yo;
  new.revisada_at := now();

  if tg_op = 'UPDATE' and jurado_evento_publicado(new.evento_id)
     and (new.comentarios is distinct from old.comentarios or new.propuestas is distinct from old.propuestas) then
    if btrim(coalesce(new.motivo_correccion, '')) = '' then
      raise exception 'Para corregir una devolución publicada hay que escribir el motivo';
    end if;
    insert into jurado_devoluciones_historial (evento_id, proyecto_id, comentarios, propuestas, motivo, cambiado_por)
    values (old.evento_id, old.proyecto_id, old.comentarios, old.propuestas, btrim(new.motivo_correccion), yo);
    new.actualizada_at := now();
  end if;
  new.motivo_correccion := null; -- cada corrección trae su propio motivo
  return new;
end $$;

create or replace function jurado_publicar_evento(p_evento uuid) returns int
language plpgsql security invoker set search_path = public as $$
declare
  total_criterios int := (select count(*) from jurado_criterios where activo);
  problemas text;
  equipos int;
begin
  if mi_rol() is distinct from 'admin' then
    raise exception 'Solo el admin publica las devoluciones';
  end if;
  -- Mientras se verifica y publica, nadie puede cambiar notas, ausencias, salones ni devoluciones.
  lock table jurado_evaluaciones, jurado_puntajes, jurado_devoluciones, jurado_ausencias, jurado_salon_proyectos
    in share row exclusive mode;
  if jurado_evento_publicado(p_evento) then
    raise exception 'Las devoluciones de este evento ya están publicadas';
  end if;

  with equipos as (
    select sp.proyecto_id, p.nombre
    from jurado_salon_proyectos sp join proyectos p on p.id = sp.proyecto_id
    where sp.evento_id = p_evento
      and not exists (select 1 from jurado_ausencias a where a.evento_id = p_evento and a.proyecto_id = sp.proyecto_id)
  ), estado as (
    select q.nombre,
      case
        when not exists (
          select 1 from jurado_evaluaciones e
          where e.evento_id = p_evento and e.proyecto_id = q.proyecto_id
            and (select count(*) from jurado_puntajes p join jurado_criterios c on c.id = p.criterio_id where p.evaluacion_id = e.id and c.activo) >= total_criterios
        ) then 'sin evaluaciones'
        when d.proyecto_id is null then 'sin revisar'
        when d.huella is distinct from jurado_huella(p_evento, q.proyecto_id) then 'cambiaron las evaluaciones'
      end as problema
    from equipos q
    left join jurado_devoluciones d on d.evento_id = p_evento and d.proyecto_id = q.proyecto_id
  )
  select string_agg(nombre || ': ' || problema, '; ' order by nombre) filter (where problema is not null), count(*)
  into problemas, equipos
  from estado;

  if equipos = 0 then
    raise exception 'Este evento no tiene equipos para publicar';
  end if;
  if problemas is not null then
    raise exception 'No se publicó nada. Falta resolver: %', problemas;
  end if;

  -- Ni los ausentes ni los equipos que ya no están en el evento tienen devolución.
  delete from jurado_devoluciones d
  where d.evento_id = p_evento
    and (d.proyecto_id in (select proyecto_id from jurado_ausencias where evento_id = p_evento)
      or d.proyecto_id not in (select proyecto_id from jurado_salon_proyectos where evento_id = p_evento));

  insert into jurado_publicaciones (evento_id, publicada_por)
  values (p_evento, (select id from personas where lower(email) = lower(auth.jwt() ->> 'email')));
  return equipos;
end $$;
