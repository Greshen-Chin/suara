// Client Supabase dengan service_role key: melewati RLS, jadi HANYA boleh dipakai di server
// (server component, route handler, server action). `server-only` membuat build gagal
// kalau file ini sampai terimpor dari komponen "use client".
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    "SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di .env.local (atau environment hosting).",
  );
}

export const supabaseServer = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
