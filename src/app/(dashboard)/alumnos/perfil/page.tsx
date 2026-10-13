// GRUPO ALUMNOS — "Mi perfil": carrera, temas que interesan y que no, y si busca equipo.
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CARRERAS, TEMAS } from "../_lib/catalogo";

const OPCIONES = [
  { valor: "si", label: "Me interesa" },
  { valor: "neutral", label: "Me da igual" },
  { valor: "no", label: "No me interesa" },
] as const;

async function guardarPerfil(formData: FormData) {
  "use server";
  const persona = await requireRol("alumno");

  const carrera = String(formData.get("carrera") ?? "");
  if (!(CARRERAS as readonly string[]).includes(carrera)) {
    redirect(`/alumnos/perfil?error=${encodeURIComponent("Elegí tu carrera de la lista.")}`);
  }

  const intereses = TEMAS.filter((_, i) => formData.get(`tema_${i}`) === "si");
  const no_intereses = TEMAS.filter((_, i) => formData.get(`tema_${i}`) === "no");
  if (intereses.length === 0) redirect(`/alumnos/perfil?error=${encodeURIComponent("Marcá al menos un tema que te interese.")}`);

  const supabase = await createClient();
  const { error } = await supabase.from("alumnos_perfiles").upsert({
    persona_id: persona.id,
    carrera,
    intereses: [...intereses],
    no_intereses: [...no_intereses],
    sobre_mi: String(formData.get("sobre_mi") ?? "").trim() || null,
    busca_equipo: formData.get("busca_equipo") === "on",
    updated_at: new Date().toISOString(),
  });
  if (error) redirect(`/alumnos/perfil?error=${encodeURIComponent(`No se pudo guardar: ${error.message}`)}`);

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
  const { data: perfil, error } = await supabase
    .from("alumnos_perfiles")
    .select("*")
    .eq("persona_id", persona.id)
    .maybeSingle();
  if (error) throw error;

  const carreraGuardada = perfil && (CARRERAS as readonly string[]).includes(perfil.carrera) ? perfil.carrera : "";
  const valorTema = (tema: string) =>
    perfil?.intereses.includes(tema) ? "si" : perfil?.no_intereses.includes(tema) ? "no" : "neutral";

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
          <div className="grid max-w-sm gap-2">
            <Label htmlFor="carrera">¿Qué estudiás?</Label>
            <select
              id="carrera"
              name="carrera"
              required
              defaultValue={carreraGuardada}
              className="h-8 border bg-background px-2 text-sm"
            >
              <option value="" disabled>Elegí una carrera</option>
              {CARRERAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </section>

        <section className="grid gap-4 border bg-card p-6">
          <div>
            <h2 className="font-serif text-lg">¿Hacia dónde te gustaría llevar un proyecto?</h2>
            <p className="text-sm text-[#666]">Marcá al menos un tema que te interese. Lo que no te interesa también cuenta.</p>
          </div>
          <div className="divide-y border bg-background">
            {TEMAS.map((tema, i) => (
              <fieldset key={tema} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <legend className="float-left text-sm sm:float-none">{tema}</legend>
                <div className="flex gap-4">
                  {OPCIONES.map(({ valor, label }) => (
                    <label key={valor} className="flex items-center gap-1.5 text-sm text-[#666] has-checked:text-primary">
                      <input
                        type="radio"
                        name={`tema_${i}`}
                        value={valor}
                        defaultChecked={valorTema(tema) === valor}
                        className="accent-current"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
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
