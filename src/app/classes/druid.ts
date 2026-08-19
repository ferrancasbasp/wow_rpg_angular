import { CharacterClass } from '../models/game.models';

export const DRUID: CharacterClass = {
  name: 'Druid Balance',
  color: '#FF7D0A',
  icon: '🦉',
  iconImg: 'img/classes/druid.jpg',

  formulas: {
    hp: (s, lvl) => 40 + s.aguante * 9 + lvl * 5,
    mana: (s, lvl) => 45 + s.intelecto * 15 + lvl * 5,
    spellPower: (s) => Math.round(s.intelecto * 0.35 + s.espiritu * 0.05),
    attackPower: (s) => 0,
    manaRegen: (s) => Math.round(s.espiritu * 0.35 + 10),
  },

  baseStats: { fuerza: 5, agilidad: 4, intelecto: 18, aguante: 15, espiritu: 20 },
  startingLevel: 1,
  statGrowth: { fuerza: 0.2, agilidad: 0.2, intelecto: 1.6, aguante: 0.7, espiritu: 1.8 },
  armor: 5,
  magicResist: 5,

  resource: { type: 'mana', label: 'Maná', color: '#3498db', max: null, start: 'full' },

  comboConfig: {
    label: 'Lunar Phases',
    icon: '🌙',
    max: 4,
  },

  talents: [
    { id: 'improved_mark_of_the_wild', name: 'Improved Mark of the Wild', icon: '🐾', iconImg: 'img/talents/druid/mark_of_the_wild.jpg', description: 'Aumenta el efecto de Mark of the Wild un 15% por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'improved_wrath', name: 'Improved Wrath', icon: '☀️', iconImg: 'img/talents/druid/wrath.jpg', description: 'Aumenta el daño de Wrath un 3% por punto.', maxRank: 5, tier: 1, requires: null },
    { id: 'lunar_healing', name: 'Lunar Healing', icon: '🌙', iconImg: 'img/talents/druid/lunar_healing.jpg', description: 'Tus hechizos de curación tienen un 6% de probabilidad por punto de otorgarte una Fase Lunar.', maxRank: 4, tier: 1, requires: null },
    { id: 'improved_moonfire', name: 'Improved Moonfire', icon: '🌙', iconImg: 'img/talents/druid/moonfire.jpg', description: 'Aumenta el daño de Moonfire un 10% por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'improved_rejuvenation', name: 'Improved Rejuvenation', icon: '🍃', iconImg: 'img/talents/druid/rejuvenation.jpg', description: 'Aumenta la curación de Rejuvenation un 7% por punto.', maxRank: 2, tier: 2, requires: null },
    { id: 'natures_remains', name: "Nature's Remains", icon: '🍂', iconImg: 'img/talents/druid/natures_remains.jpg', description: 'Reduce el coste de maná de Wrath y Moonfire un 5% por punto.', maxRank: 4, tier: 2, requires: null },
    { id: 'balance_of_nature', name: 'Balance of Nature', icon: '⚖️', iconImg: 'img/talents/druid/balance_of_nature.jpg', description: 'Aumenta tu poder de hechizo en un 10% de tu Espíritu por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'equinox', name: 'Equinox', icon: '🌗', iconImg: 'img/talents/druid/equinox.jpg', description: 'Aumenta el daño bonus que aportan las Fases Lunares un 15% por punto. Hurricane recibe el bonus a un 50% de eficacia.', maxRank: 3, tier: 3, requires: null },
    { id: 'natural_perfection', name: 'Natural Perfection', icon: '🎯', iconImg: 'img/talents/druid/natural_perfection.jpg', description: 'Aumenta tu probabilidad de crítico con hechizos un 2% por punto.', maxRank: 3, tier: 3, requires: null },
    { id: 'clearcasting', name: 'Clearcasting', icon: '🔮', iconImg: 'img/talents/druid/clearcasting.jpg', description: 'Tus hechizos tienen un 2% de probabilidad por punto de ser gratuitos al lanzarlos.', maxRank: 5, tier: 3, requires: null },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '👊', iconImg: 'img/abilities/druid/basic_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, castType: 'instant', cooldown: 0, description: 'Un golpe básico.', usesWeaponDamage: true },
    { id: 'wrath', name: 'Wrath', icon: '☀️', iconImg: 'img/abilities/druid/wrath.jpg', school: 'Naturaleza', type: 'damage', requiredLevel: 1, damageType: 'magical', baseDamage: 55, spellPowerRatio: 0.85, costPct: 0.07, castType: 'cast', cooldown: 0, generatesCombo: 1, description: 'Lanza energía solar al objetivo. Genera 1 Fase Lunar.', damageRanges: [{ rank: 1, level: 1, min: 15, max: 20 }, { rank: 2, level: 8, min: 35, max: 45 }, { rank: 3, level: 14, min: 60, max: 75 }] },
    { id: 'moonfire', name: 'Moonfire', icon: '🌙', iconImg: 'img/abilities/druid/moonfire.jpg', school: 'Arcano', type: 'damage', requiredLevel: 4, damageType: 'magical', baseDamage: 20, spellPowerRatio: 0.4, costPct: 0.09, castType: 'instant', cooldown: 0, generatesCombo: 1, isDot: true, dotDuration: 3, description: 'Quema al enemigo y le inflige daño durante 3 turnos. Genera 1 Fase Lunar.', damageRanges: [{ rank: 1, level: 4, min: 18, max: 22 }, { rank: 2, level: 10, min: 30, max: 40 }, { rank: 3, level: 16, min: 55, max: 65 }], inflictsEffects: [{ type: 'dot', name: 'Moonfire', value: 10, duration: 3, debuffType: 'magic' }], dotScales: true, dotRanges: [{ rank: 1, level: 4, value: 10, duration: 3 }, { rank: 2, level: 10, value: 18, duration: 3 }, { rank: 3, level: 16, value: 25, duration: 3 }] },
    { id: 'starsurge', name: 'Starsurge', icon: '🌟', iconImg: 'img/abilities/druid/starsurge.jpg', school: 'Arcano', type: 'damage', requiredLevel: 10, damageType: 'magical', baseDamage: 40, spellPowerRatio: 1.5, costPct: 0.05, castType: 'cast', cooldown: 0, spendsCombo: true, noWeaponScaling: true, description: 'Invoca el poder de las estrellas. Gasta todas las Fases Lunares. Más fases = más daño.', damageRanges: [{ rank: 1, level: 10, min: 25, max: 35 }, { rank: 2, level: 18, min: 50, max: 70 }, { rank: 3, level: 26, min: 90, max: 120 }] },
    { id: 'hurricane', name: 'Hurricane', icon: '🌪️', iconImg: 'img/abilities/druid/hurricane.jpg', school: 'Naturaleza', type: 'damage', requiredLevel: 20, damageType: 'magical', aoe: true, baseDamage: 45, spellPowerRatio: 0.6, costPct: 0.15, castType: 'instant', cooldown: 3, spendsCombo: true, noWeaponScaling: true, description: 'Crea una tormenta en área. Gasta todas las Fases Lunares. Más fases = más daño.', damageRanges: [{ rank: 1, level: 20, min: 60, max: 80 }, { rank: 2, level: 28, min: 110, max: 130 }] },
    { id: 'healing_touch', name: 'Healing Touch', icon: '🌿', iconImg: 'img/abilities/druid/healing_touch.jpg', school: 'Naturaleza', type: 'heal', requiredLevel: 1, baseDamage: 80, spellPowerRatio: 1.2, costPct: 0.12, castType: 'cast', cooldown: 0, description: 'Sana una gran cantidad de salud al objetivo.', damageRanges: [{ rank: 1, level: 1, min: 40, max: 55 }, { rank: 2, level: 8, min: 90, max: 120 }, { rank: 3, level: 14, min: 180, max: 230 }] },
    { id: 'rejuvenation', name: 'Rejuvenation', icon: '🍃', iconImg: 'img/abilities/druid/rejuvenation.jpg', school: 'Naturaleza', type: 'heal', requiredLevel: 6, baseDamage: 30, spellPowerRatio: 0.8, costPct: 0.08, castType: 'instant', cooldown: 0, isHot: true, hotDuration: 4, description: 'Sana al objetivo durante 4 turnos. Aplicar manualmente en Efectos.', damageRanges: [{ rank: 1, level: 6, min: 100, max: 100 }, { rank: 2, level: 12, min: 180, max: 180 }, { rank: 3, level: 18, min: 300, max: 300 }] },
    { id: 'entangling_roots', name: 'Entangling Roots', icon: '🌱', iconImg: 'img/abilities/druid/entangling_roots.jpg', school: 'Naturaleza', type: 'utility', requiredLevel: 8, costPct: 0.06, castType: 'cast', cooldown: 4, description: 'Inmoviliza al objetivo durante 2 turnos. Aplícalo al enemigo.', buff: { stat: 'rooted', duration: 2, applySelf: false }, buffRanks: [{ rank: 1, level: 8, value: 0, costPct: 0.06 }, { rank: 2, level: 16, value: 0, costPct: 0.06 }, { rank: 3, level: 24, value: 0, costPct: 0.06 }] },
    { id: 'moonkin_form', name: 'Moonkin Form', icon: '🪶', iconImg: 'img/abilities/druid/moonkin_form.jpg', school: 'Físico', type: 'utility', requiredLevel: 10, costPct: 0.15, castType: 'instant', cooldown: 1, description: 'Te transformas en Lechúcico. Aumenta tu armadura y daño mágico. Aplícalo en Efectos.', buff: { stat: 'moonkin', duration: 30, applySelf: true }, buffRanks: [{ rank: 1, level: 10, value: 1, costPct: 0.15 }] },
    { id: 'mark_of_the_wild', name: 'Mark of the Wild', icon: '🐾', iconImg: 'img/abilities/druid/mark_of_the_wild.jpg', school: 'Naturaleza', type: 'utility', requiredLevel: 2, costPct: 0.08, castType: 'cast', cooldown: 0, description: 'Aumenta todos los atributos. El buffo más mítico del druida. Aplicar manualmente en Efectos.', buff: { stat: 'all_stats', duration: 30, applySelf: false }, buffRanks: [{ rank: 1, level: 2, value: 2, costPct: 0.08 }, { rank: 2, level: 12, value: 4, costPct: 0.09 }, { rank: 3, level: 24, value: 7, costPct: 0.10 }, { rank: 4, level: 36, value: 10, costPct: 0.11 }] },
    { id: 'dispel', name: 'Dispel', icon: '✨', iconImg: '', school: 'Naturaleza', type: 'utility', requiredLevel: 8, costPct: 0.05, castType: 'instant', cooldown: 0, description: 'Elimina una maldicion del objetivo.', bonusPerRank: [0, 0, 0] },
  ],
};
