// GRUPO ALUMNOS — "Agenda": cada alumno marca en qué franjas de la semana puede reunirse, y el grupo ve en qué
// horarios pueden todos. El mentor asignado y los profesores ven ese resumen (solo cantidades, no quién).
import { Suspense } from "react";
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { guardarDisponibilidad } from "./_acciones";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const FRANJAS = ["8 a 12", "12 a 16", "16 a 20", "20 a 23"];

async function Aviso({ searchParams }: Pick<PageProps<"/alumnos/agenda">, "searchParams">) {
  const { error, ok } = await searchParams;
  if (error) return <p className="mb-6 border bg-card px-4 py-3 text-sm text-destructive">{String(error)}</p>;
  if (ok) return <p className="mb-6 border bg-card px-4 py-3 text-sm">{String(ok)}</p>;
  return null;
}

type Celda = { dia: number; franja: number; pueden: number; integrantes: number; cargaron: number };

// Grilla del grupo: en cada franja, cuántos pueden. Resalta donde pueden todos.
function GrillaGrupo({ celdas }: { celdas: Celda[] }) {
  const total = celdas[0]?.integrantes ?? 0;
  const cargaron = celdas[0]?.cargaron ?? 0;
  const de = (d: number, f: number) => celdas.find((c) => c.dia === d && c.franja === f)?.pueden ?? 0;
  const todos = celdas.filter((c) => total > 0 && c.pueden === total);
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        {cargaron < total
          ? `Cargaron su disponibilidad ${cargaron} de ${total} integrantes.`
          : `Cargaron todos (${total}).`}{" "}
        {todos.length > 0
          ? `Pueden todos: ${todos.map((c) => `${DIAS[c.dia - 1].toLowerCase()} de ${FRANJAS[c.franja - 1]}`).join(", ")}.`
          : "Todavía no hay un horario en el que puedan todos."}
      </p>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1" />
              {DIAS.map((d) => <th key={d} className="px-2 py-1 font-normal text-[#666]">{d.slice(0, 3)}</th>)}
            </tr>
          </thead>
          <tbody>
            {FRANJAS.map((f, fi) => (
              <tr key={f}>
                <td className="whitespace-nowrap px-2 py-1 text-[#666]">{f}</td>
                {DIAS.map((_, di) => {
                  const n = de(di + 1, fi + 1);
                  return (
                    <td key={di} className="px-1 py-1">
                      <span
                        className={cn(
                          "grid size-10 place-items-center border tabular-nums",
                          total > 0 && n === total ? "border-primary bg-primary text-primary-foreground" : n > 0 ? "bg-card" : "bg-background text-[#666]",
                        )}
                        title={`${n} de ${total}`}
                      >
                        {n}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#666]">Cada casilla dice cuántos integrantes pueden en esa franja; en negro, donde pueden todos.</p>
    </div>
  );
}

export default async function Agenda({ searchParams }: PageProps<"/alumnos/agenda">) {
  const persona = await requireRol("alumno", "mentor");
  const esAlumno = persona.rol === "alumno";
  const supabase = await createClient();

  // Grupos que puede ver: el alumno los suyos, el mentor los asignados, los profesores todos.
  let proyectos: { id: string; nombre: string }[] = [];
  if (esAlumno) {
    const { data, error } = await supabase.from("proyecto_integrantes").select("proyectos(id, nombre)").eq("persona_id", persona.id);
    if (error) throw error;
    proyectos = data.map((d) => d.proyectos);
  } else {
    const { data, error } = await supabase.from("proyectos").select("id, nombre").order("nombre");
    if (error) throw error;
    if (persona.rol === "mentor") {
      const asignado = await Promise.all(
        data.map(async (p) => {
          const r = await supabase.rpc("alumnos_soy_mentor", { p_proyecto: p.id });
          if (r.error) throw r.error;
          return r.data;
        }),
      );
      proyectos = data.filter((_, i) => asignado[i]);
    } else {
      proyectos = data;
    }
  }
  const { proyecto: elegido } = await searchParams;
  const proyecto = proyectos.find((p) => p.id === elegido) ?? proyectos[0];

  const [mia, grupo] = await Promise.all([
    esAlumno ? supabase.from("alumnos_disponibilidad").select("dia, franja").eq("persona_id", persona.id) : Promise.resolve({ data: [], error: null }),
    proyecto ? supabase.rpc("alumnos_disponibilidad_grupo", { p_proyecto: proyecto.id }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (mia.error) throw mia.error;
  if (grupo.error) throw grupo.error;
  const marcada = new Set((mia.data ?? []).map((m) => `${m.dia}-${m.franja}`));

  return (
    <>
      <h1 className="mb-2 font-serif text-2xl">Agenda</h1>
      <p className="mb-6 max-w-2xl text-sm text-[#666]">
        {esAlumno
          ? "Marcá en qué horarios de la semana podés reunirte. Abajo ves en qué horarios puede todo tu grupo; el mentor del grupo y los profesores ven ese resumen para proponer reuniones."
          : "En qué horarios de la semana pueden reunirse los integrantes de cada grupo (solo cantidades)."}
      </p>
      <Suspense><Aviso searchParams={searchParams} /></Suspense>

      <div className="grid max-w-3xl gap-6">
        {esAlumno && (
          <form action={guardarDisponibilidad} className="grid gap-4 border bg-card p-6">
            <input type="hidden" name="proyecto_id" value={proyecto?.id ?? ""} />
            <h2 className="font-serif text-lg">Tu disponibilidad</h2>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-1" />
                    {DIAS.map((d) => <th key={d} className="px-2 py-1 font-normal text-[#666]">{d.slice(0, 3)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {FRANJAS.map((f, fi) => (
                    <tr key={f}>
                      <td className="whitespace-nowrap px-2 py-1 text-[#666]">{f}</td>
                      {DIAS.map((d, di) => {
                        const valor = `${di + 1}-${fi + 1}`;
                        return (
                          <td key={d} className="px-1 py-1">
                            <label className="grid size-10 cursor-pointer place-items-center border bg-background has-[:checked]:border-primary has-[:checked]:bg-primary">
                              <input
                                type="checkbox"
                                name="franja"
                                value={valor}
                                defaultChecked={marcada.has(valor)}
                                aria-label={`${d} de ${f}`}
                                className="size-4 accent-primary"
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div><Button type="submit" size="sm">Guardar mi disponibilidad</Button></div>
          </form>
        )}

        {proyectos.length > 1 && (
          <nav className="flex flex-wrap gap-2" aria-label="Grupo">
            {proyectos.map((p) => (
              <Link
                key={p.id}
                href={`/alumnos/agenda?proyecto=${p.id}`}
                className={cn("border px-3 py-1 text-sm", p.id === proyecto?.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-card")}
              >
                {p.nombre}
              </Link>
            ))}
          </nav>
        )}

        {proyecto ? (
          <section className="grid gap-3 border bg-card p-6">
            <h2 className="font-serif text-lg">{esAlumno ? `Tu grupo: ${proyecto.nombre}` : proyecto.nombre}</h2>
            <GrillaGrupo celdas={(grupo.data ?? []) as Celda[]} />
          </section>
        ) : (
          <p className="text-sm text-[#666]">
            {persona.rol === "mentor" ? "Todavía no te asignaron ningún grupo." : esAlumno ? "Cuando estés en un grupo, vas a ver acá los horarios en común." : "Todavía no hay grupos."}
          </p>
        )}
      </div>
    </>
  );
}
