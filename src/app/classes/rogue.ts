import { CharacterClass } from '../models/game.models';

export const ROGUE: CharacterClass = {
  name: 'Rogue',
  color: '#FFF569',
  icon: '🗡️',
  iconImg: 'img/classes/rogue.jpg',

  formulas: {
    hp: (s, lvl) => 35 + s.aguante * 9 + lvl * 5,
    mana: () => 0,
    spellPower: () => 0,
    attackPower: (s) => s.agilidad * 2 + s.fuerza,
    manaRegen: () => 0,
  },

  baseStats: { fuerza: 15, agilidad: 25, intelecto: 5, aguante: 18, espiritu: 10 },
  startingLevel: 1,
  statGrowth: { fuerza: 0.5, agilidad: 2.2, intelecto: 0.1, aguante: 1.2, espiritu: 0.3 },
  armor: 4,
  magicResist: 2,

  resource: { type: 'energy', label: 'Energía', color: '#f1c40f', max: 100, start: 'full', regen: 20 },

  comboConfig: {
    label: 'Combo Points',
    icon: '🗡️',
    max: 5,
  },

  talents: [
    { id: 'vitality', name: 'Vitality', icon: '⚡', iconImg: 'img/talents/rogue/vitality.jpg', description: 'Aumenta la regeneración de energía al final del turno un 16.67% por punto (máximo 50% a rango 3).', maxRank: 3, tier: 1, requires: null },
    { id: 'energetic_basic_attack', name: 'Energetic Basic Attack', icon: '👊', iconImg: 'img/abilities/rogue/basic_attack.jpg', description: 'Aumenta el daño de Basic Attack un 3% por punto. Basic Attack genera 2 energía por punto (4 por punto si es crítico).', maxRank: 3, tier: 1, requires: null },
    { id: 'ruthlessness', name: 'Ruthlessness', icon: '🎯', iconImg: 'img/talents/rogue/ruthlessness.jpg', description: 'Reduce el coste de energía de tus finishers en 5 por punto.', maxRank: 2, tier: 1, requires: null },
    { id: 'finishing_touch', name: 'Finishing Touch', icon: '✨', iconImg: 'img/talents/rogue/finishing_touch.jpg', description: 'Requiere Ruthlessness al máximo. Tras un finishing move recuperas 1 punto de combo y 15 de energía.', maxRank: 1, tier: 2, requires: { id: 'ruthlessness', points: 2 } },
    { id: 'lethality', name: 'Lethality', icon: '☠️', iconImg: 'img/talents/rogue/lethality.jpg', description: 'Aumenta el daño de los golpes críticos un 3% por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'improved_backstab', name: 'Improved Backstab', icon: '🔪', iconImg: 'img/abilities/rogue/backstab.jpg', description: 'Reduce el coste de energía de Backstab en 3 por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'improved_slice_and_dice', name: 'Improved Slice and Dice', icon: '⚔️', iconImg: 'img/abilities/rogue/slice_and_dice.jpg', description: 'Aumenta la duración de Slice and Dice en 1 turno por punto.', maxRank: 2, tier: 2, requires: null },
    { id: 'opportunity', name: 'Opportunity', icon: '🗡️', iconImg: 'img/talents/rogue/opportunity.jpg', description: 'Aumenta el daño de Backstab, Garrote y Ambush un 5% por punto.', maxRank: 2, tier: 3, requires: null },
    { id: 'precision', name: 'Precision', icon: '🎯', iconImg: 'img/talents/rogue/precision.jpg', description: 'Aumenta tu probabilidad de crítico físico un 1% por punto.', maxRank: 5, tier: 2, requires: null },
    { id: 'improved_garrote', name: 'Improved Garrote', icon: '🩹', iconImg: 'img/abilities/rogue/garrote.jpg', description: 'Requiere Opportunity al máximo. Aumenta el daño del bleed de Garrote un 20% y añade efecto de silencio al enemigo.', maxRank: 1, tier: 3, requires: { id: 'opportunity', points: 2 } },
    { id: 'endurance', name: 'Endurance', icon: '💨', iconImg: 'img/talents/rogue/endurance.jpg', description: 'Reduce el cooldown de Evasión y Sprint en 1 turno por punto.', maxRank: 2, tier: 3, requires: null },
    { id: 'initiative', name: 'Initiative', icon: '⚡', iconImg: 'img/talents/rogue/initiative.jpg', description: 'Sinister Strike tiene un 15% de probabilidad por punto de generar un punto de combo extra.', maxRank: 3, tier: 3, requires: null },
    { id: 'aggression', name: 'Aggression', icon: '🔥', iconImg: 'img/talents/rogue/aggression.jpg', description: 'Aumenta el daño de Sinister Strike y Eviscerate un 2% por punto.', maxRank: 5, tier: 2, requires: null },
  ],

  capstones: [
    { id: 'shadow_dance', name: 'Shadow Dance', icon: '🩶', iconImg: 'img/capstones/rogue/shadowdance.jpg', description: 'Durante 3 turnos puedes utilizar habilidades que requieren Stealth aunque no estés en Stealth.' },
    { id: 'blade_flurry', name: 'Blade Flurry', icon: '🌪️', iconImg: 'img/capstones/rogue/bladefurry.jpg', description: 'Entras en un frenesí de ataques durante 3 turnos. Mientras Blade Flurry está activo, todos tus ataques y habilidades ofensivas de daño directo impactan también a otro enemigo cercano. Cuesta 20 de energía.' },
    { id: 'poison_mastery', name: 'Poison Mastery', icon: '☠️', iconImg: 'img/capstones/rogue/poison_mastery.jpg', description: 'Durante 3 turnos potencia tu veneno activo: Veneno Mortal x2, Veneno Vampírico x3 o Wound (tus ataques además reducen un 25% el daño del enemigo). CD 6.' },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '👊', iconImg: 'img/abilities/rogue/basic_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 0, description: 'Un golpe básico que no gasta energía.', usesWeaponDamage: true },
    { id: 'stealth', name: 'Stealth', icon: '🙈', iconImg: 'img/abilities/rogue/ability_stealth.jpg', school: 'Físico', type: 'utility', requiredLevel: 1, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 0, description: 'Te ocultas y desbloqueas Ambush y Garrote. Se desactiva al atacar o recibir dano. Pulsalo de nuevo para salir del sigilo.', buff: { stat: 'stealth', duration: 999, applySelf: true }, buffRanks: [{ rank: 1, level: 1, value: 0, costEnergy: 0 }] },
    { id: 'shadow_dance', name: 'Shadow Dance', icon: '🩶', iconImg: 'img/capstones/rogue/shadowdance.jpg', school: 'Físico', type: 'utility', requiredLevel: 1, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 5, description: 'Durante 3 turnos puedes usar habilidades que requieren Stealth aunque no estes en Stealth. CD 5.', buff: null, capstoneGate: 'shadow_dance' },
    { id: 'blade_flurry', name: 'Blade Flurry', icon: '🌪️', iconImg: 'img/capstones/rogue/bladefurry.jpg', school: 'Físico', type: 'utility', requiredLevel: 1, costPct: 0, costEnergy: 20, castType: 'instant', cooldown: 6, description: 'Frenesi de ataques durante 3 turnos. Tus ataques y habilidades de daño directo impactan tambien a otro enemigo cercano. Cuesta 20 de energia. CD 6.', buff: null, capstoneGate: 'blade_flurry' },
    { id: 'poison_mastery', name: 'Poison Mastery', icon: '☠️', iconImg: 'img/capstones/rogue/poison_mastery.jpg', school: 'Físico', type: 'utility', requiredLevel: 1, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 6, noGcd: true, description: 'Durante 3 turnos potencia tu veneno activo: Veneno Mortal x2, Veneno Vampírico x3 o Wound (tus ataques además reducen un 25% el daño del enemigo). CD 6.', buff: null, capstoneGate: 'poison_mastery' },
    { id: 'sinister_strike', name: 'Sinister Strike', icon: '🗡️', iconImg: 'img/abilities/rogue/sinister_strike.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 20, spellPowerRatio: 0, costPct: 0, costEnergy: 40, castType: 'instant', cooldown: 0, description: 'Un golpe rápido que gasta energía y genera 1 punto de combo.', generatesCombo: 1, weaponMultiplier: 1.0, bonusPerRank: [5, 12, 21, 30, 45] },
    { id: 'eviscerate', name: 'Eviscerate', icon: '🩸', iconImg: 'img/abilities/rogue/eviscerate.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costEnergy: 35, castType: 'instant', cooldown: 0, description: 'Termina el combo. Gasta todos los puntos de combo. Más puntos = más daño.', spendsCombo: true, noWeaponScaling: true, damageRanges: [{ rank: 1, level: 1, min: 10, max: 14 }, { rank: 2, level: 8, min: 18, max: 24 }, { rank: 3, level: 16, min: 30, max: 40 }, { rank: 4, level: 24, min: 48, max: 60 }, { rank: 5, level: 32, min: 72, max: 90 }] },
    { id: 'slice_and_dice', name: 'Slice and Dice', icon: '⚔️', iconImg: 'img/abilities/rogue/slice_and_dice.jpg', school: 'Físico', type: 'utility', requiredLevel: 6, costPct: 0, costEnergy: 25, castType: 'instant', cooldown: 0, description: 'Finisher. Consume todos los puntos de combo. Te da +1 accion por turno durante tantos turnos como puntos de combo gastados.', spendsCombo: true, noWeaponScaling: true, buff: { stat: 'slice_and_dice', duration: 3, applySelf: true }, buffRanks: [{ rank: 1, level: 6, value: 0, costEnergy: 25 }] },
    { id: 'ambush', name: 'Ambush', icon: '🗡️', iconImg: 'img/abilities/rogue/ambush.jpg', school: 'Físico', type: 'damage', requiredLevel: 18, damageType: 'physical', baseDamage: 40, spellPowerRatio: 0, costPct: 0, costEnergy: 60, castType: 'instant', cooldown: 0, description: 'Requiere estar en sigilo. Ataque sorpresa que genera 2 puntos de combo.', requiresStealth: true, generatesCombo: 2, weaponMultiplier: 1.5, bonusPerRank: [120, 190, 270] },
    { id: 'garrote', name: 'Garrote', icon: '🩹', iconImg: 'img/abilities/rogue/garrote.jpg', school: 'Físico', type: 'damage', requiredLevel: 14, damageType: 'physical', baseDamage: 10, spellPowerRatio: 0, costPct: 0, costEnergy: 45, castType: 'instant', cooldown: 0, description: 'Requiere estar en sigilo. Estrangula al enemigo causando sangrado prolongado.', requiresStealth: true, generatesCombo: 1, noWeaponScaling: true, dotDuration: 4, damageRanges: [{ rank: 1, level: 14, min: 160, max: 160 }, { rank: 2, level: 22, min: 240, max: 240 }, { rank: 3, level: 30, min: 360, max: 360 }], inflictsEffects: [{ type: 'dot', name: 'Garrote', value: 40, duration: 4, debuffType: 'disease' }], dotScales: true, dotRanges: [{ rank: 1, level: 14, value: 40, duration: 4 }, { rank: 2, level: 22, value: 60, duration: 4 }, { rank: 3, level: 30, value: 90, duration: 4 }] },
    { id: 'backstab', name: 'Backstab', icon: '🔪', iconImg: 'img/abilities/rogue/backstab.jpg', school: 'Físico', type: 'damage', requiredLevel: 4, damageType: 'physical', baseDamage: 30, spellPowerRatio: 0, costPct: 0, costEnergy: 60, castType: 'instant', cooldown: 0, description: 'Requiere estar detrás del enemigo. Daño elevado que genera 1 punto de combo.', requiresBehind: true, generatesCombo: 1, weaponMultiplier: 1.5, bonusPerRank: [15, 30, 55, 85, 120] },
    { id: 'sprint', name: 'Sprint', icon: '🏃', iconImg: 'img/abilities/rogue/sprint.jpg', school: 'Físico', type: 'utility', requiredLevel: 10, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 10, noGcd: true, description: 'Te permite moverte sin gastar acción durante 3 turnos.', buff: { stat: 'sprint', duration: 3, applySelf: true }, buffRanks: [{ rank: 1, level: 10, value: 1, costEnergy: 0 }] },
    { id: 'poison_weapon', name: 'Veneno Mortal', icon: '🧪', iconImg: 'img/abilities/rogue/poison_weapon.jpg', school: 'Físico', type: 'utility', requiredLevel: 20, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 0, description: 'Envenena tu arma. Los ataques hacen daño extra y pasan a ser de tipo mágico.', buff: { stat: 'poisonDamage', duration: 5, applySelf: true }, buffRanks: [{ rank: 1, level: 20, value: 8, costEnergy: 0 }, { rank: 2, level: 28, value: 16, costEnergy: 0 }, { rank: 3, level: 36, value: 28, costEnergy: 0 }, { rank: 4, level: 44, value: 44, costEnergy: 0 }] },
    { id: 'leeching_poison', name: 'Veneno Vampírico', icon: '🩸', iconImg: 'img/abilities/rogue/leeching_poison.jpg', school: 'Físico', type: 'utility', requiredLevel: 20, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 0, description: 'Envenena tu arma: te curas un % del daño que haces y tus ataques pasan a ser de tipo mágico. No aumenta el daño. Incompatible con Veneno Mortal.', buff: { stat: 'leechPoison', duration: 5, applySelf: true }, buffRanks: [{ rank: 1, level: 20, value: 13, costEnergy: 0 }, { rank: 2, level: 28, value: 17, costEnergy: 0 }, { rank: 3, level: 36, value: 21, costEnergy: 0 }, { rank: 4, level: 44, value: 26, costEnergy: 0 }] },
    { id: 'wound_poison', name: 'Wound Poison', icon: '🩸', iconImg: 'img/abilities/rogue/wound_poison.jpg', school: 'Físico', type: 'utility', requiredLevel: 24, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 0, description: 'Envenena tus armas: todos tus ataques aplican Wound al objetivo, reduciendo durante 3 turnos la vida que recibe mediante curaciones. Incompatible con Veneno Mortal y Veneno Vampírico.', buff: { stat: 'woundPoison', duration: 5, applySelf: true }, buffRanks: [{ rank: 1, level: 24, value: 35, costEnergy: 0 }, { rank: 2, level: 32, value: 45, costEnergy: 0 }, { rank: 3, level: 40, value: 55, costEnergy: 0 }] },
    { id: 'evasion', name: 'Evasión', icon: '💨', iconImg: 'img/abilities/rogue/evasion.jpg', school: 'Físico', type: 'utility', requiredLevel: 8, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 10, noGcd: true, description: 'Aumenta tu probabilidad de esquivar ataques físicos temporalmente.', buff: { stat: 'evasion', duration: 3, applySelf: true }, buffRanks: [{ rank: 1, level: 8, value: 40, costEnergy: 0 }, { rank: 2, level: 18, value: 50, costEnergy: 0 }, { rank: 3, level: 28, value: 60, costEnergy: 0 }] },
  ],
};
