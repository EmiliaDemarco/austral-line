// GRUPO JURADO — esta carpeta es de ustedes.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { estadosEvaluables } from "./_lib";

export default async function Jurado() {
  const persona = await requireRol("jurado");
  const supabase = await createClient();
  const [proyectos, evaluaciones] = await Promise.all([
    supabase.from("proyectos").select("id, nombre, descripcion, estado").in("estado", estadosEvaluables).order("nombre"),
    supabase.from("jurado_evaluaciones").select("proyecto_id, jurado_puntajes(puntaje)").eq("jurado_id", persona.id),
  ]);
  if (proyectos.error) throw proyectos.error;
  if (evaluaciones.error) throw evaluaciones.error;

  const promedios = new Map(evaluaciones.data.map((e) => {
    const puntajes = e.jurado_puntajes.map((p) => p.puntaje);
    return [e.proyecto_id, puntajes.reduce((a, b) => a + b, 0) / (puntajes.length || 1)];
  }));
  const evaluados = proyectos.data.filter((p) => promedios.has(p.id)).length;
  const esJurado = persona.rol === "jurado";

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl">{esJurado ? "Evaluar proyectos" : "Proyectos a evaluar"}</h1>
          <p className="mt-1 text-sm text-[#666]">
            {esJurado
              ? "Puntuá cada criterio de 1 a 10. Podés volver y ajustar tus notas hasta la deliberación."
              : "Como administrador podés ver las planillas, pero las notas las cargan solo los jurados."}
          </p>
        </div>
        {esJurado && (
          <p className="shrink-0 sm:text-right">
            <span className="font-serif text-3xl">{evaluados}/{proyectos.data.length}</span>
            <span className="block text-xs text-[#666]">evaluados</span>
          </p>
        )}
      </div>

      {proyectos.data.length === 0 ? (
        <div className="border p-10 text-center text-sm text-[#666]">Todavía no hay proyectos publicados para evaluar.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow><TableHead>Proyecto</TableHead><TableHead className="hidden sm:table-cell">Estado</TableHead><TableHead className="text-right">{esJurado ? "Tu promedio" : ""}</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {proyectos.data.map((p) => {
              const promedio = promedios.get(p.id);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/jurado/evaluar/${p.id}`} className="block py-2 hover:text-primary">
                      <span className="font-medium">{p.nombre}</span>
                      {p.descripcion && <span className="hidden text-[#666] sm:block">{p.descripcion}</span>}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="capitalize">{p.estado}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Link href={`/jurado/evaluar/${p.id}`} className="hover:text-primary">
                      {!esJurado
                        ? <span className="text-sm text-[#666] underline underline-offset-4">Ver planilla</span>
                        : promedio === undefined
                        ? <span className="text-sm text-[#666] underline underline-offset-4">Evaluar</span>
                        : <span className="font-serif text-xl">{promedio.toFixed(1)}</span>}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
}
