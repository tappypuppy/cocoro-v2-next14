import { createClient, SupabaseClient } from "@supabase/supabase-js";

export default class DB {
  public supabaseClient: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    this.supabaseClient = supabase;
  }
}
