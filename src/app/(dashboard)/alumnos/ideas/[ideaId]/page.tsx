// GRUPO ALUMNOS — página de una idea del banco (vista de exploración pedida por la cátedra).
// El alumno lee la problemática a fondo, pregunta y conversa antes de comprometerse con un grupo.
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cambiarEstado, cambiarInteres, guardarContexto, publicarMensaje } from "../_acciones";

const CONTEXTO = [
  { campo: "a_quien_le_pasa", titulo: "¿A quién le pasa?" },
  { campo: "que_se_intento", titulo: "¿Qué se intentó hasta ahora?" },
  { campo: "como_seria_resuelto", titulo: "¿Cómo nos daríamos cuenta de que está resuelto?" },
] as const;

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" });

async function Aviso({ searchParams }: Pick<PageProps<"/alumnos/ideas/[ideaId]">, "searchParams">) {
  const { error } = await searchParams;
  return error ? <p className="mb-6 border bg-card px-4 py-3 text-sm text-destructive">{error}</p> : null;
}

export default async function PaginaDeIdea({ params, searchParams }: PageProps<"/alumnos/ideas/[ideaId]">) {
  const { ideaId } = await params;
  const persona = await requireRol("alumno");
  const esAlumno = persona.rol === "alumno";
  const supabase = await createClient();

  const { data: idea, error } = await supabase
    .from("alumnos_ideas")
    .select("*, autor:personas!alumnos_ideas_autor_id_fkey(nombre, rol), alumnos_intereses_maestro(nombre)")
    .eq("id", ideaId)
    .maybeSingle();
  if (error?.code === "22P02") notFound(); // id con formato inválido
  if (error) throw error;
  if (!idea) notFound();

  const [interesados, mensajes, parecidas, carreras] = await Promise.all([
    supabase.from("alumnos_ideas_interesados").select("persona_id, personas(nombre, email)").eq("idea_id", idea.id),
    supabase
      .from("alumnos_ideas_mensajes")
      .select("id, texto, created_at, respuesta_a, autor_id, autor:personas(nombre, rol)")
      .eq("idea_id", idea.id)
      .order("created_at"),
    idea.interes_id
      ? supabase
          .from("alumnos_ideas")
          .select("id, titulo, estado")
          .eq("interes_id", idea.interes_id)
          .neq("id", idea.id)
          .order("created_at", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("alumnos_carreras").select("persona_id, alumnos_carreras_maestro(nombre)"),
  ]);
  for (const r of [interesados, mensajes, parecidas, carreras]) if (r.error) throw r.error;

  const volver = `/alumnos/ideas/${idea.id}`;
  const tomada = idea.estado === "tomada";
  const puedoEditar = idea.autor_id === persona.id || persona.rol === "admin";
  const meInteresa = interesados.data!.some((i) => i.persona_id === persona.id);
  const carreraDe = new Map(carreras.data!.map((c) => [c.persona_id, c.alumnos_carreras_maestro.nombre]));
  const autorIdea = !idea.autor ? "autor desconocido" : idea.autor.rol === "admin" ? "los profesores" : idea.autor.nombre;
  const contextoCargado = CONTEXTO.filter(({ campo }) => idea[campo]);

  const preguntas = mensajes.data!.filter((m) => !m.respuesta_a);
  const respuestasDe = (id: string) => mensajes.data!.filter((m) => m.respuesta_a === id);
  const firma = (m: (typeof preguntas)[number]) => (
    <p className="flex flex-wrap items-center gap-2 text-xs text-[#666]">
      <span className="font-medium text-primary">{m.autor?.rol === "admin" ? "Profesores" : (m.autor?.nombre ?? "Alguien")}</span>
      {m.autor_id && m.autor_id === idea.autor_id && <Badge variant="outline">Autor de la idea</Badge>}
      <span>{fecha(m.created_at)}</span>
    </p>
  );

  return (
    <article className="max-w-3xl">
      <Link href="/alumnos/ideas" className="text-sm text-[#666] underline-offset-4 hover:text-primary hover:underline">
        ← Banco de ideas
      </Link>

      <header className="mt-6 mb-8 grid gap-3">
        <div className="flex flex-wrap gap-2">
          {idea.alumnos_intereses_maestro && <Badge variant="outline">{idea.alumnos_intereses_maestro.nombre}</Badge>}
          {tomada && <Badge variant="secondary">Tomada</Badge>}
        </div>
        <h1 className="font-serif text-3xl">{idea.titulo}</h1>
        <p className="text-sm text-[#666]">Propuesta por {autorIdea} · {fecha(idea.created_at)}</p>
        <p className="mt-2 whitespace-pre-line">{idea.descripcion}</p>
      </header>

      <Suspense><Aviso searchParams={searchParams} /></Suspense>

      {/* Contexto ampliado */}
      <section className="mb-10 grid gap-6 border-t pt-8">
        <h2 className="font-serif text-xl">Contexto</h2>
        {contextoCargado.length === 0 && !puedoEditar && (
          <p className="text-sm text-[#666]">Quien propuso la idea todavía no sumó más contexto. Podés preguntarle abajo.</p>
        )}
        {contextoCargado.map(({ campo, titulo }) => (
          <div key={campo} className="grid gap-1">
            <h3 className="text-sm font-medium">{titulo}</h3>
            <p className="text-sm whitespace-pre-line text-[#666]">{idea[campo]}</p>
          </div>
        ))}
        {puedoEditar && (
          <details className="border bg-card p-6" open={contextoCargado.length === 0}>
            <summary className="cursor-pointer text-sm font-medium">
              {contextoCargado.length === 0 ? "Sumá contexto para que otros entiendan mejor el problema" : "Editar contexto"}
            </summary>
            <form action={guardarContexto} className="mt-4 grid gap-4">
              <input type="hidden" name="idea_id" value={idea.id} />
              <input type="hidden" name="volver" value={volver} />
              {CONTEXTO.map(({ campo, titulo }) => (
                <div key={campo} className="grid gap-2">
                  <Label htmlFor={campo}>{titulo}</Label>
                  <textarea
                    id={campo}
                    name={campo}
                    rows={2}
                    maxLength={1000}
                    defaultValue={idea[campo] ?? ""}
                    className="border bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring"
                  />
                </div>
              ))}
              <div><Button type="submit" size="sm">Guardar contexto</Button></div>
            </form>
          </details>
        )}
      </section>

      {/* Interesados */}
      <section className="mb-10 grid gap-4 border-t pt-8">
        <h2 className="font-serif text-xl">
          Interesados <span className="text-base text-[#666]">({interesados.data!.length})</span>
        </h2>
        {interesados.data!.length === 0 ? (
          <p className="text-sm text-[#666]">Todavía nadie marcó interés.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {interesados.data!.map((i) => (
              <li key={i.persona_id}>
                {i.personas.nombre}
                {carreraDe.has(i.persona_id) && <span className="text-[#666]"> · {carreraDe.get(i.persona_id)}</span>}
                {" · "}
                <a href={`mailto:${i.personas.email}`} className="underline underline-offset-4 hover:text-[#666]">{i.personas.email}</a>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {esAlumno && !tomada && (
            <form action={cambiarInteres}>
              <input type="hidden" name="idea_id" value={idea.id} />
              <input type="hidden" name="volver" value={volver} />
              <input type="hidden" name="accion" value={meInteresa ? "quitar" : "sumar"} />
              <Button type="submit" size="sm" variant={meInteresa ? "outline" : "default"}>
                {meInteresa ? "Ya no me interesa" : "Me interesa"}
              </Button>
            </form>
          )}
          {puedoEditar && (
            <form action={cambiarEstado}>
              <input type="hidden" name="idea_id" value={idea.id} />
              <input type="hidden" name="volver" value={volver} />
              <input type="hidden" name="estado" value={tomada ? "disponible" : "tomada"} />
              <Button type="submit" size="sm" variant="outline">{tomada ? "Volver a disponible" : "Marcar como tomada"}</Button>
            </form>
          )}
        </div>
      </section>

      {/* Preguntas y respuestas */}
      <section className="mb-10 grid gap-6 border-t pt-8">
        <div>
          <h2 className="font-serif text-xl">Preguntas y respuestas</h2>
          <p className="text-sm text-[#666]">Alumnos y profesores pueden preguntar o responder. Así se conoce mejor el problema antes de sumarse.</p>
        </div>

        {preguntas.length === 0 && <p className="text-sm text-[#666]">Todavía no hay preguntas. ¡Hacé la primera!</p>}

        <ol className="grid gap-4">
          {preguntas.map((p) => (
            <li key={p.id} className="grid gap-3 border bg-background p-5">
              {firma(p)}
              <p className="text-sm whitespace-pre-line">{p.texto}</p>
              {respuestasDe(p.id).length > 0 && (
                <ol className="grid gap-3 border-l-2 pl-4">
                  {respuestasDe(p.id).map((r) => (
                    <li key={r.id} className="grid gap-1">
                      {firma(r)}
                      <p className="text-sm whitespace-pre-line">{r.texto}</p>
                    </li>
                  ))}
                </ol>
              )}
              {(
                <details>
                  <summary className="cursor-pointer text-sm text-[#666] hover:text-primary">Responder</summary>
                  <form action={publicarMensaje} className="mt-3 grid gap-2">
                    <input type="hidden" name="idea_id" value={idea.id} />
                    <input type="hidden" name="volver" value={volver} />
                    <input type="hidden" name="respuesta_a" value={p.id} />
                    <textarea
                      name="texto"
                      required
                      minLength={2}
                      maxLength={1000}
                      rows={2}
                      aria-label="Tu respuesta"
                      className="border bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring"
                    />
                    <div><Button type="submit" size="sm" variant="outline">Responder</Button></div>
                  </form>
                </details>
              )}
            </li>
          ))}
        </ol>

        {(
          <form action={publicarMensaje} className="grid gap-2 border bg-card p-5">
            <input type="hidden" name="idea_id" value={idea.id} />
            <input type="hidden" name="volver" value={volver} />
            <Label htmlFor="nueva_pregunta">Hacé una pregunta</Label>
            <textarea
              id="nueva_pregunta"
              name="texto"
              required
              minLength={2}
              maxLength={1000}
              rows={3}
              className="border bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring"
            />
            <div><Button type="submit" size="sm">Publicar pregunta</Button></div>
          </form>
        )}
      </section>

      {/* Ideas parecidas */}
      {parecidas.data!.length > 0 && (
        <section className="grid gap-3 border-t pt-8">
          <h2 className="font-serif text-xl">Ideas parecidas</h2>
          <p className="text-sm text-[#666]">Del mismo tema, para comparar y no repetir.</p>
          <ul className="grid gap-2">
            {parecidas.data!.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <Link href={`/alumnos/ideas/${p.id}`} className="underline underline-offset-4 hover:text-[#666]">{p.titulo}</Link>
                {p.estado === "tomada" && <Badge variant="secondary">Tomada</Badge>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
