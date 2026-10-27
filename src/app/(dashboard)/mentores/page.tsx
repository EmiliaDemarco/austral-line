// GRUPO MENTORES — esta carpeta es de ustedes.
import Link from "next/link";
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-2xl">Mentores</h1>
        <Link href="/mentores/reuniones" className="text-sm text-[#666] underline underline-offset-4 hover:text-primary">
          Reuniones y resúmenes pre-reunión
        </Link>
      </div>
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
