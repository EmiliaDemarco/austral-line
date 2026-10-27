"use client";

// GRUPO ALUMNOS — formulario para subir una versión nueva de una entrega.
// El archivo va directo al almacenamiento (con una URL firmada), así no hay límite de tamaño del servidor.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { prepararSubida, registrarEntrega } from "../_acciones";

const LIMITE_MB = 50;

export function SubirEntrega({ proyectoId, eventoId, hayVersiones }: { proyectoId: string; eventoId: string; hayVersiones: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState<{ subiendo: boolean; error?: string; ok?: string }>({ subiendo: false });

  async function subir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await intentarSubir(e.currentTarget);
    } catch {
      setEstado({ subiendo: false, error: "Algo falló al subir. Probá de nuevo." });
    }
  }

  async function intentarSubir(form: HTMLFormElement) {
    const archivo = (form.elements.namedItem("archivo") as HTMLInputElement).files?.[0];
    const nota = (form.elements.namedItem("nota") as HTMLTextAreaElement).value;
    if (!archivo) return setEstado({ subiendo: false, error: "Elegí un archivo." });
    if (archivo.size > LIMITE_MB * 1024 * 1024) return setEstado({ subiendo: false, error: `El archivo supera los ${LIMITE_MB} MB.` });

    setEstado({ subiendo: true });
    const preparada = await prepararSubida(proyectoId, eventoId, archivo.name, archivo.size);
    if ("error" in preparada) return setEstado({ subiendo: false, error: preparada.error });

    const cuerpo = new FormData();
    cuerpo.append("cacheControl", "3600");
    cuerpo.append("", archivo);
    const respuesta = await fetch(preparada.signedUrl, { method: "PUT", body: cuerpo, headers: { "x-upsert": "false" } }).catch(
      () => null,
    );
    if (!respuesta?.ok) return setEstado({ subiendo: false, error: "No se pudo subir el archivo. Revisá tu conexión y probá de nuevo." });

    const registro = await registrarEntrega({
      proyectoId,
      eventoId,
      version: preparada.version,
      path: preparada.path,
      nombre: archivo.name,
      tamano: archivo.size,
      nota,
    });
    if ("error" in registro) return setEstado({ subiendo: false, error: registro.error });
    form.reset();
    setEstado({ subiendo: false, ok: `Listo: se subió la versión ${preparada.version}.` });
    router.refresh();
  }

  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">{hayVersiones ? "Subir una versión nueva" : "Subir la entrega"}</summary>
      <form onSubmit={subir} className="mt-3 grid gap-3 border bg-background p-4">
        <input type="file" name="archivo" required className="text-sm" />
        <textarea
          name="nota"
          rows={2}
          maxLength={500}
          placeholder="¿Qué cambió en esta versión? (opcional)"
          aria-label="Nota de la versión"
          className="border bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring"
        />
        <p className="text-xs text-[#666]">Hasta {LIMITE_MB} MB. Las versiones anteriores no se borran: queda el historial.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={estado.subiendo}>{estado.subiendo ? "Subiendo…" : "Subir"}</Button>
          {estado.error && <span className="text-destructive">{estado.error}</span>}
          {estado.ok && <span className="text-[#666]">{estado.ok}</span>}
        </div>
      </form>
    </details>
  );
}
