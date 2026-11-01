// GRUPO ALUMNOS — grupos con los que el grupo del alumno podría unirse (solo una sugerencia).
// Lo calcula la base (alumnos_grupos_compatibles): juntos no pasan de 6, comparten temas y suman carreras.
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

const MAXIMO = 2;

export async function GruposCompatibles({ proyectoId }: { proyectoId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("alumnos_grupos_compatibles");
  if (error) throw error;

  const otros = (data ?? [])
    .filter((p) => p.proyecto_a === proyectoId || p.proyecto_b === proyectoId)
    .map((p) => {
      const soyA = p.proyecto_a === proyectoId;
      return {
        id: soyA ? p.proyecto_b : p.proyecto_a,
        nombre: soyA ? p.nombre_b : p.nombre_a,
        integrantes: soyA ? p.integrantes_b : p.integrantes_a,
        suman: soyA ? p.carreras_solo_b : p.carreras_solo_a,
        total: p.integrantes_a + p.integrantes_b,
        comunes: p.temas_comunes,
        choques: p.choques,
      };
    })
    .slice(0, MAXIMO);
  if (otros.length === 0) return null;

  const { data: miembros, error: e2 } = await supabase
    .from("proyecto_integrantes")
    .select("proyecto_id, personas(nombre, email)")
    .in("proyecto_id", otros.map((o) => o.id));
  if (e2) throw e2;

  return (
    <section className="grid gap-3 border-t pt-4">
      <div>
        <h3 className="font-serif text-base">Grupos con los que podrían unirse</h3>
        <p className="text-xs text-[#666]">
          Es solo una sugerencia: juntos no pasarían de 6, comparten temas o suman carreras. Si les interesa, hablen con
          ellos y pídanles el cambio a los profesores.
        </p>
      </div>
      <ul className="grid gap-2">
        {otros.map((o) => (
          <li key={o.id} className="grid gap-2 border bg-background px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{o.nombre}</span>
              <span className="text-[#666]">· {o.integrantes} {o.integrantes === 1 ? "integrante" : "integrantes"} · juntos serían {o.total}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {o.suman.map((c) => <Badge key={c}>Suma {c}</Badge>)}
              {o.comunes.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
            </div>
            {o.choques.length > 0 && <p className="text-xs text-[#666]">Ojo, no coinciden en: {o.choques.join(", ")}.</p>}
            <p className="text-xs text-[#666]">
              {(miembros ?? [])
                .filter((m) => m.proyecto_id === o.id)
                .map((m) => `${m.personas.nombre} (${m.personas.email})`)
                .join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
