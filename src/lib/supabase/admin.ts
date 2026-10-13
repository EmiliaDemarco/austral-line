import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Salta RLS y administra usuarios. Solo en el servidor y después de requireRol("admin").
export const createAdminClient = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
