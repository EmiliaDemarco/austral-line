"use server";
// GRUPO JURADO — acciones de la pantalla de criterios. Todas son solo para el admin/organizador.
// Un criterio con notas no se borra: se desactiva (la base también lo impide).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function volver(tipo: "ok" | "error", mensaje: string): never {
  revalidatePath("/jurado", "layout");
  redirect(`/jurado/criterios?${tipo}=${encodeURIComponent(mensaje)}`);
}

async function preparar() {
  await requireRol(); // solo admin
  return createClient();
}

const limpiar = (formData: FormData, campo: string) => String(formData.get(campo) ?? "").trim().replace(/\s+/g, " ");

export async function crearCriterio(formData: FormData) {
  const supabase = await preparar();
  const nombre = limpiar(formData, "nombre");
  const descripcion = limpiar(formData, "descripcion") || null;
  if (!nombre) volver("error", "Poné un nombre para el criterio.");

  const { data: existentes, error: errorExistentes } = await supabase.from("jurado_criterios").select("nombre, orden");
  if (errorExistentes) throw errorExistentes;
  if (existentes.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) volver("error", `Ya hay un criterio "${nombre}".`);

  const orden = Math.max(0, ...existentes.map((c) => c.orden)) + 1;
  const { error } = await supabase.from("jurado_criterios").insert({ nombre, descripcion, orden });
  if (error) throw error;
  volver("ok", `Criterio "${nombre}" creado. Desde ahora los jurados lo puntúan en cada evaluación.`);
}

export async function guardarCriterio(formData: FormData) {
  const supabase = await preparar();
  const id = String(formData.get("criterio_id"));
  const nombre = limpiar(formData, "nombre");
  const descripcion = limpiar(formData, "descripcion") || null;
  if (!nombre) volver("error", "El criterio necesita un nombre.");

  const { data: otros, error: errorOtros } = await supabase.from("jurado_criterios").select("id, nombre");
  if (errorOtros) throw errorOtros;
  if (otros.some((c) => c.id !== id && c.nombre.toLowerCase() === nombre.toLowerCase())) volver("error", `Ya hay un criterio "${nombre}".`);

  const { data, error } = await supabase.from("jurado_criterios").update({ nombre, descripcion }).eq("id", id).select("id");
  if (error) throw error;
  if (data.length === 0) volver("error", "Ese criterio ya no existe.");
  volver("ok", `Criterio "${nombre}" guardado.`);
}

// Sube o baja un criterio: se renumera todo para que el orden quede siempre 1, 2, 3…
export async function moverCriterio(formData: FormData) {
  const supabase = await preparar();
  const id = String(formData.get("criterio_id"));
  const salto = formData.get("direccion") === "subir" ? -1 : 1;

  const { data: criterios, error } = await supabase.from("jurado_criterios").select("id, orden, nombre").order("orden").order("nombre");
  if (error) throw error;
  const desde = criterios.findIndex((c) => c.id === id);
  const hasta = desde + salto;
  if (desde === -1 || hasta < 0 || hasta >= criterios.length) volver("ok", "Ya está en ese extremo.");
  [criterios[desde], criterios[hasta]] = [criterios[hasta], criterios[desde]];

  for (const [i, c] of criterios.entries()) {
    if (c.orden === i + 1) continue;
    const { error: errorOrden } = await supabase.from("jurado_criterios").update({ orden: i + 1 }).eq("id", c.id);
    if (errorOrden) throw errorOrden;
  }
  volver("ok", "Orden actualizado.");
}

export async function cambiarEstado(formData: FormData) {
  const supabase = await preparar();
  const id = String(formData.get("criterio_id"));
  const activar = formData.get("activar") === "si";

  const { data, error } = await supabase.from("jurado_criterios").update({ activo: activar }).eq("id", id).select("nombre");
  if (error?.message.includes("al menos un criterio activo")) volver("error", "Tiene que quedar al menos un criterio activo.");
  if (error) throw error;
  if (data.length === 0) volver("error", "Ese criterio ya no existe.");
  volver("ok", activar
    ? `Criterio "${data[0].nombre}" activado: los jurados vuelven a puntuarlo.`
    : `Criterio "${data[0].nombre}" desactivado. Sus notas anteriores se conservan.`);
}

export async function borrarCriterio(formData: FormData) {
  const supabase = await preparar();
  const id = String(formData.get("criterio_id"));

  // Solo se borra un criterio que nunca se usó. Si tiene notas, la base lo rechaza sin avisar (0 filas): se desactiva.
  const { data, error } = await supabase.from("jurado_criterios").delete().eq("id", id).select("nombre");
  if (error?.message.includes("al menos un criterio activo")) volver("error", "Tiene que quedar al menos un criterio activo.");
  if (error) throw error;
  if (data.length === 0) volver("error", "No se borró: este criterio ya tiene notas cargadas. Desactivalo para que deje de usarse.");
  volver("ok", `Criterio "${data[0].nombre}" borrado.`);
}
