// GRUPO ALUMNOS — esta carpeta es de ustedes.
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function Alumnos() {
  const supabase = await createClient();
  const { data: proyectos, error } = await supabase
    .from("proyectos")
    .select("id, nombre, estado, proyecto_integrantes(personas(nombre))")
    .order("created_at");
  if (error) throw error;

  return (
    <>
      <h1 className="mb-6 font-serif text-2xl">Proyectos</h1>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Proyecto</TableHead><TableHead>Integrantes</TableHead><TableHead>Estado</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {proyectos.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.nombre}</TableCell>
              <TableCell>{p.proyecto_integrantes.map((i) => i.personas.nombre).join(", ")}</TableCell>
              <TableCell><Badge variant="outline">{p.estado}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
