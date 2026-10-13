// GRUPO JURADO — página para proyectos que no existen o links mal copiados.
import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="mx-auto max-w-3xl border p-10 text-center">
      <h1 className="font-serif text-2xl">No encontramos ese proyecto</h1>
      <p className="mt-2 text-sm text-[#666]">Puede que el link esté mal copiado o que el proyecto ya no exista.</p>
      <Link href="/jurado" className="mt-6 inline-block text-sm underline underline-offset-4 hover:text-primary">Volver a los proyectos</Link>
    </div>
  );
}
