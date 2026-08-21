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

  comboConfig: { label: 'Soul Shards', icon: '🔮', max: 10 },

  talents: [],
  abilities: [
    {
      id: 'shadow_bolt',
      name: 'Shadow Bolt',
      icon: '🌑',
      iconImg: '',
      school: 'Oscuro',
      type: 'damage',
      requiredLevel: 1,
      damageType: 'magical',
      baseDamage: 20,
      spellPowerRatio: 1.0,
      costPct: 8,
      castType: 'cast',
      cooldown: 0,
      description: 'Lanza una descarga de energia oscura. Genera 1 Soul Shard.',
      damageRanges: [{ rank: 1, level: 1, min: 18, max: 26 }, { rank: 2, level: 8, min: 30, max: 42 }, { rank: 3, level: 16, min: 50, max: 68 }, { rank: 4, level: 22, min: 70, max: 95 }],
      generatesShard: 1,
    },
    {
      id: 'chaos_bolt',
      name: 'Chaos Bolt',
      icon: '🔥',
      iconImg: '',
      school: 'Fuego',
      type: 'damage',
      requiredLevel: 10,
      damageType: 'magical',
      baseDamage: 40,
      spellPowerRatio: 1.5,
      costPct: 15,
      castType: 'cast',
      cooldown: 0,
      description: 'Descarga caotica que ignora resistencias. Consume 3 Soul Shards.',
      damageRanges: [{ rank: 1, level: 10, min: 55, max: 75 }, { rank: 2, level: 18, min: 80, max: 110 }, { rank: 3, level: 24, min: 120, max: 160 }],
      spendsShards: true,
    },
  ],

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
