-- CORE: roles. El rol de cada usuario sale de `personas`, buscando por el email del login.
alter type rol rename value 'staff' to 'admin';

-- Rol del usuario logueado (null si no tiene persona). Usalo en las policies de tus tablas.
create function public.mi_rol() returns rol
language sql stable security definer set search_path = '' as $$
  select rol from public.personas where lower(email) = lower(auth.jwt() ->> 'email')
$$;

-- Core: cualquiera con rol lee; solo admin escribe.
do $$
declare t text;
begin
  foreach t in array array['personas', 'proyectos', 'proyecto_integrantes', 'eventos'] loop
    execute format('drop policy "admins" on %I', t);
    execute format('create policy "leer con rol" on %I for select to authenticated using (public.mi_rol() is not null)', t);
    execute format('create policy "admin escribe" on %I for all to authenticated using (public.mi_rol() = ''admin'') with check (public.mi_rol() = ''admin'')', t);
  end loop;
end $$;
