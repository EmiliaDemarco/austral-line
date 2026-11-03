"use server";

// GRUPO ALUMNOS — acciones del análisis de competencia. Corren con los permisos del alumno (RLS):
// la base decide quién guarda el breve y cuántos análisis por día puede pedir el grupo.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analizarCompetencia, hayIA, MODELO } from "./_agente";
import { MAXIMO_POR_DIA } from "./_limite";

const volver = (proyectoId: string, aviso?: { error?: string; ok?: string }) => {
  revalidatePath("/alumnos/competencia");
  const q = aviso?.error ? `&error=${encodeURIComponent(aviso.error)}` : aviso?.ok ? `&ok=${encodeURIComponent(aviso.ok)}` : "";
  redirect(`/alumnos/competencia?proyecto=${encodeURIComponent(proyectoId)}${q}`);
};

// Error de la IA en palabras claras (sin los códigos de color que trae el mensaje original).
function mensajeDeError(e: unknown) {
  const original = (e instanceof Error ? e.message : String(e)).replace(/\u001b\[[0-9;]*m/g, "");
  if (/unauthenticated|api key|401|403/i.test(original)) {
    return "La clave de IA no funciona (el servicio la rechazó). Avisales a los profesores para que la revisen.";
  }
  if (/credit|quota|insufficient|402/i.test(original)) {
    return "La cuenta de IA se quedó sin crédito. Avisales a los profesores.";
  }
  return `La IA no pudo terminar el análisis (${original.slice(0, 200)}). Probá de nuevo en un rato.`;
}

const texto = (formData: FormData, campo: string) => String(formData.get(campo) ?? "").trim();

export async function guardarBreve(formData: FormData) {
  const persona = await requireRol("alumno");
  const proyectoId = texto(formData, "proyecto_id");
  const breve = {
    problema: texto(formData, "problema"),
    solucion: texto(formData, "solucion"),
    publico: texto(formData, "publico"),
    mercado: texto(formData, "mercado"),
  };
  if (breve.problema.length < 10 || breve.solucion.length < 10) {
    volver(proyectoId, { error: "Contá el problema y la solución con un poco más de detalle (al menos 10 caracteres cada uno)." });
  }
  if (breve.publico.length < 3 || breve.mercado.length < 2) volver(proyectoId, { error: "Completá a quién apunta y el mercado." });
  const supabase = await createClient();
  const { error } = await supabase
    .from("alumnos_competencia_breve")
    .upsert({ proyecto_id: proyectoId, ...breve, updated_by: persona.id, updated_at: new Date().toISOString() });
  volver(proyectoId, error ? { error: `No se pudo guardar: ${error.message}` } : { ok: "Breve guardado." });
}

export async function analizar(formData: FormData) {
  const persona = await requireRol("alumno");
  const proyectoId = texto(formData, "proyecto_id");
  if (!hayIA()) volver(proyectoId, { error: "Falta configurar la clave de IA: avisales a los profesores." });
  const supabase = await createClient();

  const [{ data: breve }, { data: proyecto }, { data: hechos }] = await Promise.all([
    supabase.from("alumnos_competencia_breve").select("problema, solucion, publico, mercado").eq("proyecto_id", proyectoId).maybeSingle(),
    supabase.from("proyectos").select("nombre").eq("id", proyectoId).maybeSingle(),
    supabase.rpc("alumnos_analisis_hoy", { p_proyecto: proyectoId }),
  ]);
  if (!breve || !proyecto) volver(proyectoId, { error: "Primero completen y guarden el breve del proyecto." });
  if ((hechos ?? 0) >= MAXIMO_POR_DIA) volver(proyectoId, { error: `Ya hicieron los ${MAXIMO_POR_DIA} análisis de hoy. Mañana pueden pedir otro.` });

  let resultado;
  try {
    resultado = await analizarCompetencia({ nombre: proyecto!.nombre, ...breve! });
  } catch (e) {
    volver(proyectoId, { error: mensajeDeError(e) });
  }

  const { error } = await supabase.from("alumnos_competencia_analisis").insert({
    proyecto_id: proyectoId,
    breve: breve!,
    resultado: resultado!,
    modelo: MODELO,
    pedido_por: persona.id,
  });
  if (error?.code === "42501") volver(proyectoId, { error: `Ya hicieron los ${MAXIMO_POR_DIA} análisis de hoy. Mañana pueden pedir otro.` });
  volver(proyectoId, error ? { error: `No se pudo guardar el análisis: ${error.message}` } : { ok: "Listo: el análisis nuevo está abajo." });
}
