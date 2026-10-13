// GRUPO JURADO — carga y edición de la ficha de un proyecto. Solo el admin/organizador.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { camposFicha, esLinkWeb, etapas } from "../../../_lib";

async function guardarFicha(formData: FormData) {
  "use server";
  await requireRol(); // solo admin
  const proyectoId = String(formData.get("proyecto_id"));
  const texto = (campo: string) => String(formData.get(campo) ?? "").trim() || null;
  const etapa = texto("etapa");
  // Si pegan "notion.so/..." sin https://, se lo agregamos. Lo que no sea un link web no se guarda,
  // pero el resto de la ficha sí, para no perder lo que escribieron.
  const pegado = texto("link_presentacion");
  const link = pegado && !/^[a-z][a-z0-9+.-]*:/i.test(pegado) ? `https://${pegado}` : pegado;
  const linkInvalido = !!link && !esLinkWeb(link);

  const supabase = await createClient();
  const { error } = await supabase.from("jurado_fichas").upsert({
    proyecto_id: proyectoId,
    ...Object.fromEntries(camposFicha.map(({ campo }) => [campo, texto(campo)])),
    etapa: etapa && etapa in etapas ? etapa : null,
    link_presentacion: linkInvalido ? null : link,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  revalidatePath("/jurado", "layout");
  redirect(`/jurado/fichas/${proyectoId}${linkInvalido ? "?aviso=link" : ""}`);
}

const ayuda: Record<(typeof camposFicha)[number]["campo"], string> = {
  problema: "¿Qué dolor tiene el cliente hoy?",
  solucion: "¿Cómo lo resuelven?",
  propuesta_valor: "La oficial del equipo. En la deliberación se compara con lo que entendió cada jurado.",
  mercado: "¿A quién le venden y qué tan grande es la oportunidad?",
  modelo_negocio: "¿Cómo ganan plata? Precio, suscripción, comisión…",
  traccion: "Clientes, pilotos, ventas, métricas.",
};

export default async function EditarFicha({ params }: PageProps<"/jurado/fichas/[proyectoId]/editar">) {
  const { proyectoId } = await params;
  await requireRol(); // solo admin
  const supabase = await createClient();

  const { data: proyecto, error } = await supabase
    .from("proyectos")
    .select("id, nombre, jurado_fichas(*)")
    .eq("id", proyectoId)
    .maybeSingle();
  if (error?.code === "22P02") notFound();
  if (error) throw error;
  if (!proyecto) notFound();
  const ficha = proyecto.jurado_fichas;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/jurado/fichas/${proyecto.id}`} className="text-sm text-[#666] hover:text-primary">← Volver a la ficha</Link>
      <h1 className="mt-6 mb-2 font-serif text-3xl">{proyecto.nombre}</h1>
      <p className="mb-10 text-sm text-[#666]">Ficha para el jurado. Podés pegar el contenido desde Notion; todos los campos son opcionales.</p>

      <form action={guardarFicha} className="grid gap-8">
        <input type="hidden" name="proyecto_id" value={proyecto.id} />

        <div className="grid gap-2">
          <Label htmlFor="etapa">Etapa</Label>
          <select id="etapa" name="etapa" defaultValue={ficha?.etapa ?? ""} className="h-9 border bg-background px-2 text-sm">
            <option value="">Sin definir</option>
            {Object.entries(etapas).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
          </select>
        </div>

        {camposFicha.map(({ campo, label }) => (
          <div key={campo} className="grid gap-2">
            <Label htmlFor={campo}>{label}</Label>
            <p className="text-sm text-[#666]">{ayuda[campo]}</p>
            <textarea
              id={campo}
              name={campo}
              rows={3}
              defaultValue={ficha?.[campo] ?? ""}
              className="w-full border bg-transparent p-3 text-sm outline-none focus-visible:border-ring"
            />
          </div>
        ))}

        <div className="grid gap-2">
          <Label htmlFor="link_presentacion">Link a la presentación o Notion</Label>
          <Input id="link_presentacion" name="link_presentacion" inputMode="url" placeholder="https://www.notion.so/…" defaultValue={ficha?.link_presentacion ?? ""} />
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background py-4">
          <Link href={`/jurado/fichas/${proyecto.id}`} className="flex h-9 items-center px-3 text-sm text-[#666] hover:text-primary">Cancelar</Link>
          <Button type="submit" size="lg">Guardar ficha</Button>
        </div>
      </form>
    </div>
  );
}
