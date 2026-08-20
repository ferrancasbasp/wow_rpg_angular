import { CharacterClass } from '../models/game.models';

export const PRIEST: CharacterClass = {
  name: 'Priest',
  color: '#FFFFFF',
  icon: '✨',
  iconImg: 'img/classes/priest.jpg',

  formulas: {
    hp: (s, lvl) => 30 + s.aguante * 8 + lvl * 4,
    mana: (s, lvl) => 50 + s.intelecto * 20 + lvl * 5,
    spellPower: (s) => Math.round(s.intelecto * 0.3),
    attackPower: (s) => 0,
    manaRegen: (s) => Math.round(s.espiritu * 0.25 + 15),
  },

  baseStats: { fuerza: 12, agilidad: 15, intelecto: 22, aguante: 15, espiritu: 25 },
  startingLevel: 1,
  statGrowth: { fuerza: 0.1, agilidad: 0.1, intelecto: 1.8, aguante: 0.5, espiritu: 1.5 },
  armor: 0,
  magicResist: 8,

  resource: { type: 'mana', label: 'Maná', color: '#3498db', max: null, start: 'full' },

  talents: [
    { id: 'healing_focus', name: 'Healing Focus', icon: '💚', iconImg: 'img/talents/priest/healing_focus.jpg', description: 'Aumenta la curación realizada un 2% por punto.', maxRank: 5, tier: 1, requires: null },
    { id: 'shadow_ally', name: 'Shadow Ally', icon: '🌑', iconImg: 'img/talents/priest/shadow_ally.jpg', description: 'Aumenta el daño de sombra un 3% por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'beligerance', name: 'Beligerance', icon: '⚔️', iconImg: 'img/talents/priest/beligerance.jpg', description: 'Los ataques básicos del sacerdote hacen daño sagrado equivalente al 7% del daño de Smite por punto.', maxRank: 5, tier: 1, requires: null },
    { id: 'evangelism', name: 'Evangelism', icon: '✨', iconImg: 'img/talents/priest/evangelism.jpg', description: 'Tras lanzar un hechizo sagrado, tu próximo hechizo de sombra se potencia un 3% por punto, y viceversa. Se trackea como buff.', maxRank: 5, tier: 2, requires: null },
    { id: 'improved_shield', name: 'Improved Power Word: Shield', icon: '🛡️', iconImg: 'img/talents/priest/improved_shield.jpg', description: 'Aumenta la absorción de Power Word: Shield un 10% por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'improved_fortitude', name: 'Improved Fortitude', icon: '💪', iconImg: 'img/abilities/priest/power_word_fortitude.jpg', description: 'Aumenta el bonus de Aguante de Power Word: Fortitude un 15% por punto.', maxRank: 2, tier: 2, requires: null },
    { id: 'improved_pain', name: 'Improved Pain', icon: '🩸', iconImg: 'img/talents/priest/improved_pain.jpg', description: 'Aumenta el daño de Shadow Word: Pain un 10% por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'holyness', name: 'Holyness', icon: '🌟', iconImg: 'img/talents/priest/holyness.jpg', description: 'Aumenta tu regeneración de maná un 5% por punto.', maxRank: 3, tier: 3, requires: null },
    { id: 'preservation', name: 'Preservation', icon: '🛡️', iconImg: 'img/talents/priest/preservation.jpg', description: 'Aumenta tu armadura mágica en 2 por punto.', maxRank: 3, tier: 3, requires: null },
    { id: 'improved_mind_blast', name: 'Improved Mind Blast', icon: '💥', iconImg: 'img/talents/priest/improved_mind_blast.jpg', description: 'Aumenta la probabilidad de crítico de Mind Blast un 10% por punto.', maxRank: 3, tier: 3, requires: null },
    { id: 'improved_renew', name: 'Improved Renew', icon: '🌿', iconImg: 'img/abilities/priest/renew.jpg', description: 'Aumenta la duración de Renew 1 turno por punto.', maxRank: 2, tier: 3, requires: null },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '⚔️', iconImg: 'img/talents/priest/beligerance.jpg', school: 'Físico', category: 'holy', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, castType: 'instant', cooldown: 0, description: 'Un golpe básico.', usesWeaponDamage: true },
    { id: 'smite', name: 'Smite', icon: '✨', iconImg: 'img/abilities/priest/smite.jpg', school: 'Sagrado', category: 'holy', type: 'damage', requiredLevel: 1, damageType: 'magical', baseDamage: 15, spellPowerRatio: 0.571, costPct: 0.08, castType: 'cast', cooldown: 0, description: 'Daño sagrado al enemigo.', damageRanges: [{ rank: 1, level: 1, min: 10, max: 14 }, { rank: 2, level: 6, min: 18, max: 24 }, { rank: 3, level: 12, min: 32, max: 42 }, { rank: 4, level: 18, min: 54, max: 70 }, { rank: 5, level: 24, min: 88, max: 112 }] },
    { id: 'power_word_shield', name: 'Power Word: Shield', icon: '🛡️', iconImg: 'img/abilities/priest/power_word_shield.jpg', school: 'Sagrado', category: 'discipline', type: 'heal', requiredLevel: 6, baseDamage: 50, spellPowerRatio: 0.5, costPct: 0.09, castType: 'instant', cooldown: 4, description: 'Absorbe daño durante 4 turnos.', damageRanges: [{ rank: 1, level: 6, min: 45, max: 45 }, { rank: 2, level: 12, min: 80, max: 80 }, { rank: 3, level: 18, min: 130, max: 130 }, { rank: 4, level: 24, min: 200, max: 200 }] },
    { id: 'heal', name: 'Heal', icon: '💚', iconImg: 'img/abilities/priest/heal.jpg', school: 'Sagrado', category: 'holy', type: 'heal', requiredLevel: 1, baseDamage: 40, spellPowerRatio: 0.857, costPct: 0.10, castType: 'cast', cooldown: 0, description: 'Cura al objetivo una cantidad moderada.', damageRanges: [{ rank: 1, level: 1, min: 32, max: 42 }, { rank: 2, level: 6, min: 56, max: 72 }, { rank: 3, level: 12, min: 100, max: 124 }, { rank: 4, level: 18, min: 168, max: 204 }, { rank: 5, level: 24, min: 260, max: 312 }] },
    { id: 'renew', name: 'Renew', icon: '🌿', iconImg: 'img/abilities/priest/renew.jpg', school: 'Sagrado', category: 'holy', type: 'heal', requiredLevel: 4, baseDamage: 100, spellPowerRatio: 1.0, costPct: 0.07, castType: 'instant', cooldown: 0, description: 'HoT que cura cada turno. Aplicar manualmente en Efectos.', isHot: true, hotDuration: 5, damageRanges: [{ rank: 1, level: 4, min: 50, max: 50 }, { rank: 2, level: 10, min: 90, max: 90 }, { rank: 3, level: 16, min: 140, max: 140 }, { rank: 4, level: 22, min: 200, max: 200 }, { rank: 5, level: 28, min: 280, max: 280 }] },
    { id: 'power_word_fortitude', name: 'Power Word: Fortitude', icon: '💪', iconImg: 'img/abilities/priest/power_word_fortitude.jpg', school: 'Sagrado', category: 'discipline', type: 'utility', requiredLevel: 1, costPct: 0.06, castType: 'instant', cooldown: 0, description: 'Aumenta la Aguante del objetivo. Aplicar manualmente.', buff: { stat: 'aguante', duration: 30 }, buffRanks: [{ rank: 1, level: 1, value: 3, costPct: 0.06 }, { rank: 2, level: 12, value: 7, costPct: 0.07 }, { rank: 3, level: 24, value: 10, costPct: 0.08 }, { rank: 4, level: 36, value: 15, costPct: 0.09 }] },
    { id: 'mind_blast', name: 'Mind Blast', icon: '💥', iconImg: 'img/abilities/priest/mind_blast.jpg', school: 'Sombra', category: 'shadow', type: 'damage', requiredLevel: 10, damageType: 'magical', baseDamage: 50, spellPowerRatio: 0.429, costPct: 0.11, castType: 'cast', cooldown: 2, description: 'Daño de sombra al enemigo. Cooldown moderado.', damageRanges: [{ rank: 1, level: 10, min: 40, max: 54 }, { rank: 2, level: 16, min: 68, max: 86 }, { rank: 3, level: 22, min: 108, max: 132 }, { rank: 4, level: 28, min: 164, max: 196 }, { rank: 5, level: 34, min: 232, max: 276 }] },
    { id: 'shadow_word_pain', name: 'Shadow Word: Pain', icon: '🩸', iconImg: 'img/abilities/priest/shadow_word_pain.jpg', school: 'Sombra', category: 'shadow', type: 'damage', requiredLevel: 4, damageType: 'magical', baseDamage: 20, spellPowerRatio: 0.183, costPct: 0.05, castType: 'instant', cooldown: 0, description: 'DoT de sombra. Aplicar manualmente en Efectos.', isDot: true, dotDuration: 6, damageRanges: [{ rank: 1, level: 4, min: 60, max: 60 }, { rank: 2, level: 10, min: 110, max: 110 }, { rank: 3, level: 16, min: 180, max: 180 }, { rank: 4, level: 22, min: 270, max: 270 }, { rank: 5, level: 28, min: 380, max: 380 }] },
    { id: 'greater_heal', name: 'Greater Heal', icon: '💚', iconImg: 'img/abilities/priest/heal.jpg', school: 'Sagrado', category: 'holy', type: 'heal', requiredLevel: 16, baseDamage: 60, spellPowerRatio: 1.0, costPct: 0.15, castType: 'cast', cooldown: 0, description: 'Curación potente. Lenta pero muy eficiente.', damageRanges: [{ rank: 1, level: 16, min: 180, max: 220 }, { rank: 2, level: 22, min: 280, max: 336 }, { rank: 3, level: 28, min: 420, max: 500 }, { rank: 4, level: 34, min: 600, max: 712 }] },
    { id: 'dispel', name: 'Dispel', icon: '✨', iconImg: '', school: 'Sagrado', category: 'discipline', type: 'utility', requiredLevel: 8, costPct: 0.05, castType: 'instant', cooldown: 0, description: 'Elimina un efecto mágico del objetivo. Úsalo para limpiar debuffs.', bonusPerRank: [0, 0, 0] },
  ],
};
