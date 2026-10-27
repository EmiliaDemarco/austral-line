"use server";

// GRUPO ALUMNOS — acciones del banco de ideas, compartidas por el banco y la página de cada idea.
// Todas corren con los permisos del usuario: la base (RLS) decide qué puede hacer cada uno.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// A dónde volver después de una acción: solo páginas del banco.
const destino = (formData: FormData) => {
  const v = String(formData.get("volver") ?? "");
  return /^\/alumnos\/ideas(\/[0-9a-f-]{36})?$/.test(v) ? v : "/alumnos/ideas";
};

const volverCon = (formData: FormData, error: string) =>
  redirect(`${destino(formData)}?error=${encodeURIComponent(error)}`);

const refrescar = (formData: FormData) => {
  revalidatePath("/alumnos/ideas");
  revalidatePath(destino(formData));
};

export async function proponerIdea(formData: FormData) {
  const persona = await requireRol("alumno");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const interesId = Number(formData.get("interes_id") ?? 0);
  if (titulo.length < 3) volverCon(formData, "El título tiene que tener al menos 3 caracteres.");
  if (descripcion.length < 10) volverCon(formData, "Contá un poco más en la descripción (al menos 10 caracteres).");
  if (!interesId) volverCon(formData, "Elegí el tema de la idea.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("alumnos_ideas")
    .insert({ autor_id: persona.id, titulo, descripcion, interes_id: interesId });
  if (error) volverCon(formData, `No se pudo cargar la idea: ${error.message}`);

  revalidatePath("/alumnos/ideas");
  redirect("/alumnos/ideas?ok=propuesta");
}

export async function cambiarInteres(formData: FormData) {
  const persona = await requireRol("alumno");
  const ideaId = String(formData.get("idea_id"));
  const supabase = await createClient();
  const { error } =
    formData.get("accion") === "quitar"
      ? await supabase.from("alumnos_ideas_interesados").delete().eq("idea_id", ideaId).eq("persona_id", persona.id)
      : await supabase.from("alumnos_ideas_interesados").insert({ idea_id: ideaId, persona_id: persona.id });
  if (error) volverCon(formData, `No se pudo actualizar tu interés: ${error.message}`);
  refrescar(formData);
}

export async function cambiarEstado(formData: FormData) {
  await requireRol("alumno");
  const ideaId = String(formData.get("idea_id"));
  const estado = formData.get("estado") === "tomada" ? "tomada" : "disponible";
  const supabase = await createClient();
  // La base solo deja cambiarla al autor o a los profesores (RLS): si no corresponde, no cambia nada.
  const { data, error } = await supabase
    .from("alumnos_ideas")
    .update({ estado, updated_at: new Date().toISOString() })
    .eq("id", ideaId)
    .select("id");
  if (error) volverCon(formData, `No se pudo cambiar el estado: ${error.message}`);
  if (!data?.length) volverCon(formData, "Solo quien propuso la idea o los profesores pueden cambiar su estado.");
  refrescar(formData);
}

export async function guardarContexto(formData: FormData) {
  await requireRol("alumno");
  const ideaId = String(formData.get("idea_id"));
  const texto = (campo: string) => String(formData.get(campo) ?? "").trim() || null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alumnos_ideas")
    .update({
      a_quien_le_pasa: texto("a_quien_le_pasa"),
      que_se_intento: texto("que_se_intento"),
      como_seria_resuelto: texto("como_seria_resuelto"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ideaId)
    .select("id");
  if (error) volverCon(formData, `No se pudo guardar el contexto: ${error.message}`);
  if (!data?.length) volverCon(formData, "Solo quien propuso la idea o los profesores pueden editar el contexto.");
  refrescar(formData);
}

export async function publicarMensaje(formData: FormData) {
  const persona = await requireRol("alumno");
  const ideaId = String(formData.get("idea_id"));
  const respuestaA = String(formData.get("respuesta_a") ?? "") || null;
  const texto = String(formData.get("texto") ?? "").trim();
  if (texto.length < 2) volverCon(formData, "Escribí tu pregunta o respuesta.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("alumnos_ideas_mensajes")
    .insert({ idea_id: ideaId, autor_id: persona.id, respuesta_a: respuestaA, texto });
  if (error) volverCon(formData, `No se pudo publicar: ${error.message}`);
  refrescar(formData);
}
