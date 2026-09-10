export interface SkillDef {
  id: string;
  name: string;
  category: string;
}

export const SKILL_CATEGORIES: { key: string; label: string }[] = [
  { key: 'fisicas', label: 'Físicas' },
  { key: 'sociales', label: 'Sociales' },
  { key: 'exploracion', label: 'Exploración' },
  { key: 'artesania', label: 'Artesanía' },
  { key: 'magia', label: 'Magia y Saber' },
];

export const SKILLS: SkillDef[] = [
  { id: 'correr', name: 'Correr', category: 'fisicas' },
  { id: 'saltar', name: 'Saltar', category: 'fisicas' },
  { id: 'nadar', name: 'Nadar', category: 'fisicas' },
  { id: 'trepar', name: 'Trepar', category: 'fisicas' },
  { id: 'resistir', name: 'Resistir', category: 'fisicas' },
  { id: 'robar', name: 'Robar', category: 'sociales' },
  { id: 'cantar', name: 'Cantar', category: 'sociales' },
  { id: 'oratoria', name: 'Oratoria', category: 'sociales' },
  { id: 'intimidar', name: 'Intimidar', category: 'sociales' },
  { id: 'rastrear', name: 'Rastrear', category: 'exploracion' },
  { id: 'acechar', name: 'Acechar', category: 'exploracion' },
  { id: 'cerraduras', name: 'Abrir cerraduras', category: 'exploracion' },
  { id: 'orientarse', name: 'Orientarse', category: 'exploracion' },
  { id: 'animales', name: 'Trato animal', category: 'exploracion' },
  { id: 'primeros_auxilios', name: 'Primeros auxilios', category: 'exploracion' },
  { id: 'cocina', name: 'Cocinar', category: 'artesania' },
  { id: 'coser', name: 'Coser', category: 'artesania' },
  { id: 'pescar', name: 'Pescar', category: 'artesania' },
  { id: 'herboristeria', name: 'Herboristería', category: 'artesania' },
  { id: 'mineria', name: 'Minería', category: 'artesania' },
  { id: 'herreria', name: 'Herrería', category: 'artesania' },
  { id: 'alquimia', name: 'Alquimia', category: 'artesania' },
  { id: 'encantar', name: 'Encantar', category: 'artesania' },
  { id: 'joyeria', name: 'Joyería', category: 'artesania' },
  { id: 'saber_magico', name: 'Saber mágico', category: 'magia' },
  { id: 'lenguas', name: 'Lenguas', category: 'magia' },
  { id: 'runas', name: 'Runas antiguas', category: 'magia' },
];

const CLASS_AFFINITY: Record<string, Record<string, number>> = {
  warrior: { correr: 3, resistir: 3, trepar: 1, intimidar: 2, mineria: 1, herreria: 2, cocina: 1, orientarse: 1, nadar: 1 },
  rogue: { acechar: 3, robar: 4, cerraduras: 3, trepar: 2, cantar: 1, oratoria: 1, lenguas: 1, nadar: 1, saltar: 1 },
  mage: { saber_magico: 4, lenguas: 2, runas: 3, encantar: 2, alquimia: 1, coser: 1, oratoria: 1 },
  priest: { saber_magico: 3, lenguas: 2, runas: 1, primeros_auxilios: 3, oratoria: 2, cantar: 2, cocina: 1, coser: 1 },
  shaman: { saber_magico: 2, herboristeria: 3, alquimia: 2, animales: 2, pescar: 2, nadar: 1, runas: 1, lenguas: 1 },
  druid: { animales: 4, herboristeria: 4, alquimia: 2, pescar: 2, rastrear: 2, orientarse: 2, trepar: 1, nadar: 1, saber_magico: 1 },
  bard: { cantar: 4, oratoria: 3, robar: 1, lenguas: 2, correr: 2, acechar: 1, joyeria: 1, saber_magico: 1 },
  warlock: { saber_magico: 4, runas: 3, lenguas: 3, intimidar: 2, alquimia: 2, mineria: 1, herreria: 1 },
  hunter: { rastrear: 3, animales: 3, acechar: 2, correr: 2, pescar: 2, coser: 2, trepar: 1, nadar: 1, herboristeria: 1 },
  valkyrie: { saber_magico: 2, runas: 2, lenguas: 2, cantar: 3, primeros_auxilios: 3, coser: 2, cocina: 1, correr: 1, saltar: 1, nadar: 1 },
};

export function skillCapFor(level: number): number {
  return Math.max(1, Math.floor(level / 3));
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computeSkills(level: number, classKey: string, seedName: string): Record<string, number> {
  const points: Record<string, number> = {};
  for (const skill of SKILLS) {
    points[skill.id] = 0;
  }
  const cap = skillCapFor(level);
  const budget = Math.max(0, level * 4);
  const affinity = CLASS_AFFINITY[classKey] || {};
  const weight = (id: string) => 1 + (affinity[id] || 0);
  const rng = seededRandom(hashString(seedName + ':' + classKey + ':' + level));
  let remaining = budget;
  while (remaining > 0) {
    const available = SKILLS.filter((s) => points[s.id] < cap);
    if (available.length === 0) break;
    const total = available.reduce((acc, s) => acc + weight(s.id), 0);
    let r = rng() * total;
    let pick = available[available.length - 1];
    for (const s of available) {
      r -= weight(s.id);
      if (r < 0) {
        pick = s;
        break;
      }
    }
    points[pick.id]++;
    remaining--;
  }
  return points;
}
