// Small key-value storage for device preferences (the chosen language).
// Native builds keep it in the OS keystore; web uses localStorage.
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") return globalThis.localStorage?.setItem(key, value);
  return SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === "web") return globalThis.localStorage?.removeItem(key);
  return SecureStore.deleteItemAsync(key);
}
