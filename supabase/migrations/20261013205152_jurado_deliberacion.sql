-- GRUPO JURADO: tablero de deliberación.
-- Los jurados deliberan juntos, así que cada uno puede ver las notas de todos.
-- Editar sigue siendo solo lo propio (policies "jurado lo suyo").
create policy "jurado lee todas" on jurado_evaluaciones for select to authenticated
  using (mi_rol() = 'jurado');
create policy "jurado lee todos" on jurado_puntajes for select to authenticated
  using (mi_rol() = 'jurado');
