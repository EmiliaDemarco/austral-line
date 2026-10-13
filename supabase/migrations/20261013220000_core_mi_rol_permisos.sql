-- CORE: mi_rol() solo para usuarios logueados (lo pide el advisor de seguridad de Supabase).
revoke execute on function public.mi_rol() from public, anon;
grant execute on function public.mi_rol() to authenticated;
