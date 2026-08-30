import { CharacterClass } from '../models/game.models';

export const SHAMAN: CharacterClass = {
  name: 'Shaman',
  color: '#0070DE',
  icon: '⚡',
  iconImg: 'img/classes/shaman.jpg',

  formulas: {
    hp: (s, lvl) => 40 + s.aguante * 10 + lvl * 5,
    mana: (s, lvl) => 30 + s.intelecto * 15 + lvl * 5,
    spellPower: (s) => Math.round(s.intelecto * 0.3),
    attackPower: (s) => s.fuerza * 2,
    manaRegen: (s) => Math.round(s.espiritu * 0.25 + 15),
  },

  baseStats: { fuerza: 15, agilidad: 10, intelecto: 25, aguante: 20, espiritu: 18 },
  startingLevel: 1,
  statGrowth: { fuerza: 0.6, agilidad: 0.4, intelecto: 1.5, aguante: 0.9, espiritu: 0.5 },
  armor: 3,
  magicResist: 3,

  resource: { type: 'mana', label: 'Maná', color: '#3498db', max: null, start: 'full' },

  comboConfig: { label: 'Maelstorm Charges', icon: '⚡', max: 4 },

  talents: [
    { id: 'elemental_focus', name: 'Enfoque Elemental', icon: '🔮', iconImg: '', description: 'Reduce el coste de maná de todos tus hechizos un 2% por punto.', maxRank: 5, tier: 1, requires: null },
    { id: 'convection', name: 'Convección', icon: '🌀', iconImg: '', description: 'Aumenta el daño de todos tus hechizos un 3% por punto.', maxRank: 5, tier: 1, requires: null },
    { id: 'improved_lightning_bolt', name: 'Descarga Mejorada', icon: '⚡', iconImg: '', description: 'Aumenta el daño de Descarga de Rayo un 5% por punto.', maxRank: 3, tier: 2, requires: { id: 'convection', points: 2 } },
    { id: 'call_of_thunder', name: 'Llamada del Trueno', icon: '🌩️', iconImg: '', description: 'Aumenta tu probabilidad de crítico con hechizos un 1% por punto.', maxRank: 3, tier: 2, requires: { id: 'elemental_focus', points: 2 } },
    { id: 'lightning_mastery', name: 'Maestría de Rayos', icon: '💫', iconImg: '', description: 'Aumenta el daño de todos tus hechizos de Naturaleza un 5% por punto.', maxRank: 3, tier: 3, requires: { id: 'improved_lightning_bolt', points: 2 } },
    { id: 'storm_power', name: 'Poder de Tormenta', icon: '🌪️', iconImg: '', description: 'Aumenta tu Poder de Hechizo total un 10% por punto.', maxRank: 2, tier: 3, requires: { id: 'call_of_thunder', points: 2 } },
  ],

  capstones: [
    { id: 'capstone_1', name: 'Capstone I', icon: '👑', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
    { id: 'capstone_2', name: 'Capstone II', icon: '🔮', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
    { id: 'capstone_3', name: 'Capstone III', icon: '⚡', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '👊', iconImg: 'img/abilities/shaman/basic_attack.png', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, castType: 'instant', cooldown: 0, generatesCombo: 1, generatesComboChance: 20, description: 'Realiza un ataque cuerpo a cuerpo que no gasta maná. Tiene un 20% de probabilidad de generar una carga de Maelstorm.', usesWeaponDamage: true },
    { id: 'lightning_bolt', name: 'Lightning Bolt', icon: '⚡', iconImg: 'img/abilities/shaman/lightning_bolt.jpg', school: 'Naturaleza', type: 'damage', requiredLevel: 1, baseDamage: 50, spellPowerRatio: 0.714, costPct: 0.08, castType: 'cast', cooldown: 0, description: 'Lanza un rayo de energía natural al objetivo.', damageRanges: [{ rank: 1, level: 1, min: 12, max: 18 }, { rank: 2, level: 6, min: 24, max: 34 }, { rank: 3, level: 12, min: 48, max: 62 }, { rank: 4, level: 18, min: 84, max: 104 }, { rank: 5, level: 24, min: 140, max: 172 }] },
    { id: 'earth_shock', name: 'Choque de Tierra', icon: '🌍', iconImg: '', school: 'Naturaleza', type: 'damage', requiredLevel: 4, baseDamage: 40, spellPowerRatio: 0.429, costPct: 0.06, castType: 'instant', cooldown: 1, description: 'Libera una onda de tierra que daña al objetivo.', damageRanges: [{ rank: 1, level: 4, min: 10, max: 16 }, { rank: 2, level: 10, min: 22, max: 32 }, { rank: 3, level: 16, min: 44, max: 60 }, { rank: 4, level: 22, min: 80, max: 104 }] },
    { id: 'healing_wave', name: 'Ola de Sanación', icon: '🌊', iconImg: '', school: 'Naturaleza', type: 'heal', requiredLevel: 8, baseDamage: 60, spellPowerRatio: 0.857, costPct: 0.09, castType: 'cast', cooldown: 0, description: 'Canaliza energía curativa para restaurar vida al aliado.', damageRanges: [{ rank: 1, level: 8, min: 32, max: 48 }, { rank: 2, level: 14, min: 56, max: 80 }, { rank: 3, level: 20, min: 92, max: 124 }] },
    { id: 'lightning_shield', name: 'Escudo de Rayos', icon: '🛡️', iconImg: '', school: 'Naturaleza', type: 'damage', requiredLevel: 12, baseDamage: 30, spellPowerRatio: 0.286, costPct: 0.04, castType: 'instant', cooldown: 2, description: 'Te envuelve en electricidad que daña a quien te ataque.', damageRanges: [{ rank: 1, level: 12, min: 15, max: 21 }, { rank: 2, level: 18, min: 28, max: 38 }, { rank: 3, level: 24, min: 48, max: 64 }] },
    { id: 'flame_shock', name: 'Choque de Llamas', icon: '🔥', iconImg: '', school: 'Naturaleza', type: 'damage', requiredLevel: 4, baseDamage: 20, spellPowerRatio: 0.214, costPct: 0.05, castType: 'instant', cooldown: 2, description: 'Quema al objetivo con llamas que causan daño prolongado.', damageRanges: [{ rank: 1, level: 4, min: 8, max: 12 }, { rank: 2, level: 10, min: 16, max: 24 }, { rank: 3, level: 16, min: 32, max: 44 }, { rank: 4, level: 22, min: 56, max: 74 }], inflictsEffects: [{ type: 'dot', name: 'Choque de Llamas', value: 10, duration: 3, debuffType: 'magic' }] },
    { id: 'earth_shock_debuff', name: 'Choque Debilitador', icon: '📉', iconImg: '', school: 'Naturaleza', type: 'damage', requiredLevel: 6, baseDamage: 15, spellPowerRatio: 0.143, costPct: 0.05, castType: 'instant', cooldown: 2, description: 'Reduce la armadura del objetivo.', damageRanges: [{ rank: 1, level: 6, min: 6, max: 10 }, { rank: 2, level: 12, min: 12, max: 18 }, { rank: 3, level: 18, min: 24, max: 32 }], inflictsEffects: [{ type: 'debuff', name: 'Armadura Rota', stat: 'armor', value: 5, duration: 3, debuffType: 'none' }] },
  ],
};
