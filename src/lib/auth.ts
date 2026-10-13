import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { puedeVer, type Rol } from "@/lib/secciones";

// Usuario logueado + su persona (rol). persona = null si nadie lo sumó en Miembros.
export const getUsuario = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims.email;
  if (!email) redirect("/login");
  const { data: persona } = await supabase
    .from("personas")
    .select("id, nombre, rol")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return { email, persona };
});

// Usalo arriba de cada sección: `await requireRol("jurado")`. El admin siempre pasa.
export async function requireRol(...permitidos: Rol[]) {
  const { persona } = await getUsuario();
  if (!persona || !puedeVer(persona.rol, permitidos)) redirect("/");
  return persona;
}
