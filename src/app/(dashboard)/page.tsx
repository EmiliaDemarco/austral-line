import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Inicio() {
  const supabase = await createClient();
  const contar = async (tabla: "personas" | "proyectos" | "eventos") =>
    (await supabase.from(tabla).select("*", { count: "exact", head: true })).count ?? 0;
  const [personas, proyectos, eventos] = await Promise.all([
    contar("personas"), contar("proyectos"), contar("eventos"),
  ]);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[["Personas", personas], ["Proyectos", proyectos], ["Eventos", eventos]].map(([label, n]) => (
        <Card key={label}>
          <CardHeader><CardTitle className="text-sm font-normal text-[#666]">{label}</CardTitle></CardHeader>
          <CardContent className="font-serif text-4xl">{n}</CardContent>
        </Card>
      ))}
    </div>
  );
}
