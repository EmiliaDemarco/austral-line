// GRUPO JURADO — tablero de deliberación: suma sola los puntajes de todos los jurados y junta su feedback.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { estadosEvaluables, promedio } from "../_lib";

const formato = (n: number | undefined) => (n === undefined ? "—" : n.toFixed(1));

export default async function Deliberacion() {
  const persona = await requireRol("jurado");
  const supabase = await createClient();
  const [proyectos, criterios, jurados, evaluaciones] = await Promise.all([
    supabase.from("proyectos").select("id, nombre, estado, jurado_fichas(propuesta_valor)").in("estado", estadosEvaluables),
    supabase.from("jurado_criterios").select("id, nombre").order("orden"),
    supabase.from("personas").select("id", { count: "exact", head: true }).eq("rol", "jurado"),
    supabase
      .from("jurado_evaluaciones")
      .select("id, proyecto_id, jurado_id, propuesta_valor, comentarios, personas(nombre), jurado_puntajes(criterio_id, puntaje)")
      .order("updated_at"),
  ]);
  if (proyectos.error) throw proyectos.error;
  if (criterios.error) throw criterios.error;
  if (jurados.error) throw jurados.error;
  if (evaluaciones.error) throw evaluaciones.error;

  const ranking = proyectos.data
    .map((p) => {
      const evs = evaluaciones.data.filter((e) => e.proyecto_id === p.id);
      const puntajes = evs.flatMap((e) => e.jurado_puntajes);
      return {
        ...p,
        evaluaciones: evs,
        general: promedio(puntajes.map((x) => x.puntaje)),
        porCriterio: new Map(criterios.data.map((c) => [
          c.id,
          promedio(puntajes.filter((x) => x.criterio_id === c.id).map((x) => x.puntaje)),
        ])),
      };
    })
    .sort((a, b) => (b.general ?? -1) - (a.general ?? -1) || a.nombre.localeCompare(b.nombre));

  return (
    <>
      <Link href="/jurado" className="text-sm text-[#666] hover:text-primary">← Evaluar proyectos</Link>
      <div className="mt-6 mb-8">
        <h1 className="font-serif text-2xl">Deliberación</h1>
        <p className="mt-1 text-sm text-[#666]">Promedio de todos los jurados, de 1 a 10. Se actualiza cada vez que alguien guarda o ajusta su evaluación.</p>
      </div>

      {ranking.length === 0 ? (
        <div className="border p-10 text-center text-sm text-[#666]">Todavía no hay proyectos publicados para evaluar.</div>
      ) : (
        <>
          <Table className="mb-14">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Proyecto</TableHead>
                {criterios.data.map((c) => <TableHead key={c.id} className="text-right">{c.nombre}</TableHead>)}
                <TableHead className="text-right">Jurados</TableHead>
                <TableHead className="text-right">Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell className="text-[#666]">{p.general === undefined ? "" : i + 1}</TableCell>
                  <TableCell>
                    <a href={`#${p.id}`} className="font-medium hover:text-primary">{p.nombre}</a>
                  </TableCell>
                  {criterios.data.map((c) => (
                    <TableCell key={c.id} className="text-right text-[#666]">{formato(p.porCriterio.get(c.id))}</TableCell>
                  ))}
                  <TableCell className="text-right text-[#666]">{p.evaluaciones.length}/{jurados.count ?? 0}</TableCell>
                  <TableCell className="text-right font-serif text-2xl">{formato(p.general)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="grid gap-14">
            {ranking.map((p) => (
              <section key={p.id} id={p.id} className="scroll-mt-6">
                <div className="mb-4 flex items-baseline justify-between gap-4 border-b pb-3">
                  <h2 className="font-serif text-xl">{p.nombre} <Badge variant="outline" className="ml-2 align-middle capitalize">{p.estado}</Badge></h2>
                  <span className="font-serif text-xl">{formato(p.general)}</span>
                </div>
                {p.jurado_fichas?.propuesta_valor && (
                  <div className="mb-4 border-l-2 border-primary pl-4">
                    <p className="text-xs text-[#666]">Propuesta de valor oficial del equipo</p>
                    <p className="mt-1">{p.jurado_fichas.propuesta_valor}</p>
                  </div>
                )}
                {p.evaluaciones.length === 0 ? (
                  <p className="text-sm text-[#666]">Ningún jurado lo evaluó todavía.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {p.evaluaciones.map((e) => (
                      <article key={e.id} className="border bg-card p-5">
                        <div className="mb-4 flex items-baseline justify-between gap-4">
                          <span className="font-medium">
                            {e.personas.nombre}
                            {e.jurado_id === persona.id && <span className="ml-2 text-xs text-[#666]">(vos)</span>}
                          </span>
                          <span className="font-serif text-lg">{formato(promedio(e.jurado_puntajes.map((x) => x.puntaje)))}</span>
                        </div>
                        <dl className="grid gap-3 text-sm">
                          <div>
                            <dt className="text-xs text-[#666]">Propuesta de valor, según este jurado</dt>
                            <dd className="mt-1">{e.propuesta_valor ?? <span className="text-[#666]">Sin completar</span>}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-[#666]">Comentarios para el equipo</dt>
                            <dd className="mt-1 whitespace-pre-line">{e.comentarios ?? <span className="text-[#666]">Sin completar</span>}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
