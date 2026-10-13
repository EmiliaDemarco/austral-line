// GRUPO ALUMNOS — cómo se calcula qué tan afín es otro alumno.
// Suma por intereses en común y por ser de otra carrera (interdisciplinariedad);
// resta cuando a uno le interesa un tema que el otro marcó como "no me interesa".

export type PerfilAfinidad = {
  carrera: string;
  intereses: string[];
  no_intereses: string[];
};

export const PUNTOS = { temaEnComun: 2, otraCarrera: 3, choque: 3 } as const;

export function calcularAfinidad(yo: PerfilAfinidad, otro: PerfilAfinidad) {
  const enComun = yo.intereses.filter((t) => otro.intereses.includes(t));
  const choques = [
    ...yo.intereses.filter((t) => otro.no_intereses.includes(t)),
    ...otro.intereses.filter((t) => yo.no_intereses.includes(t)),
  ];
  const otraCarrera = yo.carrera.trim().toLowerCase() !== otro.carrera.trim().toLowerCase();
  const puntaje =
    enComun.length * PUNTOS.temaEnComun + (otraCarrera ? PUNTOS.otraCarrera : 0) - choques.length * PUNTOS.choque;

  const nivel = puntaje >= 5 ? "Muy afín" : puntaje >= 2 ? "Afín" : "Poco afín";
  return { puntaje, nivel, enComun, choques: [...new Set(choques)], otraCarrera };
}
