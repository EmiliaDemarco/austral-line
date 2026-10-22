// GRUPO JURADO — criterios de evaluación: qué puntúan los jurados. Solo el admin/organizador.
// Un criterio con notas no se borra: se desactiva y deja de pedirse en las evaluaciones nuevas.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BotonConfirmar } from "../_components/boton-confirmar";
import { borrarCriterio, cambiarEstado, crearCriterio, guardarCriterio, moverCriterio } from "./acciones";

export default async function Criterios({ searchParams }: PageProps<"/jurado/criterios">) {
  await requireRol(); // solo admin
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  const { data: criterios, error: errorCriterios } = await supabase
    .from("jurado_criterios").select("id, nombre, descripcion, activo").order("orden").order("nombre");
  if (errorCriterios) throw errorCriterios;
  // Cuántas notas tiene cada criterio: decide si se puede borrar o solo desactivar.
  const notas = await Promise.all(criterios.map(async (c) => {
    const { count, error: errorNotas } = await supabase.from("jurado_puntajes").select("criterio_id", { count: "exact", head: true }).eq("criterio_id", c.id);
    if (errorNotas) throw errorNotas;
    return [c.id, count ?? 0] as const;
  }));
  const cantidadNotas = new Map(notas);
  const activos = criterios.filter((c) => c.activo).length;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/jurado" className="text-sm text-[#666] hover:text-primary">← Proyectos</Link>
      <h1 className="mt-6 font-serif text-2xl">Criterios de evaluación</h1>
      <p className="mt-1 mb-8 text-sm text-[#666]">
        Lo que puntúan los jurados, de 1 a 10. Los criterios activos se piden en cada evaluación y se promedian en las devoluciones.
      </p>

      {typeof ok === "string" && <p className="mb-6 border-l-2 border-primary pl-4 text-sm">{ok}</p>}
      {typeof error === "string" && <p role="alert" className="mb-6 border-l-2 border-destructive pl-4 text-sm text-destructive">{error}</p>}

      <p className="mb-8 border-l-2 border-primary pl-4 text-sm text-[#666]">
        Ojo si hay evaluaciones en curso: al sumar un criterio, las evaluaciones ya cargadas quedan incompletas hasta que cada jurado lo puntúe.
        Desactivar uno no toca sus notas, los promedios ni las devoluciones ya publicadas.
      </p>

      <section className="mb-14">
        <div className="border">
          {criterios.map((c, i) => {
            const usadas = cantidadNotas.get(c.id) ?? 0;
            return (
              <div key={c.id} className="grid gap-4 border-b p-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={c.activo ? "outline" : "destructive"}>{c.activo ? "Activo" : "Desactivado"}</Badge>
                  <span className="text-sm text-[#666]">
                    {usadas === 0 ? "Sin notas todavía" : `${usadas} ${usadas === 1 ? "nota cargada" : "notas cargadas"}`}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <form action={moverCriterio}>
                      <input type="hidden" name="criterio_id" value={c.id} />
                      <input type="hidden" name="direccion" value="subir" />
                      <Button type="submit" variant="ghost" size="sm" disabled={i === 0} aria-label={`Subir ${c.nombre}`}>Subir</Button>
                    </form>
                    <form action={moverCriterio}>
                      <input type="hidden" name="criterio_id" value={c.id} />
                      <input type="hidden" name="direccion" value="bajar" />
                      <Button type="submit" variant="ghost" size="sm" disabled={i === criterios.length - 1} aria-label={`Bajar ${c.nombre}`}>Bajar</Button>
                    </form>
                  </div>
                </div>

                <form action={guardarCriterio} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                  <input type="hidden" name="criterio_id" value={c.id} />
                  <div className="grid gap-2">
                    <Label htmlFor={`nombre-${c.id}`} className="text-xs text-[#666]">Nombre</Label>
                    <Input id={`nombre-${c.id}`} name="nombre" defaultValue={c.nombre} required maxLength={60} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`descripcion-${c.id}`} className="text-xs text-[#666]">Qué se evalúa (lo ve el jurado)</Label>
                    <Input id={`descripcion-${c.id}`} name="descripcion" defaultValue={c.descripcion ?? ""} maxLength={200} />
                  </div>
                  <Button type="submit" variant="outline" size="sm">Guardar</Button>
                </form>

                <div className="flex flex-wrap items-center gap-4">
                  <form action={cambiarEstado}>
                    <input type="hidden" name="criterio_id" value={c.id} />
                    <input type="hidden" name="activar" value={c.activo ? "no" : "si"} />
                    {c.activo ? (
                      <BotonConfirmar
                        mensaje={`¿Desactivar "${c.nombre}"? Deja de pedirse en las evaluaciones nuevas. Sus notas anteriores se conservan.`}
                        disabled={activos <= 1}
                      >
                        Desactivar
                      </BotonConfirmar>
                    ) : (
                      <Button type="submit" variant="ghost" size="sm">Activar de nuevo</Button>
                    )}
                  </form>
                  {c.activo && activos <= 1 && <span className="text-xs text-[#666]">Tiene que quedar al menos un criterio activo.</span>}
                  {usadas === 0 && (
                    <form action={borrarCriterio}>
                      <input type="hidden" name="criterio_id" value={c.id} />
                      <BotonConfirmar mensaje={`¿Borrar "${c.nombre}"? No tiene notas, así que no se pierde nada.`} disabled={c.activo && activos <= 1}>
                        Borrar
                      </BotonConfirmar>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-serif text-xl">Sumar un criterio</h2>
        <p className="mb-6 text-sm text-[#666]">Queda activo y al final de la lista. Podés reordenarlo después.</p>
        <form action={crearCriterio} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="nombre-nuevo">Nombre</Label>
            <Input id="nombre-nuevo" name="nombre" required maxLength={60} placeholder="Por ejemplo, Impacto" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="descripcion-nuevo">Qué se evalúa (lo ve el jurado)</Label>
            <Input id="descripcion-nuevo" name="descripcion" maxLength={200} placeholder="¿Qué le tiene que mirar el jurado?" />
          </div>
          <Button type="submit" size="lg">Sumar criterio</Button>
        </form>
      </section>
    </div>
  );
}
