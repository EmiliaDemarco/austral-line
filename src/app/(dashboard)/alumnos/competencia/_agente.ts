// GRUPO ALUMNOS — Agente de Competencia y Originalidad.
// Paso 1: con el breve del grupo, la IA busca en internet (búsqueda de Perplexity, a través del AI Gateway)
// competidores, alternativas y sustitutos actuales. Paso 2: con lo que encontró arma el análisis estructurado.
// Reglas: solo menciona competidores que aparecieron en la búsqueda, cada uno con su fuente; nunca dice que la
// idea es "original" o "única" de forma absoluta; desafía la propuesta con preguntas, no la califica.
import { gateway, generateText, jsonSchema, Output, stepCountIs } from "ai";

export const MODELO = "anthropic/claude-sonnet-5.5";
export const hayIA = () => !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);

export type Breve = { nombre: string; problema: string; solucion: string; publico: string; mercado: string };

export type Competidor = {
  nombre: string;
  tipo: "directo" | "indirecto" | "sustituto";
  que_hace: string;
  parecido: string;
  diferencia: string;
  fuente: string;
};

export type Resultado = {
  resumen: string;
  competidores: Competidor[];
  diferenciales: string[];
  alertas: string[];
  preguntas: string[];
  fuentes: { titulo: string; url: string }[];
};

const schema = jsonSchema<Omit<Resultado, "fuentes">>({
  type: "object",
  properties: {
    resumen: {
      type: "string",
      description: "2 a 4 oraciones: cómo está el terreno competitivo para esta propuesta en el mercado indicado. Sin decir que es original o única.",
    },
    competidores: {
      type: "array",
      description: "De 0 a 8 competidores reales que aparecieron en la búsqueda. Si no se encontró ninguno, lista vacía.",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "Nombre de la empresa, producto u organización." },
          tipo: {
            type: "string",
            enum: ["directo", "indirecto", "sustituto"],
            description: "directo: resuelve lo mismo para el mismo público; indirecto: otra solución al mismo problema; sustituto: lo que la gente hace hoy en vez de usar una solución (planillas, WhatsApp, un intermediario…).",
          },
          que_hace: { type: "string", description: "Qué ofrece, en una oración." },
          parecido: { type: "string", description: "En qué se parece a la propuesta del grupo, en una oración." },
          diferencia: { type: "string", description: "En qué se diferencia de la propuesta del grupo, en una oración." },
          fuente: { type: "string", description: "La URL exacta, de la lista de fuentes encontradas, que respalda este competidor." },
        },
        required: ["nombre", "tipo", "que_hace", "parecido", "diferencia", "fuente"],
        additionalProperties: false,
      },
    },
    diferenciales: {
      type: "array",
      items: { type: "string" },
      description: "2 a 5 diferenciales posibles de la propuesta frente a lo encontrado, en condicional (\"podría diferenciarse si…\").",
    },
    alertas: {
      type: "array",
      items: { type: "string" },
      description: "0 a 4 riesgos u obstáculos que muestra la competencia (un jugador fuerte, barreras de entrada, regulación…).",
    },
    preguntas: {
      type: "array",
      items: { type: "string" },
      description: "4 a 6 preguntas incómodas y concretas que desafíen la propuesta, como las haría un jurado.",
    },
  },
  required: ["resumen", "competidores", "diferenciales", "alertas", "preguntas"],
  additionalProperties: false,
});

const instruccionesBusqueda = `Sos el Agente de Competencia y Originalidad del concurso de Emprendimientos de la Universidad Austral.
Investigás en internet el terreno competitivo de la propuesta de un grupo de alumnos.
- Usá la herramienta de búsqueda varias veces, con búsquedas distintas: competidores directos en el mercado indicado,
  soluciones parecidas en otros países, alternativas indirectas y lo que la gente usa hoy en lugar de una solución.
- Buscá en español y en inglés.
- Al final, escribí notas de lo que encontraste: cada competidor con qué hace y la URL donde lo viste.
- No inventes empresas ni datos: solo lo que aparece en los resultados.`;

const instruccionesAnalisis = `Sos el Agente de Competencia y Originalidad del concurso de Emprendimientos de la Universidad Austral.
Con la propuesta del grupo y las notas de la búsqueda en internet, armás un análisis de competencia.
Reglas:
- Mencioná SOLO competidores que estén en las notas, y en "fuente" poné una URL exacta de la lista de fuentes.
- Nunca digas que la idea es "original", "única", "innovadora" o que "no tiene competencia". Si encontraste poco,
  decí que la búsqueda no encontró competidores directos, que eso no significa que no existan, y sugerí buscar más.
- No califiques ni puntúes la idea. Tu trabajo es ayudar al grupo a pensar, no aprobarla ni rechazarla.
- Las preguntas tienen que desafiar la propuesta de verdad, a partir de lo encontrado.
Respondé en español rioplatense, claro y concreto.`;

type FuenteEncontrada = { titulo: string; url: string };

// Junta las URLs que devolvió la búsqueda (sin repetir), para validar las fuentes del análisis.
function fuentesDe(pasos: { content: unknown[] }[]): FuenteEncontrada[] {
  const vistas = new Map<string, FuenteEncontrada>();
  for (const paso of pasos) {
    for (const parte of paso.content as { type?: string; output?: unknown }[]) {
      if (parte.type !== "tool-result") continue;
      const salida = parte.output as { results?: { title?: string; url?: string }[] } | undefined;
      for (const r of salida?.results ?? []) {
        if (r.url && /^https?:\/\//.test(r.url) && !vistas.has(r.url)) vistas.set(r.url, { titulo: r.title || r.url, url: r.url });
      }
    }
  }
  return [...vistas.values()];
}

export async function analizarCompetencia(breve: Breve): Promise<Resultado> {
  const propuesta = JSON.stringify(
    {
      proyecto: breve.nombre,
      problema: breve.problema,
      solucion: breve.solucion,
      a_quien_apunta: breve.publico,
      mercado: breve.mercado,
    },
    null,
    2,
  );

  const busqueda = await generateText({
    model: MODELO,
    instructions: instruccionesBusqueda,
    prompt: `Investigá la competencia de esta propuesta:\n${propuesta}`,
    tools: { buscar_en_internet: gateway.tools.perplexitySearch({ maxResults: 8, searchLanguageFilter: ["es", "en"] }) },
    stopWhen: stepCountIs(6),
  });
  const fuentes = fuentesDe(busqueda.steps);

  const { output } = await generateText({
    model: MODELO,
    instructions: instruccionesAnalisis,
    output: Output.object({ schema }),
    prompt: JSON.stringify({ propuesta: JSON.parse(propuesta), notas_de_la_busqueda: busqueda.text, fuentes }, null, 2),
  });

  // Un competidor sin una fuente que haya aparecido en la búsqueda no se muestra: así no se cuelan inventos.
  const urls = new Set(fuentes.map((f) => f.url));
  const limpiar = (xs: string[], max: number) => xs.map((x) => x.trim()).filter(Boolean).slice(0, max);
  return {
    resumen: output.resumen.trim(),
    competidores: output.competidores.filter((c) => urls.has(c.fuente)).slice(0, 8),
    diferenciales: limpiar(output.diferenciales, 5),
    alertas: limpiar(output.alertas, 4),
    preguntas: limpiar(output.preguntas, 6),
    fuentes,
  };
}
