// GRUPO JURADO — reglas compartidas entre las pantallas del grupo.

// Los borradores todavía no se presentan, así que no se evalúan (la base también lo impide).
export const estadosEvaluables = ["publicado", "finalista", "ganador"];

export const promedio = (numeros: number[]) =>
  numeros.length ? numeros.reduce((a, b) => a + b, 0) / numeros.length : undefined;
