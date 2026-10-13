// GRUPO JURADO — reglas compartidas entre las pantallas del grupo.

// Los borradores todavía no se presentan, así que no se evalúan (la base también lo impide).
export const estadosEvaluables = ["publicado", "finalista", "ganador"];

export const promedio = (numeros: number[]) =>
  numeros.length ? numeros.reduce((a, b) => a + b, 0) / numeros.length : undefined;

export const etapas = {
  idea: "Idea",
  prototipo: "Prototipo / MVP",
  primeras_ventas: "Primeras ventas",
  creciendo: "Creciendo",
} as const;

// Campos de texto de la ficha, en el orden en que se muestran y se cargan.
export const camposFicha = [
  { campo: "problema", label: "Problema" },
  { campo: "solucion", label: "Solución" },
  { campo: "propuesta_valor", label: "Propuesta de valor" },
  { campo: "mercado", label: "Mercado y cliente" },
  { campo: "modelo_negocio", label: "Modelo de negocio" },
  { campo: "traccion", label: "Tracción y métricas" },
] as const;

// Solo links web: evita que un link mal cargado ejecute algo al hacer clic.
export const esLinkWeb = (link: string | null) => !!link && /^https?:\/\//i.test(link);
