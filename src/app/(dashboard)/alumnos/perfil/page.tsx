// GRUPO ALUMNOS — "Mi perfil": carrera, cuánto le interesa cada tema (1 a 5 estrellas) y si busca equipo.
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CARRERAS } from "../_lib/catalogo";
import { Estrellas } from "../_components/estrellas";

const MINIMO_CALIFICADOS = 4;

const volverCon = (error: string) => redirect(`/alumnos/perfil?error=${encodeURIComponent(error)}`);

async function guardarPerfil(formData: FormData) {
  "use server";
  const persona = await requireRol("alumno");
  const supabase = await createClient();

  // La carrera se elige una sola vez: si ya hay perfil, se mantiene la guardada (la base además lo impide).
  const { data: existente } = await supabase.from("alumnos_perfiles").select("carrera").eq("persona_id", persona.id).maybeSingle();
  const carrera = existente?.carrera ?? String(formData.get("carrera") ?? "");
  if (!existente && !(CARRERAS as readonly string[]).includes(carrera)) volverCon("Elegí tu carrera de la lista.");

  const { data: maestro, error: errorMaestro } = await supabase.from("alumnos_intereses_maestro").select("id").eq("activo", true);
  if (errorMaestro) volverCon(`No se pudo leer el listado de intereses: ${errorMaestro.message}`);

  const respuestas = (maestro ?? []).map(({ id }) => ({ interes_id: id, estrellas: Number(formData.get(`interes_${id}`) ?? 0) }));
  const esValida = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;
  const calificadas = respuestas.filter((r) => esValida(r.estrellas));
  const sinCalificar = respuestas.filter((r) => !esValida(r.estrellas)).map((r) => r.interes_id);
  if (calificadas.length < MINIMO_CALIFICADOS) {
    volverCon(`Calificá al menos ${MINIMO_CALIFICADOS} temas (calificaste ${calificadas.length}).`);
  }

  const ahora = new Date().toISOString();
  const { error: errorPerfil } = await supabase.from("alumnos_perfiles").upsert({
    persona_id: persona.id,
    carrera,
    sobre_mi: String(formData.get("sobre_mi") ?? "").trim() || null,
    busca_equipo: formData.get("busca_equipo") === "on",
    updated_at: ahora,
  });
  if (errorPerfil) volverCon(`No se pudo guardar: ${errorPerfil.message}`);

  const { error: errorIntereses } = await supabase
    .from("alumnos_intereses")
    .upsert(calificadas.map((r) => ({ ...r, persona_id: persona.id, updated_at: ahora })));
  if (errorIntereses) volverCon(`No se pudieron guardar los intereses: ${errorIntereses.message}`);

  if (sinCalificar.length > 0) {
    const { error } = await supabase.from("alumnos_intereses").delete().eq("persona_id", persona.id).in("interes_id", sinCalificar);
    if (error) volverCon(`No se pudieron quitar calificaciones: ${error.message}`);
  }

  revalidatePath("/alumnos", "layout");
  redirect("/alumnos/perfil?ok=1");
}

async function Aviso({ searchParams }: Pick<PageProps<"/alumnos/perfil">, "searchParams">) {
  const { error, ok } = await searchParams;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (ok) return <p className="text-sm text-[#666]">Perfil guardado.</p>;
  return null;
}

export default async function MiPerfil({ searchParams }: PageProps<"/alumnos/perfil">) {
  const persona = await requireRol("alumno");
  const supabase = await createClient();
  const [{ data: perfil, error: e1 }, { data: maestro, error: e2 }, { data: misIntereses, error: e3 }] = await Promise.all([
    supabase.from("alumnos_perfiles").select("*").eq("persona_id", persona.id).maybeSingle(),
    supabase.from("alumnos_intereses_maestro").select("id, nombre").eq("activo", true).order("orden").order("nombre"),
    supabase.from("alumnos_intereses").select("interes_id, estrellas").eq("persona_id", persona.id),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;

  const estrellasDe = new Map(misIntereses.map((i) => [i.interes_id, i.estrellas]));

  return (
    <>
      <h1 className="mb-2 font-serif text-2xl">Mi perfil</h1>
      <p className="mb-8 max-w-2xl text-sm text-[#666]">
        Con esto te sugerimos compañeros afines para armar equipo: priorizamos gente de otras carreras
        (para cumplir la interdisciplinariedad) que quiera trabajar en los mismos temas que vos.
      </p>

      <form action={guardarPerfil} className="grid max-w-3xl gap-10">
        <section className="grid gap-4 border bg-card p-6">
          <h2 className="font-serif text-lg">Carrera</h2>
          {perfil ? (
            <div className="grid gap-1">
              <p className="font-serif text-xl">{perfil.carrera}</p>
              <p className="text-sm text-[#666]">La carrera queda fija una vez guardada. Si te equivocaste, pedile al admin que la corrija.</p>
            </div>
          ) : (
            <div className="grid max-w-sm gap-2">
              <Label htmlFor="carrera">¿Qué estudiás?</Label>
              <select id="carrera" name="carrera" required defaultValue="" className="h-8 border bg-background px-2 text-sm">
                <option value="" disabled>Elegí una carrera</option>
                {CARRERAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="text-sm text-[#666]">Elegila bien: una vez guardada no se puede cambiar.</p>
            </div>
          )}
        </section>

        <section className="grid gap-4 border bg-card p-6">
          <div>
            <h2 className="font-serif text-lg">¿Hacia dónde te gustaría llevar un proyecto?</h2>
            <p className="text-sm text-[#666]">
              Calificá cada tema de 1 a 5 estrellas: 1 es “no me interesa para nada” y 5 “me encantaría trabajar en esto”.
              Calificá al menos {MINIMO_CALIFICADOS} temas; los que dejes sin calificar no cuentan. Podés cambiarlos cuando quieras.
            </p>
          </div>
          <div className="grid gap-2">
            {maestro.map(({ id, nombre }) => (
              <div key={id} className="flex items-center justify-between gap-6 border bg-background px-4 py-3">
                <span className="min-w-0 text-sm">{nombre}</span>
                <Estrellas nombre={`interes_${id}`} valor={estrellasDe.get(id) ?? 0} tema={nombre} />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 border bg-card p-6">
          <h2 className="font-serif text-lg">Sobre vos</h2>
          <div className="grid gap-2">
            <Label htmlFor="sobre_mi">Contale a tus futuros compañeros qué te motiva o qué sabés hacer (opcional)</Label>
            <textarea
              id="sobre_mi"
              name="sobre_mi"
              rows={3}
              maxLength={400}
              defaultValue={perfil?.sobre_mi ?? ""}
              className="border bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="busca_equipo" defaultChecked={perfil?.busca_equipo ?? false} className="mt-0.5 accent-current" />
            <span>
              <strong className="font-medium">Busco equipo.</strong>{" "}
              <span className="text-[#666]">Si lo marcás, otros alumnos te ven como compañero afín, junto con tu mail. Si no, tu perfil queda privado.</span>
            </span>
          </label>
        </section>

        <div className="flex items-center gap-4">
          <Button type="submit">Guardar perfil</Button>
          <Suspense><Aviso searchParams={searchParams} /></Suspense>
        </div>
      </form>
    </>
  );
}
