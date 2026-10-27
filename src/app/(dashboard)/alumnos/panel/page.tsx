// GRUPO ALUMNOS — "Panel de profesores": métricas del armado de equipos (solo profesores / rol admin).
// Responde a las métricas de éxito del Agente de Armado de Grupos: cuántos alumnos cargaron su perfil,
// cuántos ya están en un proyecto, si los proyectos son interdisciplinarios y cómo se usa el banco de ideas.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const pct = (parte: number, total: number) => (total ? Math.round((parte / total) * 100) : 0);

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <div className="grid gap-1 border bg-background p-5">
      <p className="text-sm text-[#666]">{titulo}</p>
      <p className="font-serif text-4xl">{valor}</p>
      <p className="text-xs text-[#666]">{detalle}</p>
    </div>
  );
}

// Barras horizontales de una sola serie: nombre a la izquierda, barra proporcional y valor a la derecha.
function Barras({ filas, unidad }: { filas: { nombre: string; valor: number }[]; unidad: string }) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="grid gap-2">
      {filas.map((f) => (
        <li
          key={f.nombre}
          className="grid grid-cols-[minmax(0,12rem)_1fr_3rem] items-center gap-3 text-sm"
          title={`${f.nombre}: ${f.valor} ${unidad}`}
        >
          <span className="truncate">{f.nombre}</span>
          <span className="h-2 bg-muted">
            <span className="block h-2 bg-primary" style={{ width: `${(f.valor / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{f.valor}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function PanelDeProfesores() {
  await requireRol(); // sin roles = solo admin (profesores)
  const supabase = await createClient();

  const [alumnos, perfiles, carreras, maestroCarreras, intereses, temas, integrantes, ideas, interesados, mensajes] =
    await Promise.all([
      supabase.from("personas").select("id, nombre, email").eq("rol", "alumno").order("nombre"),
      supabase.from("alumnos_perfiles").select("persona_id, busca_equipo"),
      supabase.from("alumnos_carreras").select("persona_id, carrera_id"),
      supabase.from("alumnos_carreras_maestro").select("id, nombre").order("orden"),
      supabase.from("alumnos_intereses").select("persona_id, interes_id, estrellas"),
      supabase.from("alumnos_intereses_maestro").select("id, nombre").order("orden"),
      supabase.from("proyecto_integrantes").select("persona_id, proyecto_id, proyectos(nombre)"),
      supabase.from("alumnos_ideas").select("id, titulo, estado, created_at").order("created_at", { ascending: false }),
      supabase.from("alumnos_ideas_interesados").select("idea_id"),
      supabase.from("alumnos_ideas_mensajes").select("idea_id"),
    ]);
  for (const r of [alumnos, perfiles, carreras, maestroCarreras, intereses, temas, integrantes, ideas, interesados, mensajes]) {
    if (r.error) throw r.error;
  }

  const listaAlumnos = alumnos.data!;
  const total = listaAlumnos.length;
  const esAlumno = new Set(listaAlumnos.map((a) => a.id));
  const conPerfil = new Set(perfiles.data!.map((p) => p.persona_id));
  const buscan = perfiles.data!.filter((p) => p.busca_equipo).length;
  const enProyecto = new Set(integrantes.data!.filter((i) => esAlumno.has(i.persona_id)).map((i) => i.persona_id));
  const sinPerfil = listaAlumnos.filter((a) => !conPerfil.has(a.id));

  // Carreras de los alumnos que ya la eligieron.
  const carreraDe = new Map(carreras.data!.map((c) => [c.persona_id, c.carrera_id]));
  const porCarrera = maestroCarreras.data!.map((m) => ({
    nombre: m.nombre,
    valor: carreras.data!.filter((c) => c.carrera_id === m.id).length,
  }));

  // Temas: cuántos alumnos los calificaron con 4 o 5 estrellas.
  const porTema = temas.data!
    .map((t) => ({ nombre: t.nombre, valor: intereses.data!.filter((i) => i.interes_id === t.id && i.estrellas >= 4).length }))
    .sort((a, b) => b.valor - a.valor);

  // Interdisciplinariedad de cada proyecto, según la carrera de sus integrantes.
  const proyectos = new Map<string, { nombre: string; integrantes: string[] }>();
  for (const i of integrantes.data!) {
    const p = proyectos.get(i.proyecto_id) ?? { nombre: i.proyectos.nombre, integrantes: [] };
    p.integrantes.push(i.persona_id);
    proyectos.set(i.proyecto_id, p);
  }
  const filasProyectos = [...proyectos.entries()].map(([id, p]) => {
    const conocidas = p.integrantes.map((pid) => carreraDe.get(pid)).filter((c) => c !== undefined);
    const distintas = new Set(conocidas).size;
    const estado =
      distintas >= 2 ? "Interdisciplinario" : conocidas.length < p.integrantes.length ? "Faltan perfiles" : "Una sola carrera";
    return { id, nombre: p.nombre, cantidad: p.integrantes.length, distintas, estado };
  });
  const interdisciplinarios = filasProyectos.filter((p) => p.estado === "Interdisciplinario").length;

  // Banco de ideas.
  const cuenta = (filas: { idea_id: string }[]) => {
    const m = new Map<string, number>();
    for (const f of filas) m.set(f.idea_id, (m.get(f.idea_id) ?? 0) + 1);
    return m;
  };
  const interesadosDe = cuenta(interesados.data!);
  const mensajesDe = cuenta(mensajes.data!);
  const filasIdeas = ideas.data!
    .map((i) => ({ ...i, interesados: interesadosDe.get(i.id) ?? 0, mensajes: mensajesDe.get(i.id) ?? 0 }))
    .sort((a, b) => b.interesados - a.interesados);
  const ideasSinInteres = filasIdeas.filter((i) => i.estado === "disponible" && i.interesados === 0).length;

  return (
    <>
      <h1 className="mb-2 font-serif text-2xl">Panel de profesores</h1>
      <p className="mb-8 max-w-2xl text-sm text-[#666]">
        Cómo viene el armado de equipos: perfiles cargados, alumnos ya en un proyecto, interdisciplinariedad y uso del
        banco de ideas. Solo lo ven los profesores.
      </p>

      <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Completaron su perfil" valor={`${pct(conPerfil.size, total)}%`} detalle={`${conPerfil.size} de ${total} alumnos`} />
        <Indicador titulo="Buscan equipo" valor={String(buscan)} detalle={`${pct(buscan, total)}% de los alumnos`} />
        <Indicador titulo="Ya están en un proyecto" valor={`${pct(enProyecto.size, total)}%`} detalle={`${enProyecto.size} de ${total} alumnos`} />
        <Indicador
          titulo="Proyectos interdisciplinarios"
          valor={`${interdisciplinarios} de ${filasProyectos.length}`}
          detalle="Con integrantes de 2 o más carreras"
        />
      </section>

      <section className="mb-10 grid gap-8 lg:grid-cols-2">
        <div className="grid content-start gap-4 border bg-card p-6">
          <div>
            <h2 className="font-serif text-lg">Alumnos por carrera</h2>
            <p className="text-sm text-[#666]">Solo cuenta a quienes ya eligieron su carrera.</p>
          </div>
          <Barras filas={porCarrera} unidad="alumnos" />
        </div>
        <div className="grid content-start gap-4 border bg-card p-6">
          <div>
            <h2 className="font-serif text-lg">Temas que más interesan</h2>
            <p className="text-sm text-[#666]">Alumnos que calificaron el tema con 4 o 5 estrellas.</p>
          </div>
          <Barras filas={porTema} unidad="alumnos" />
        </div>
      </section>

      <section className="mb-10 grid gap-3">
        <h2 className="font-serif text-lg">Interdisciplinariedad por proyecto</h2>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Proyecto</TableHead><TableHead>Integrantes</TableHead><TableHead>Carreras distintas</TableHead><TableHead>Estado</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {filasProyectos.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.nombre}</TableCell>
                <TableCell className="tabular-nums">{p.cantidad}</TableCell>
                <TableCell className="tabular-nums">{p.distintas}</TableCell>
                <TableCell><Badge variant={p.estado === "Interdisciplinario" ? "default" : "outline"}>{p.estado}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-[#666]">“Faltan perfiles”: algún integrante todavía no eligió su carrera, así que no se puede saber.</p>
      </section>

      <section className="mb-10 grid gap-3">
        <h2 className="font-serif text-lg">Banco de ideas</h2>
        <p className="text-sm text-[#666]">
          {filasIdeas.length} ideas · {filasIdeas.filter((i) => i.estado === "tomada").length} tomadas ·{" "}
          {ideasSinInteres} disponibles sin ningún interesado.
        </p>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Idea</TableHead><TableHead>Estado</TableHead><TableHead>Interesados</TableHead><TableHead>Preguntas y respuestas</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {filasIdeas.map((i) => (
              <TableRow key={i.id}>
                <TableCell><Link href={`/alumnos/ideas/${i.id}`} className="underline-offset-4 hover:underline">{i.titulo}</Link></TableCell>
                <TableCell><Badge variant={i.estado === "tomada" ? "secondary" : "outline"}>{i.estado === "tomada" ? "Tomada" : "Disponible"}</Badge></TableCell>
                <TableCell className="tabular-nums">{i.interesados === 0 && i.estado === "disponible" ? "0 · nadie todavía" : i.interesados}</TableCell>
                <TableCell className="tabular-nums">{i.mensajes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-lg">Alumnos que todavía no completaron su perfil ({sinPerfil.length})</h2>
        {sinPerfil.length === 0 ? (
          <p className="text-sm text-[#666]">Todos los alumnos completaron su perfil.</p>
        ) : (
          <>
            <p className="text-sm text-[#666]">Sin perfil no aparecen en Compañeros afines. Podés escribirles para recordárselo.</p>
            <ul className="grid gap-1 text-sm">
              {sinPerfil.map((a) => (
                <li key={a.id}>
                  {a.nombre} · <a href={`mailto:${a.email}`} className="underline underline-offset-4 hover:text-[#666]">{a.email}</a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
