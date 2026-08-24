import { CharacterClass } from '../models/game.models';

export const HUNTER: CharacterClass = {
  name: 'Hunter',
  color: '#AAD372',
  icon: '🏹',
  iconImg: 'img/classes/hunter.jpg',

  formulas: {
    hp: (s, lvl) => 35 + s.aguante * 9 + lvl * 5,
    mana: () => 0,
    spellPower: () => 0,
    attackPower: (s) => s.agilidad * 2,
    manaRegen: () => 0,
  },

  baseStats: { fuerza: 10, agilidad: 25, intelecto: 6, aguante: 19, espiritu: 12 },
  startingLevel: 1,
  statGrowth: { fuerza: 0.4, agilidad: 2.2, intelecto: 0.1, aguante: 1.3, espiritu: 0.3 },
  armor: 5,
  magicResist: 2,

  resource: { type: 'focus', label: 'Focus', color: '#aad372', max: 100, start: 'full', regen: 0 },

  talents: [],

  capstones: [
    { id: 'capstone_1', name: 'Capstone I', icon: '⬜', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
    { id: 'capstone_2', name: 'Capstone II', icon: '⬜', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
    { id: 'capstone_3', name: 'Capstone III', icon: '⬜', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '🎯', iconImg: 'img/abilities/hunter/basic_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costFocus: 0, castType: 'instant', cooldown: 0, description: 'Un ataque básico con tu arma que no gasta focus.', usesWeaponDamage: true },
  ],
};
