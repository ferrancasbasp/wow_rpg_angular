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
    attackPower: (s) => s.fuerza * 2 + s.agilidad,
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
    { id: 'vitality', name: 'Vitality', icon: '⚡', iconImg: 'img/talents/rogue/vitality.jpg', description: 'Aumenta la regeneración de energía al final del turno un 10% por punto.', maxRank: 5, tier: 1, requires: null },
    { id: 'ruthlessness', name: 'Ruthlessness', icon: '🎯', iconImg: 'img/talents/rogue/ruthlessness.jpg', description: 'Reduce el coste de energía de tus finishers en 2 por punto.', maxRank: 5, tier: 1, requires: null },
    { id: 'improved_backstab', name: 'Improved Backstab', icon: '🔪', iconImg: 'img/abilities/rogue/backstab.jpg', description: 'Reduce el coste de energía de Backstab en 3 por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'opportunity', name: 'Opportunity', icon: '🗡️', iconImg: 'img/talents/rogue/opportunity.jpg', description: 'Aumenta el daño de Backstab, Garrote y Ambush un 4% por punto.', maxRank: 5, tier: 2, requires: null },
    { id: 'precision', name: 'Precision', icon: '🎯', iconImg: 'img/talents/rogue/precision.jpg', description: 'Aumenta tu probabilidad de crítico físico un 1% por punto.', maxRank: 5, tier: 2, requires: null },
    { id: 'endurance', name: 'Endurance', icon: '💨', iconImg: 'img/talents/rogue/endurance.jpg', description: 'Reduce el cooldown de Evasión y Sprint en 1 turno por punto.', maxRank: 2, tier: 3, requires: null },
    { id: 'initiative', name: 'Initiative', icon: '⚡', iconImg: 'img/talents/rogue/initiative.jpg', description: 'Sinister Strike y Basic Attack tienen un 15% de probabilidad por punto de generar un punto de combo extra.', maxRank: 3, tier: 3, requires: null },
    { id: 'energetic', name: 'Energetic', icon: '🔋', iconImg: 'img/talents/rogue/energetic.jpg', description: 'Aumenta tu energía máxima en 4 por punto.', maxRank: 5, tier: 3, requires: null },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '👊', iconImg: 'img/abilities/rogue/basic_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 0, description: 'Un golpe básico que no gasta energía.', usesWeaponDamage: true },
    { id: 'sinister_strike', name: 'Sinister Strike', icon: '🗡️', iconImg: 'img/abilities/rogue/sinister_strike.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 20, spellPowerRatio: 0, costPct: 0, costEnergy: 40, castType: 'instant', cooldown: 0, description: 'Un golpe rápido que gasta energía y genera 1 punto de combo.', generatesCombo: 1, weaponMultiplier: 1.0, bonusPerRank: [5, 12, 21, 30, 45] },
    { id: 'eviscerate', name: 'Eviscerate', icon: '🩸', iconImg: 'img/abilities/rogue/eviscerate.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costEnergy: 35, castType: 'instant', cooldown: 0, description: 'Termina el combo. Gasta todos los puntos de combo. Más puntos = más daño.', spendsCombo: true, noWeaponScaling: true, damageRanges: [{ rank: 1, level: 1, min: 10, max: 14 }, { rank: 2, level: 8, min: 18, max: 24 }, { rank: 3, level: 16, min: 30, max: 40 }, { rank: 4, level: 24, min: 48, max: 60 }, { rank: 5, level: 32, min: 72, max: 90 }] },
    { id: 'slice_and_dice', name: 'Slice and Dice', icon: '⚔️', iconImg: 'img/abilities/rogue/slice_and_dice.jpg', school: 'Físico', type: 'utility', requiredLevel: 6, costPct: 0, costEnergy: 25, castType: 'instant', cooldown: 0, description: 'Finisher. Consume todos los puntos de combo. Te da +1 accion por turno durante tantos turnos como puntos de combo gastados.', spendsCombo: true, noWeaponScaling: true, buff: { stat: 'slice_and_dice', duration: 3, applySelf: true }, buffRanks: [{ rank: 1, level: 6, value: 0, costEnergy: 25 }] },
    { id: 'ambush', name: 'Ambush', icon: '🗡️', iconImg: 'img/abilities/rogue/ambush.jpg', school: 'Físico', type: 'damage', requiredLevel: 18, damageType: 'physical', baseDamage: 40, spellPowerRatio: 0, costPct: 0, costEnergy: 60, castType: 'instant', cooldown: 0, description: 'Requiere estar en sigilo. Ataque sorpresa que genera 2 puntos de combo.', requiresStealth: true, generatesCombo: 2, weaponMultiplier: 1.5, bonusPerRank: [55, 100, 160] },
    { id: 'garrote', name: 'Garrote', icon: '🩹', iconImg: 'img/abilities/rogue/garrote.jpg', school: 'Físico', type: 'damage', requiredLevel: 14, damageType: 'physical', baseDamage: 10, spellPowerRatio: 0, costPct: 0, costEnergy: 45, castType: 'instant', cooldown: 0, description: 'Requiere estar en sigilo. Estrangula al enemigo causando sangrado prolongado.', requiresStealth: true, generatesCombo: 1, noWeaponScaling: true, damageRanges: [{ rank: 1, level: 14, min: 16, max: 22 }, { rank: 2, level: 22, min: 28, max: 36 }, { rank: 3, level: 30, min: 44, max: 56 }], inflictsEffects: [{ type: 'dot', name: 'Garrote', value: 8, duration: 6 }], dotScales: true, dotRanges: [{ rank: 1, level: 14, value: 22, duration: 6 }, { rank: 2, level: 22, value: 36, duration: 6 }, { rank: 3, level: 30, value: 54, duration: 6 }] },
    { id: 'backstab', name: 'Backstab', icon: '🔪', iconImg: 'img/abilities/rogue/backstab.jpg', school: 'Físico', type: 'damage', requiredLevel: 4, damageType: 'physical', baseDamage: 30, spellPowerRatio: 0, costPct: 0, costEnergy: 60, castType: 'instant', cooldown: 0, description: 'Requiere estar detrás del enemigo. Daño elevado que genera 1 punto de combo.', requiresBehind: true, generatesCombo: 1, weaponMultiplier: 1.5, bonusPerRank: [15, 30, 55, 85, 120] },
    { id: 'sprint', name: 'Sprint', icon: '🏃', iconImg: 'img/abilities/rogue/sprint.jpg', school: 'Físico', type: 'utility', requiredLevel: 10, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 6, description: 'Acción gratuita que te permite moverte en el turno.', buff: null },
    { id: 'poison_weapon', name: 'Veneno Mortal', icon: '🧪', iconImg: 'img/abilities/rogue/poison_weapon.jpg', school: 'Físico', type: 'utility', requiredLevel: 20, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 0, description: 'Envenena tu arma. Los ataques hacen daño extra y pasan a ser de tipo mágico.', buff: { stat: 'poisonDamage', duration: 5, applySelf: true }, buffRanks: [{ rank: 1, level: 20, value: 8, costEnergy: 0 }, { rank: 2, level: 28, value: 16, costEnergy: 0 }, { rank: 3, level: 36, value: 28, costEnergy: 0 }, { rank: 4, level: 44, value: 44, costEnergy: 0 }] },
    { id: 'evasion', name: 'Evasión', icon: '💨', iconImg: 'img/abilities/rogue/evasion.jpg', school: 'Físico', type: 'utility', requiredLevel: 8, costPct: 0, costEnergy: 0, castType: 'instant', cooldown: 10, description: 'Aumenta tu probabilidad de esquivar ataques físicos temporalmente.', buff: { stat: 'evasion', duration: 3, applySelf: true }, buffRanks: [{ rank: 1, level: 8, value: 50, costEnergy: 0 }, { rank: 2, level: 18, value: 70, costEnergy: 0 }, { rank: 3, level: 28, value: 90, costEnergy: 0 }] },
  ],
};
