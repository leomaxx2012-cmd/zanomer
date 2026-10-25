import type { SupabaseClient } from "@supabase/supabase-js";

type SearchAlert = {
  owner_id: string; left_letter: string; right_letters: string; digits: string;
  region: string; region_code: string; vehicle_type: string; price_limit: number;
  enabled: boolean; updated_at: string;
};

// Older installations can have a different unique index. Locate only the
// caller's exact search instead of requiring a specific ON CONFLICT index.
export async function saveSearchAlert(client: SupabaseClient, payload: SearchAlert) {
  const { enabled, updated_at, ...criteria } = payload;
  const find = () => client.from("auto_search_alerts").select("id").match(criteria).limit(1).maybeSingle();
  const update = (id: string) => client.from("auto_search_alerts").update({ enabled, updated_at })
    .eq("id", id).eq("owner_id", payload.owner_id).select("id").single();
  const existing = await find();
  if (existing.error) return existing;
  if (existing.data) return update(existing.data.id);
  const inserted = await client.from("auto_search_alerts").insert(payload).select("id").single();
  if (inserted.error?.code !== "23505") return inserted;
  // Another request may have saved this exact search meanwhile. Do not retry
  // other failed writes or accidentally re-enable a different search.
  const concurrent = await find();
  return concurrent.data ? update(concurrent.data.id) : inserted;
}
