// Stand-in for expo-secure-store: one key/value map per simulated device.
const stores = new Map<string, Map<string, string>>();
let current = new Map<string, string>();

export function useDeviceStore(name: string): void {
  if (!stores.has(name)) stores.set(name, new Map());
  current = stores.get(name)!;
}

export async function getItemAsync(key: string): Promise<string | null> {
  return current.get(key) ?? null;
}
export async function setItemAsync(key: string, value: string): Promise<void> {
  current.set(key, value);
}
export async function deleteItemAsync(key: string): Promise<void> {
  current.delete(key);
}
