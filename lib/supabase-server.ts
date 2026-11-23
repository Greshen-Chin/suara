// Client Supabase dengan service_role key: melewati RLS, jadi HANYA boleh dipakai di server
// (server component, route handler, server action). `server-only` membuat build gagal
// kalau file ini sampai terimpor dari komponen "use client".
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = process.env.SUPABASE_URL || "https://placeholder-project.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "PERINGATAN: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi. Aplikasi akan menggunakan fallback data.",
    );
  }
}

export const supabaseServer = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
