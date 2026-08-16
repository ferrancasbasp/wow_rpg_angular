export type StatKey = 'fuerza' | 'agilidad' | 'intelecto' | 'aguante' | 'espiritu';

export type Stats = Record<StatKey, number>;

export type ResourceType = 'mana' | 'rage' | 'energy';

export type DamageType = 'physical' | 'magical';

export type CastType = 'instant' | 'cast';

export type AbilityType = 'damage' | 'heal' | 'utility';

export interface DamageRange {
  rank: number;
  level: number;
  min: number;
  max: number;
}

export interface BuffRank {
  rank: number;
  level: number;
  value: number;
  costPct?: number;
  costRage?: number;
  costEnergy?: number;
}

export interface InflictedEffect {
  type: 'dot' | 'debuff' | 'status';
  name: string;
  value?: number;
  stat?: string;
  target?: string;
  duration: number;
}

export interface Buff {
  stat: string;
  duration: number;
  applySelf?: boolean;
  isPercent?: boolean;
  isHot?: boolean;
}

export interface DotRange {
  rank: number;
  level: number;
  value: number;
  duration: number;
}

export interface Ability {
  id: string;
  name: string;
  icon: string;
  iconImg: string;
  school: string;
  category?: string;
  type: AbilityType;
  requiredLevel: number;
  damageType?: DamageType;
  baseDamage?: number;
  spellPowerRatio?: number;
  costPct: number;
  costRage?: number;
  costEnergy?: number;
  castType: CastType;
  cooldown: number;
  description: string;
  damageRanges?: DamageRange[];
  generatesRage?: number;
  generatesCombo?: number;
  spendsCombo?: boolean;
  isDot?: boolean;
  isHot?: boolean;
  dotDuration?: number;
  hotDuration?: number;
  dotScales?: boolean;
  dotRanges?: DotRange[];
  inflictsEffects?: InflictedEffect[];
  buff?: Buff | null;
  buffRanks?: BuffRank[];
  usesWeaponDamage?: boolean;
  noWeaponScaling?: boolean;
  bonusPerRank?: number[];
  weaponMultiplier?: number;
  aoe?: boolean;
  requiresStealth?: boolean;
  requiresBehind?: boolean;
  blockedStance?: string;

  currentRank?: number;
  currentMin?: number;
  currentMax?: number;
  scaledCost?: number;
  computedDamage?: number;
  computedCost?: number;
  talentNote?: string | null;
  dotTick?: number;
  dotTotal?: number;
  hotTick?: number;
  hotTotal?: number;
  currentBuffValue?: number;
  currentBuffDuration?: number;
  currentBuffStat?: string;
  currentDotValue?: number;
  currentDotDuration?: number;
  effectiveRageCost?: number;
  effectiveRageGen?: number;
  effectiveCost?: number;
  lastRoll?: number;
  lastCrit?: boolean;
  multiHit?: number;
}

export interface Talent {
  id: string;
  name: string;
  icon: string;
  iconImg: string;
  description: string;
  maxRank: number;
  tier: number;
  requires: { id: string; points: number } | null;
  passive?: boolean;
  branch?: number;
}

export interface ComboConfig {
  label: string;
  icon: string;
  max: number;
}

export interface ResourceConfig {
  type: ResourceType;
  label: string;
  color: string;
  max: number | null;
  start: string;
  regen?: number;
}

export interface ClassFormulas {
  hp: (stats: Stats, level: number) => number;
  mana: (stats: Stats, level: number) => number;
  spellPower: (stats: Stats) => number;
  attackPower: (stats: Stats) => number;
  manaRegen: (stats: Stats, level?: number) => number;
}

export interface Stance {
  id: string;
  name: string;
  icon: string;
  iconImg?: string;
  effect: string;
  value: number;
}

export interface TalentBranch {
  name: string;
  icon: string;
  color: string;
}

export interface CharacterClass {
  name: string;
  color: string;
  icon: string;
  iconImg: string;
  formulas: ClassFormulas;
  baseStats: Stats;
  startingLevel: number;
  statGrowth: Partial<Record<StatKey, number>>;
  armor: number;
  magicResist: number;
  resource: ResourceConfig;
  comboConfig?: ComboConfig;
  talents: Talent[];
  abilities: Ability[];
  stances?: Stance[];
  talentBranches?: TalentBranch[];
}

export interface EquipmentItem {
  name: string;
  bonus: Partial<Stats>;
  weaponDamage?: number;
  defense?: number;
}

export interface Equipment {
  head: EquipmentItem;
  chest: EquipmentItem;
  hands: EquipmentItem;
  legs: EquipmentItem;
  feet: EquipmentItem;
  mainHand: EquipmentItem;
  offHand: EquipmentItem;
  twoHand: EquipmentItem;
}

export interface ActiveEffect {
  id: number;
  type: 'buff' | 'debuff' | 'hot' | 'dot' | 'status' | 'misc';
  name: string;
  target: string;
  value: number;
  duration: number;
  isPercent?: boolean;
}

export interface Character {
  name: string;
  classKey: string;
  level: number;
  baseStats: Stats;
  talents: Record<string, number>;
  currentXP: number;
  currentHP: number | null;
  currentMana: number | null;
  currentRage: number;
  currentEnergy: number;
  comboPoints: number;
  trainedRanks: Record<string, number>;
  currentCooldowns: Record<string, number>;
  equipment: Equipment;
  activeEffects: ActiveEffect[];
}

export interface EffectType {
  label: string;
  icon: string;
  color: string;
}

export interface NpcAttack {
  name: string;
  minDamage: number;
  maxDamage: number;
}

export interface Npc {
  id: string;
  name: string;
  level: number;
  hp: number;
  armor: number;
  zone: string;
  imageUrl?: string;
  attacks: NpcAttack[];
  description?: string;
}
