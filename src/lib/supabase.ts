import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

// SecureStore values are limited to about 2 KB, and a Supabase session is
// larger, so native sessions are split across several keystore entries.
const CHUNK_SIZE = 1800;

const secureSessionStorage: SupportedStorage = {
  async getItem(key) {
    const count = Number(await SecureStore.getItemAsync(`${key}.chunks`));
    if (!count) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
    );
    return parts.some((part) => part === null) ? null : parts.join("");
  },
  async setItem(key, value) {
    await this.removeItem(key);
    const parts = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "gs")) ?? [];
    await Promise.all(parts.map((part, i) => SecureStore.setItemAsync(`${key}.${i}`, part)));
    await SecureStore.setItemAsync(`${key}.chunks`, String(parts.length));
  },
  async removeItem(key) {
    const count = Number(await SecureStore.getItemAsync(`${key}.chunks`));
    await Promise.all(
      Array.from({ length: count || 0 }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
    );
    await SecureStore.deleteItemAsync(`${key}.chunks`);
  },
};

// Only the public anon key belongs here. The service-role key must never be
// exposed through EXPO_PUBLIC_ variables.
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "missing-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // On web the SDK's own browser storage adapter is used.
    storage: Platform.OS === "web" ? undefined : secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

// Native apps only refresh the session while in the foreground.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
