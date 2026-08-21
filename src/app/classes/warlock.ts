import { CharacterClass } from '../models/game.models';

export const WARLOCK: CharacterClass = {
  name: 'Warlock',
  color: '#8B2DF0',
  icon: '😈',
  iconImg: '',

  formulas: {
    hp: (s, lvl) => 30 + s.aguante * 9 + lvl * 5,
    mana: (s, lvl) => 40 + s.intelecto * 18 + lvl * 6,
    spellPower: (s) => Math.round(s.intelecto * 0.45),
    attackPower: (s) => 0,
    manaRegen: (s) => Math.round(s.espiritu * 0.25 + 12),
  },

  baseStats: { fuerza: 10, agilidad: 10, intelecto: 16, aguante: 14, espiritu: 12 },
  startingLevel: 1,
  statGrowth: { intelecto: 2.0, aguante: 1.8, espiritu: 0.8, fuerza: 0.3, agilidad: 0.3 },
  armor: 5,
  magicResist: 3,

  resource: { type: 'mana', label: 'Mana', color: '#9b59b6', max: null, start: 'full' },

  talents: [],
  abilities: [],

  pets: [
    {
      id: 'imp',
      name: 'Imp',
      icon: '👹',
      iconImg: '',
      requiredLevel: 5,
      hpPct: 0.30,
      manaPct: 0.30,
      attackName: 'Firebolt',
      attackMin: 15,
      attackMax: 25,
      attackSchool: 'Fuego',
      manaCostPct: 0.10,
    },
  ],
};
