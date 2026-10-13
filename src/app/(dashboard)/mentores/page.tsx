// GRUPO MENTORES — esta carpeta es de ustedes.
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function Mentores() {
  const supabase = await createClient();
  const { data: personas, error } = await supabase
    .from("personas")
    .select("id, nombre, email")
    .eq("rol", "mentor")
    .order("nombre");
  if (error) throw error;

  return (
    <>
      <h1 className="mb-6 font-serif text-2xl">Mentores</h1>
      <Table>
        <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
        <TableBody>
          {personas.map((p) => (
            <TableRow key={p.id}><TableCell>{p.nombre}</TableCell><TableCell>{p.email}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
