import { CharacterClass } from '../models/game.models';

export const CANCONER: CharacterClass = {
  name: 'Canconer',
  color: '#CA6F1E',
  icon: '🎼',
  iconImg: 'img/classes/bard.jpg',

  formulas: {
    hp: (s, lvl) => 30 + s.aguante * 8 + lvl * 5,
    mana: (s, lvl) => 60 + s.intelecto * 15 + lvl * 5,
    spellPower: (s) => Math.round(s.intelecto * 0.35 + s.agilidad * 0.35),
    attackPower: (s) => s.agilidad * 1.5,
    manaRegen: (s) => Math.round(s.espiritu * 0.1 + 5),
  },

  baseStats: { fuerza: 5, agilidad: 20, intelecto: 20, aguante: 12, espiritu: 10 },
  startingLevel: 1,
  statGrowth: { fuerza: 0.2, agilidad: 1.4, intelecto: 1.4, aguante: 0.7, espiritu: 0.4 },
  armor: 4,
  magicResist: 4,

  resource: { type: 'mana', label: 'Maná', color: '#3498db', max: null, start: 'full' },

  talentBranches: [
    { name: 'Canciones', icon: '🎶', color: '#CA6F1E' },
  ],

  talents: [],
  abilities: [],
};
