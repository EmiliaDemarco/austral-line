import { requireRol } from "@/lib/auth";
import { SubNav } from "./_components/subnav";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const persona = await requireRol("alumno");
  return (
    <>
      <SubNav esProfesor={persona.rol === "admin"} />
      {children}
    </>
  );
}
