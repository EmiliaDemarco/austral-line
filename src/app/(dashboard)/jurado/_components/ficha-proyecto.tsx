// GRUPO JURADO — muestra la ficha de un proyecto (se usa en la ficha, la planilla y el tablero).
import type { Database } from "@/lib/database.types";
import { camposFicha, esLinkWeb, etapas } from "../_lib";

export type Ficha = Database["public"]["Tables"]["jurado_fichas"]["Row"];

export function FichaProyecto({ ficha }: { ficha: Ficha }) {
  const campos = camposFicha.filter(({ campo }) => ficha[campo]);
  return (
    <dl className="grid gap-6">
      {ficha.etapa && (
        <div>
          <dt className="text-xs text-[#666]">Etapa</dt>
          <dd className="mt-1">{etapas[ficha.etapa as keyof typeof etapas] ?? ficha.etapa}</dd>
        </div>
      )}
      {campos.map(({ campo, label }) => (
        <div key={campo}>
          <dt className="text-xs text-[#666]">{label}</dt>
          <dd className="mt-1 whitespace-pre-line">{ficha[campo]}</dd>
        </div>
      ))}
      {esLinkWeb(ficha.link_presentacion) && (
        <div>
          <dt className="text-xs text-[#666]">Presentación</dt>
          <dd className="mt-1">
            <a href={ficha.link_presentacion!} target="_blank" rel="noreferrer" className="break-all underline underline-offset-4 hover:text-primary">
              {ficha.link_presentacion}
            </a>
          </dd>
        </div>
      )}
    </dl>
  );
}
