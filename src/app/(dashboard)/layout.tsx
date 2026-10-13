import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MobileNav, Sidebar } from "@/components/sidebar";

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function UsuarioActual() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.email;
}

// Layout del dashboard al estilo Midday: rail de 70px + header de 70px + contenido px-8.
// cacheComponents está activo: todo lo que lee datos va dentro de <Suspense>.
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  const salir = (
    <form action={logout}>
      <button className="text-sm text-[#666] hover:text-primary">Cerrar sesión</button>
    </form>
  );

  return (
    <div className="relative">
      <Sidebar footer={salir} />
      <div className="pb-4 md:ml-[70px]">
        <header className="flex h-[70px] items-center justify-between gap-4 border-b px-4 md:px-8">
          <MobileNav />
          <span className="ml-auto truncate text-sm text-[#666]"><Suspense><UsuarioActual /></Suspense></span>
        </header>
        <main className="px-4 py-6 md:px-8">
          <Suspense fallback={<p className="text-sm text-[#666]">Cargando…</p>}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
