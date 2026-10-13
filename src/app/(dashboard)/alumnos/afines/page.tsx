// GRUPO ALUMNOS — "Compañeros afines": alumnos que buscan equipo, ordenados por afinidad.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { calcularAfinidad } from "../_lib/afinidad";

export default async function CompanerosAfines() {
  const persona = await requireRol("alumno");
  const supabase = await createClient();

  const [{ data: miPerfil, error: e1 }, { data: otros, error: e2 }, { data: integrantes, error: e3 }] = await Promise.all([
    supabase.from("alumnos_perfiles").select("*").eq("persona_id", persona.id).maybeSingle(),
    supabase
      .from("alumnos_perfiles")
      .select("persona_id, carrera, intereses, no_intereses, sobre_mi, personas(nombre, email)")
      .eq("busca_equipo", true)
      .neq("persona_id", persona.id),
    supabase.from("proyecto_integrantes").select("persona_id, proyectos(nombre)"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;

  if (!miPerfil) {
    return (
      <div className="flex max-w-xl flex-col items-start gap-4 border bg-card p-8">
        <h1 className="font-serif text-2xl">Primero, contanos de vos</h1>
        <p className="text-sm text-[#666]">
          Para sugerirte compañeros necesitamos tu carrera y los temas que te interesan. Te lleva un minuto.
        </p>
        <Link href="/alumnos/perfil" className={buttonVariants()}>Completar mi perfil</Link>
      </div>
    );
  }

  const proyectoDe = new Map(integrantes.map((i) => [i.persona_id, i.proyectos.nombre]));
  const sugerencias = otros
    .map((o) => ({ ...o, afinidad: calcularAfinidad(miPerfil, o) }))
    .sort((a, b) => b.afinidad.puntaje - a.afinidad.puntaje);

  return (
    <>
      <h1 className="mb-2 font-serif text-2xl">Compañeros afines</h1>
      <p className="mb-6 max-w-2xl text-sm text-[#666]">
        Alumnos que buscan equipo, ordenados por afinidad con vos: suman los temas en común y ser de otra carrera;
        restan los temas que a uno le interesan y al otro no. Es una sugerencia: la decisión es de ustedes.
      </p>

      {!miPerfil.busca_equipo && (
        <p className="mb-6 border bg-card px-4 py-3 text-sm">
          Tu perfil está privado: vos ves a los demás, pero ellos no te ven a vos.{" "}
          <Link href="/alumnos/perfil" className="underline underline-offset-4">Marcá “Busco equipo”</Link> para aparecer.
        </p>
      )}

      {sugerencias.length === 0 ? (
        <div className="border bg-card p-8 text-sm text-[#666]">Por ahora nadie más marcó “Busco equipo”. Volvé a mirar en unos días.</div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {sugerencias.map((s) => (
            <li key={s.persona_id} className="flex flex-col gap-4 border bg-background p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-serif text-xl">{s.personas.nombre}</p>
                  <p className="text-sm text-[#666]">{s.carrera}</p>
                </div>
                <Badge variant={s.afinidad.nivel === "Muy afín" ? "default" : "outline"}>{s.afinidad.nivel}</Badge>
              </div>

              <dl className="grid gap-2 text-sm">
                {s.afinidad.otraCarrera && (
                  <div><dt className="inline text-[#666]">Interdisciplinario: </dt><dd className="inline">es de otra carrera</dd></div>
                )}
                {s.afinidad.enComun.length > 0 && (
                  <div><dt className="inline text-[#666]">Temas en común: </dt><dd className="inline">{s.afinidad.enComun.join(", ")}</dd></div>
                )}
                {s.afinidad.choques.length > 0 && (
                  <div><dt className="inline text-[#666]">Ojo, no coinciden en: </dt><dd className="inline">{s.afinidad.choques.join(", ")}</dd></div>
                )}
                {proyectoDe.has(s.persona_id) && (
                  <div><dt className="inline text-[#666]">Ya participa en: </dt><dd className="inline">{proyectoDe.get(s.persona_id)}</dd></div>
                )}
              </dl>

              {s.sobre_mi && <p className="border-l-2 pl-3 text-sm italic">“{s.sobre_mi}”</p>}

              <a href={`mailto:${s.personas.email}`} className="mt-auto text-sm underline underline-offset-4 hover:text-[#666]">
                {s.personas.email}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
