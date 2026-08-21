import { Stats, StatKey, EffectType, Equipment, Character } from '../models/game.models';
import { CharacterClass } from '../models/game.models';

export const NOTE_NAMES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
export const NOTE_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e91e63'];
export const NOTE_CONTRIBUTION = (note: number) => Math.pow(1.25, note - 1);
export const NOTE_TOTAL_CONTRIBUTION = (notes: number[]) => notes.reduce((sum, n) => sum + NOTE_CONTRIBUTION(n), 0);

export const STAT_KEYS: Record<string, StatKey> = {
  'Fuerza': 'fuerza',
  'Agilidad': 'agilidad',
  'Intelecto': 'intelecto',
  'Aguante': 'aguante',
  'Espíritu': 'espiritu',
};

export const STAT_ICONS: Record<StatKey, string> = {
  fuerza: '💪',
  agilidad: '🏃',
  intelecto: '🧠',
  aguante: '❤️',
  espiritu: '✨',
};

export const STAT_LABELS: Record<StatKey, string> = {
  fuerza: 'Fuerza',
  agilidad: 'Agilidad',
  intelecto: 'Intelecto',
  aguante: 'Aguante',
  espiritu: 'Espíritu',
};

export const EFFECT_TYPES: Record<string, EffectType> = {
  buff:   { label: 'Buff', icon: '⬆️', color: '#5fa85f' },
  debuff: { label: 'Debuff', icon: '⬇️', color: '#c45151' },
  hot:    { label: 'HoT', icon: '💚', color: '#5fa85f' },
  dot:    { label: 'DoT', icon: '🩸', color: '#c0392b' },
  status: { label: 'Estado', icon: '⛔', color: '#e8d5a3' },
  misc:   { label: 'Misc', icon: '✦', color: '#9b59b6' },
};

export const DEBUFF_TYPES: Record<string, { label: string; color: string }> = {
  none:     { label: 'Sin tipo',  color: '#c45151' },
  disease:  { label: 'Enfermedad', color: '#99cc33' },
  poison:   { label: 'Veneno',     color: '#66cc66' },
  magic:    { label: 'Mágico',     color: '#6699ff' },
  curse:    { label: 'Maldición',  color: '#cc66ff' },
};

export function debuffColor(effect: { type: string; debuffType?: string }): string {
  if (effect.type === 'debuff' || effect.type === 'status' || effect.type === 'dot') {
    return DEBUFF_TYPES[effect.debuffType || 'none']?.color || DEBUFF_TYPES['none'].color;
  }
  return EFFECT_TYPES[effect.type]?.color || '#c45151';
}

export const BUFF_DEBUFF_STATS = [
  { key: 'fuerza', label: 'Fuerza' },
  { key: 'agilidad', label: 'Agilidad' },
  { key: 'aguante', label: 'Aguante' },
  { key: 'espiritu', label: 'Espíritu' },
  { key: 'intelecto', label: 'Intelecto' },
  { key: 'all_stats', label: 'Todos los Atributos' },
  { key: 'attackPower', label: 'Poder de Ataque' },
  { key: 'spellPower', label: 'Poder de Hechizo' },
  { key: 'spellCrit', label: 'Prob. Crítico Hechizos' },
  { key: 'physCrit', label: 'Prob. Crítico Físico' },
  { key: 'maxHP', label: 'Vida Máxima' },
  { key: 'armor', label: 'Armadura' },
  { key: 'magicResist', label: 'Armadura Mágica' },
  { key: 'poisonDamage', label: 'Daño de Veneno' },
  { key: 'evasion', label: 'Evasión' },
];

export const STATUS_OPTIONS = [
  { key: 'stunned', label: 'Stunned' },
  { key: 'silenced', label: 'Silenced' },
  { key: 'rooted', label: 'Rooted' },
  { key: 'frozen', label: 'Frozen' },
];

export const HOT_DOT_TARGETS = [
  { key: 'hp', label: 'Vida' },
  { key: 'mana', label: 'Maná' },
];

export const EQUIPMENT_SLOTS = [
  { key: 'head',      label: 'Cabeza',   icon: '🪖', extraFields: [{ key: 'defense', label: 'Defensa', icon: '🛡️' }] },
  { key: 'chest',     label: 'Pecho',    icon: '🛡️', extraFields: [{ key: 'defense', label: 'Defensa', icon: '🛡️' }] },
  { key: 'hands',     label: 'Manos',    icon: '🧤' },
  { key: 'legs',      label: 'Piernas',  icon: '👖' },
  { key: 'feet',      label: 'Pies',     icon: '🥾' },
  { key: 'mainHand',  label: 'Mano Fuerte', icon: '⚔️', extraFields: [{ key: 'weaponDamage', label: 'Daño', icon: '💥' }] },
  { key: 'offHand',   label: 'Mano Débil', icon: '🗡️', extraFields: [{ key: 'weaponDamage', label: 'Daño', icon: '💥' }, { key: 'defense', label: 'Defensa', icon: '🛡️' }] },
];

export const MAX_LEVEL = 60;

const XP_TABLE = [
  400, 900, 1400, 2100, 2800, 3600, 4500, 5400, 6500, 7600,
  8800, 10100, 11500, 13000, 14600, 16300, 18100, 20000, 22000, 24100,
  26300, 28600, 31000, 33500, 36100, 38800, 41600, 44500, 47500, 50600,
  53800, 57100, 60500, 64000, 67600, 71300, 75100, 79000, 83000, 87100,
  91300, 95600, 100000, 104500, 109100, 113800, 118600, 123500, 128500, 133600,
  138800, 144100, 149500, 155000, 160600, 166300, 172100, 178000, 184000
];

export function xpForLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return XP_TABLE[level - 1] || 0;
}

export function createDefaultEquipment(): Equipment {
  const emptyBonus = { fuerza: 0, agilidad: 0, intelecto: 0, aguante: 0, espiritu: 0 };
  return {
    head:      { name: '', bonus: { ...emptyBonus }, defense: 0 },
    chest:     { name: '', bonus: { ...emptyBonus }, defense: 0 },
    hands:     { name: '', bonus: { ...emptyBonus } },
    legs:      { name: '', bonus: { ...emptyBonus } },
    feet:      { name: '', bonus: { ...emptyBonus } },
    mainHand:  { name: 'Arma básica', bonus: { ...emptyBonus }, weaponDamage: 4 },
    offHand:   { name: '', bonus: { ...emptyBonus }, weaponDamage: 0, defense: 0 },
    twoHand:   { name: '', bonus: { ...emptyBonus }, weaponDamage: 0 },
  };
}

export function createDefaultCharacter(classKey: string, classData: Record<string, CharacterClass>): Character {
  const cls = classData[classKey] || classData['shaman'];
  const emptyBonus = { fuerza: 0, agilidad: 0, intelecto: 0, aguante: 0, espiritu: 0 };

  let equipment = createDefaultEquipment();

  if (cls) {
    if (cls.name === 'Warrior') {
      equipment.mainHand = { name: 'Espada de Acero', bonus: { ...emptyBonus, fuerza: 2 }, weaponDamage: 4 };
      equipment.twoHand = { name: 'Gran Hacha', bonus: { ...emptyBonus, fuerza: 3 }, weaponDamage: 7 };
    } else if (cls.name === 'Rogue') {
      equipment.mainHand = { name: 'Daga Afilada', bonus: { ...emptyBonus, agilidad: 1 }, weaponDamage: 3 };
      equipment.offHand = { name: 'Daga de Novato', bonus: { ...emptyBonus, agilidad: 1 }, weaponDamage: 3 };
    } else if (cls.name === 'Mage') {
      equipment.mainHand = { name: 'Bastón Arcano', bonus: { ...emptyBonus, intelecto: 2 }, weaponDamage: 4 };
    } else if (cls.name === 'Shaman') {
      equipment.mainHand = { name: 'Maza de Chamán', bonus: { ...emptyBonus }, weaponDamage: 4 };
    } else if (cls.name === 'Druid Balance') {
      equipment.mainHand = { name: 'Bastón Druida', bonus: { ...emptyBonus, espiritu: 2 }, weaponDamage: 4 };
    } else if (cls.name === 'Warlock') {
      equipment.mainHand = { name: 'Bastón Oscuro', bonus: { ...emptyBonus, intelecto: 2 }, weaponDamage: 4 };
    }
  }

  return {
    name: 'Nuevo Personaje',
    classKey: classData[classKey] ? classKey : 'shaman',
    level: cls?.startingLevel || 1,
    baseStats: { ...cls?.baseStats } as Stats,
    talents: {},
    currentXP: 0,
    currentHP: null,
    currentMana: null,
    currentRage: 0,
    currentEnergy: 100,
    comboPoints: 0,
    soulShards: 0,
    trainedRanks: {},
    currentCooldowns: {},
    equipment,
    activeEffects: [],
  };
}

export const STORAGE_KEY = 'ttrpg_wow_character_v15';
