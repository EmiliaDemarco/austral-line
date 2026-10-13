// GRUPO JURADO — ficha de un proyecto, para que el jurado llegue informado al pitch y la consulte después.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { FichaProyecto } from "../../_components/ficha-proyecto";

export default async function FichaDelProyecto({ params }: PageProps<"/jurado/fichas/[proyectoId]">) {
  const { proyectoId } = await params;
  const persona = await requireRol("jurado");
  const supabase = await createClient();

  const { data: proyecto, error } = await supabase
    .from("proyectos")
    .select("id, nombre, descripcion, estado, proyecto_integrantes(personas(nombre)), jurado_fichas(*)")
    .eq("id", proyectoId)
    .maybeSingle();
  if (error?.code === "22P02") notFound(); // id con formato inválido
  if (error) throw error;
  if (!proyecto) notFound();

  const ficha = proyecto.jurado_fichas;
  const integrantes = proyecto.proyecto_integrantes.map((i) => i.personas.nombre);
  const esAdmin = persona.rol === "admin";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/jurado" className="text-sm text-[#666] hover:text-primary">← Todos los proyectos</Link>

      <header className="mt-6 mb-10 border-b pb-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-serif text-3xl">{proyecto.nombre}</h1>
          <Badge variant="outline" className="mt-2 capitalize">{proyecto.estado}</Badge>
        </div>
        {proyecto.descripcion && <p className="mt-2 text-[#666]">{proyecto.descripcion}</p>}
        {integrantes.length > 0 && <p className="mt-4 text-sm text-[#666]">Equipo: {integrantes.join(", ")}</p>}
      </header>

      {ficha ? (
        <FichaProyecto ficha={ficha} />
      ) : (
        <div className="border p-10 text-center text-sm text-[#666]">
          Este proyecto todavía no tiene ficha.
          {esAdmin && <span className="block mt-1">Cargala para que el jurado llegue informado al pitch.</span>}
        </div>
      )}

      <div className="mt-10 flex justify-end gap-3 border-t pt-6">
        {esAdmin && (
          <Link href={`/jurado/fichas/${proyecto.id}/editar`} className={buttonVariants({ variant: "outline", size: "lg" })}>
            {ficha ? "Editar ficha" : "Cargar ficha"}
          </Link>
        )}
        <Link href={`/jurado/evaluar/${proyecto.id}`} className={buttonVariants({ size: "lg" })}>Evaluar proyecto</Link>
      </div>
    </div>
  );
}
