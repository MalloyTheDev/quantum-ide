import { get, set } from 'idb-keyval';

const SESSION_KEY = 'quantum-ide:session:v1';

function canUseIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

export async function loadSession() {
  if (!canUseIndexedDb()) return null;
  try {
    return await get(SESSION_KEY);
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  if (!canUseIndexedDb()) return;
  try {
    await set(SESSION_KEY, {
      ...session,
      savedAt: Date.now(),
    });
  } catch {
    // Persistence is a convenience layer; never block the IDE on storage errors.
  }
}
