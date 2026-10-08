export const WOW_CACHE_KEY = 'ttrpg_wow_character_v15';

export interface WowCacheRoot {
  v: 1;
  savedAt: string;
  character: string | null;
  turnState: string | null;
  simPending: string | null;
  monsters: string | null;
  legacy: Record<string, string>;
}

const NEXT_CACHE_KEY = 'wow_next_cache_v1';
const LEGACY_KEYS = ['wow_turn_state', 'sim_runs_pending', 'ttrpg_wow_monsters'] as const;

function blankRoot(): WowCacheRoot {
  return { v: 1, savedAt: new Date().toISOString(), character: null, turnState: null, simPending: null, monsters: null, legacy: {} };
}

function isV1(raw: string): boolean {
  try {
    const r = JSON.parse(raw);
    return !!r && r.v === 1;
  } catch {
    return false;
  }
}

export function readCacheRaw(): string | null {
  try {
    return localStorage.getItem(WOW_CACHE_KEY);
  } catch {
    return null;
  }
}

export function readCacheRoot(): WowCacheRoot {
  const raw = readCacheRaw();
  if (!raw || !isV1(raw)) return blankRoot();
  try {
    const r = JSON.parse(raw) as Partial<WowCacheRoot>;
    return {
      v: 1,
      savedAt: r.savedAt || new Date().toISOString(),
      character: r.character ?? null,
      turnState: r.turnState ?? null,
      simPending: r.simPending ?? null,
      monsters: r.monsters ?? null,
      legacy: r.legacy ?? {},
    };
  } catch {
    return blankRoot();
  }
}

export function writeCacheRoot(r: WowCacheRoot): void {
  try {
    r.savedAt = new Date().toISOString();
    localStorage.setItem(WOW_CACHE_KEY, JSON.stringify(r));
  } catch {
    // caché opcional
  }
}

export function getCharacter(): string | null {
  return readCacheRoot().character;
}

export function setCharacter(json: string): void {
  const r = readCacheRoot();
  r.character = json;
  writeCacheRoot(r);
}

export function getTurnState(): string | null {
  return readCacheRoot().turnState;
}

export function setTurnState(json: string | null): void {
  const r = readCacheRoot();
  r.turnState = json;
  writeCacheRoot(r);
}

export function clearTurnState(): void {
  setTurnState(null);
}

export function getSimPending(): string | null {
  return readCacheRoot().simPending;
}

export function setSimPending(json: string): void {
  const r = readCacheRoot();
  r.simPending = json;
  writeCacheRoot(r);
}

export function getMonsters(): string | null {
  return readCacheRoot().monsters;
}

export function setMonsters(json: string): void {
  const r = readCacheRoot();
  r.monsters = json;
  writeCacheRoot(r);
}

/** Recupera un valor que la app nueva (wow_rpg_next) pudo mover a su caché
 *  (bajo legacy) y borrar de aquí, para no perder la partida antigua. */
function recoverFromNextApp(kind: 'character' | 'turnState' | 'simPending' | 'monsters'): string | null {
  try {
    const raw = localStorage.getItem(NEXT_CACHE_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (!r || !r.legacy) return null;
    const map: Record<string, string> = r.legacy;
    const key =
      kind === 'character' ? 'ttrpg_wow_character_v15' :
      kind === 'turnState' ? 'wow_turn_state' :
      kind === 'simPending' ? 'sim_runs_pending' : 'ttrpg_wow_monsters';
    return map[key] ?? null;
  } catch {
    return null;
  }
}

type CacheSlot = 'character' | 'turnState' | 'simPending' | 'monsters';

let hygieneDone = false;

export function ensureLocalCacheHygiene(): void {
  if (hygieneDone) return;
  hygieneDone = true;
  try {
    const raw = readCacheRaw();
    const root = raw && isV1(raw) ? readCacheRoot() : blankRoot();
    if (raw && !isV1(raw)) {
      root.character = raw;
    }
    const slots: Record<string, CacheSlot> = {
      ttrpg_wow_monsters: 'monsters',
      sim_runs_pending: 'simPending',
      wow_turn_state: 'turnState',
    };
    for (const key of LEGACY_KEYS) {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) {
          const slot = slots[key];
          if (!root[slot]) root[slot] = value;
          root.legacy[key] = value;
          localStorage.removeItem(key);
        }
      } catch {
        // seguimos con el resto de claves
      }
    }
    const pending: CacheSlot[] = ['character', 'turnState', 'simPending', 'monsters'];
    for (const slot of pending) {
      if (root[slot] === null) {
        const recovered = recoverFromNextApp(slot);
        if (recovered !== null) root[slot] = recovered;
      }
    }
    writeCacheRoot(root);
  } catch {
    // si fracasa la higiene, la app sigue funcionando sin caché limpia
  }
}
