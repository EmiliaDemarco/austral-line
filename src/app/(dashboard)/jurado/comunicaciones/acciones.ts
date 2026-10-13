"use server";
// GRUPO JURADO — acciones de la pantalla de mails a jurados. Todas son solo para el admin/organizador.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUsuario, requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { cancelarCorreo, enviarCorreos, modoPrueba, type Correo } from "../_resend";
import { cargarDatos, faltantesPostEvento, urlBase, type Datos } from "./datos";
import { diaSiguienteALas9, fechaHora, mailPostEvento, mailRecordatorio } from "./plantillas";

type Envio = Database["public"]["Tables"]["jurado_envios"]["Insert"];
type Supabase = Awaited<ReturnType<typeof createClient>>;

const UNA_HORA = 60 * 60 * 1000;
const LIMITE_RESEND = 30 * 24 * UNA_HORA; // Resend programa hasta 30 días antes
const RECORDATORIOS = ["recordatorio_24h", "recordatorio_1h"];
const ACTIVOS = ["programado", "simulado", "enviado"];

function volver(eventoId: string, tipo: "ok" | "error", mensaje: string): never {
  revalidatePath("/jurado/comunicaciones");
  redirect(`/jurado/comunicaciones?evento=${eventoId}&${tipo}=${encodeURIComponent(mensaje)}`);
}

async function preparar(formData: FormData) {
  await requireRol(); // solo admin
  const eventoId = String(formData.get("evento_id"));
  const supabase = await createClient();
  const datos = await cargarDatos(supabase, eventoId);
  if (!datos) volver(eventoId, "error", "No encontramos el evento.");
  return { eventoId, supabase, datos };
}

// Manda y deja registro de cada mail. Devuelve el error de Resend, si hubo.
async function mandarYRegistrar(supabase: Supabase, correos: Correo[], filas: Envio[]) {
  const resultado = await enviarCorreos(correos);
  const { error } = await supabase.from("jurado_envios").insert(filas.map((fila, i) => ({
    ...fila,
    estado: !resultado.ok ? "error" : modoPrueba() ? "simulado" : fila.programado_para ? "programado" : "enviado",
    resend_id: resultado.ok ? resultado.ids[i] : null,
    error: resultado.ok ? null : resultado.error,
  })));
  if (error) throw error;
  return resultado.ok ? null : resultado.error;
}

async function yaHay(supabase: Supabase, eventoId: string, tipos: string[]) {
  const { data, error } = await supabase
    .from("jurado_envios").select("id").eq("evento_id", eventoId).in("tipo", tipos).in("estado", ACTIVOS).limit(1);
  if (error) throw error;
  return data.length > 0;
}

const aviso = (mensaje: string) => (modoPrueba() ? `Simulado (falta la clave de Resend, no salió ningún mail): ${mensaje}` : mensaje);

export async function programarRecordatorios(formData: FormData) {
  const { eventoId, supabase, datos } = await preparar(formData);
  const { evento, jurados, proyectos, criterios } = datos;
  if (jurados.length === 0) volver(eventoId, "error", "No hay jurados cargados en Miembros.");
  if (await yaHay(supabase, eventoId, RECORDATORIOS)) {
    volver(eventoId, "error", "Ya hay recordatorios para este evento. Si cambió el horario, cancelalos y volvé a programarlos.");
  }

  const ahora = Date.now();
  const inicio = new Date(evento.inicio).getTime();
  const tandas = ([["recordatorio_24h", 24], ["recordatorio_1h", 1]] as const)
    .map(([tipo, horas]) => ({ tipo, cuando: inicio - horas * UNA_HORA }))
    .filter((t) => t.cuando > ahora + 60_000);
  if (tandas.length === 0) volver(eventoId, "error", "El evento ya empezó o falta menos de una hora: no quedan recordatorios por mandar.");
  const ultimo = Math.max(...tandas.map((t) => t.cuando));
  if (ultimo - ahora > LIMITE_RESEND) {
    volver(eventoId, "error", `Resend permite programar mails hasta 30 días antes. Vas a poder programar estos recordatorios desde el ${fechaHora(new Date(ultimo - LIMITE_RESEND).toISOString())}.`);
  }

  const url = await urlBase();
  const correos: Correo[] = [];
  const filas: Envio[] = [];
  for (const { tipo, cuando } of tandas) {
    const programadoPara = new Date(cuando).toISOString();
    for (const jurado of jurados) {
      const { asunto, html } = mailRecordatorio({ tipo, jurado: jurado.nombre, evento, proyectos, criterios, url });
      correos.push({ para: jurado.email, asunto, html, programadoPara });
      filas.push({ evento_id: eventoId, tipo, persona_id: jurado.id, email: jurado.email, asunto, programado_para: programadoPara, estado: "programado" });
    }
  }
  const error = await mandarYRegistrar(supabase, correos, filas);
  if (error) volver(eventoId, "error", error);
  const cuales = tandas.map((t) => (t.tipo === "recordatorio_24h" ? "24 h antes" : "1 h antes")).join(" y ");
  volver(eventoId, "ok", aviso(`Recordatorios programados (${cuales}) para ${jurados.length} jurados.`));
}

async function guardarMaterial(supabase: Supabase, eventoId: string, formData: FormData): Promise<Datos["material"]> {
  const texto = (campo: string) => String(formData.get(campo) ?? "").trim() || null;
  const { data, error } = await supabase.from("jurado_material_post").upsert({
    evento_id: eventoId,
    foto_1: texto("foto_1"),
    foto_2: texto("foto_2"),
    foto_3: texto("foto_3"),
    video: texto("video"),
    mensaje: texto("mensaje"),
    updated_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return data;
}

function armarPostEvento(datos: Datos, jurado: string) {
  const m = datos.material!;
  return mailPostEvento({
    jurado,
    evento: datos.evento,
    fotos: [m.foto_1!, m.foto_2!, m.foto_3!],
    video: m.video!,
    mensaje: m.mensaje,
    equipos: datos.proyectos,
  });
}

export async function guardarMaterialPost(formData: FormData) {
  const { eventoId, supabase } = await preparar(formData);
  await guardarMaterial(supabase, eventoId, formData);
  volver(eventoId, "ok", "Material guardado.");
}

export async function programarPostEvento(formData: FormData) {
  const { eventoId, supabase, datos } = await preparar(formData);
  datos.material = await guardarMaterial(supabase, eventoId, formData);
  const faltantes = faltantesPostEvento(datos);
  if (faltantes.length) volver(eventoId, "error", `No se puede mandar todavía. Falta: ${faltantes.join("; ")}.`);
  if (datos.jurados.length === 0) volver(eventoId, "error", "No hay jurados cargados en Miembros.");
  if (await yaHay(supabase, eventoId, ["post_evento"])) {
    volver(eventoId, "error", "El mail post-evento de este evento ya está programado o enviado.");
  }

  const ahora = Date.now();
  const cuando = new Date(diaSiguienteALas9(datos.evento.inicio)).getTime();
  if (cuando - ahora > LIMITE_RESEND) {
    volver(eventoId, "error", `Resend permite programar mails hasta 30 días antes. Vas a poder programarlo desde el ${fechaHora(new Date(cuando - LIMITE_RESEND).toISOString())}.`);
  }
  // Si ya pasaron las 9 del día siguiente, sale en el momento.
  const programadoPara = cuando > ahora + 60_000 ? new Date(cuando).toISOString() : undefined;

  const correos: Correo[] = [];
  const filas: Envio[] = [];
  for (const jurado of datos.jurados) {
    const { asunto, html } = armarPostEvento(datos, jurado.nombre);
    correos.push({ para: jurado.email, asunto, html, programadoPara });
    filas.push({ evento_id: eventoId, tipo: "post_evento", persona_id: jurado.id, email: jurado.email, asunto, programado_para: programadoPara ?? null, estado: "programado" });
  }
  const error = await mandarYRegistrar(supabase, correos, filas);
  if (error) volver(eventoId, "error", error);
  volver(eventoId, "ok", aviso(programadoPara
    ? `Mail post-evento programado para el ${fechaHora(programadoPara)} a ${datos.jurados.length} jurados.`
    : `Mail post-evento enviado a ${datos.jurados.length} jurados.`));
}

// Manda el mail al propio admin, en el momento, para revisar cómo llega.
export async function enviarPrueba(formData: FormData) {
  const { eventoId, supabase, datos } = await preparar(formData);
  const { email, persona } = await getUsuario();
  const nombre = persona?.nombre ?? "Jurado";
  let mail: { asunto: string; html: string };
  if (formData.get("tipo") === "post_evento") {
    datos.material = await guardarMaterial(supabase, eventoId, formData);
    const faltantes = faltantesPostEvento(datos);
    if (faltantes.length) volver(eventoId, "error", `Para la prueba también hace falta todo el material. Falta: ${faltantes.join("; ")}.`);
    mail = armarPostEvento(datos, nombre);
  } else {
    mail = mailRecordatorio({ tipo: "recordatorio_24h", jurado: nombre, ...datos, url: await urlBase() });
  }
  const asunto = `[Prueba] ${mail.asunto}`;
  const error = await mandarYRegistrar(supabase, [{ para: email, asunto, html: mail.html }], [
    { evento_id: eventoId, tipo: "prueba", persona_id: persona?.id ?? null, email, asunto, estado: "enviado" },
  ]);
  if (error) volver(eventoId, "error", error);
  volver(eventoId, "ok", aviso(`Te mandamos una prueba a ${email}.`));
}

// Si cambia el horario del evento: cancela lo que todavía no salió, para volver a programarlo.
export async function cancelarProgramados(formData: FormData) {
  const { eventoId, supabase } = await preparar(formData);
  const tipos = formData.get("grupo") === "post_evento" ? ["post_evento"] : RECORDATORIOS;
  const { data: pendientes, error } = await supabase
    .from("jurado_envios").select("id, resend_id")
    .eq("evento_id", eventoId).in("tipo", tipos).in("estado", ["programado", "simulado"])
    .gt("programado_para", new Date().toISOString());
  if (error) throw error;
  if (pendientes.length === 0) volver(eventoId, "error", "No hay mails pendientes para cancelar.");

  const cancelados: string[] = [];
  let fallo: string | null = null;
  for (const envio of pendientes) {
    const problema = envio.resend_id && !modoPrueba() ? await cancelarCorreo(envio.resend_id) : null;
    if (problema) fallo = problema;
    else cancelados.push(envio.id);
  }
  if (cancelados.length) {
    const { error: errorUpdate } = await supabase.from("jurado_envios").update({ estado: "cancelado" }).in("id", cancelados);
    if (errorUpdate) throw errorUpdate;
  }
  if (fallo) volver(eventoId, "error", `Se cancelaron ${cancelados.length} de ${pendientes.length}. ${fallo}`);
  volver(eventoId, "ok", `Se cancelaron ${cancelados.length} mails pendientes.`);
}
