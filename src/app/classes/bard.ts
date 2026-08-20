import { CharacterClass } from '../models/game.models';

export const BARD: CharacterClass = {
  name: 'Bard',
  color: '#9B59B6',
  icon: '🎵',
  iconImg: 'img/classes/bard.jpg',

  formulas: {
    hp: (s, lvl) => 30 + s.aguante * 8 + lvl * 5,
    mana: (s, lvl) => 60 + s.intelecto * 18 + lvl * 5,
    spellPower: (s) => Math.round(s.intelecto * 0.3 + s.agilidad * 0.3),
    attackPower: (s) => s.agilidad * 1.5,
    manaRegen: (s) => Math.round(s.espiritu * 0.1 + 5),
  },

  baseStats: { fuerza: 5, agilidad: 20, intelecto: 20, aguante: 12, espiritu: 10 },
  startingLevel: 1,
  statGrowth: { fuerza: 0.2, agilidad: 1.8, intelecto: 1.8, aguante: 0.8, espiritu: 0.5 },
  armor: 3,
  magicResist: 4,

  resource: { type: 'mana', label: 'Maná', color: '#3498db', max: null, start: 'full' },

  comboConfig: {
    label: 'Partitura',
    icon: '🎶',
    max: 7,
  },

  talentBranches: [
    { name: 'Virtuoso', icon: '🎻', color: '#9b59b6' },
    { name: 'Compositor', icon: '🎼', color: '#3498db' },
    { name: 'Maestro', icon: '👑', color: '#f1c40f' },
  ],

  talents: [
    { id: 'virtuoso', name: 'Virtuoso', icon: '🎻', iconImg: '', description: 'Aumenta tu poder de hechizo un 5% por punto.', maxRank: 5, tier: 1, requires: null, branch: 0 },
    { id: 'quick_fingers', name: 'Quick Fingers', icon: '✋', iconImg: '', description: 'Reduce el coste de maná de los generadores un 4% por punto.', maxRank: 5, tier: 1, requires: null, branch: 0 },
    { id: 'resonance', name: 'Resonance', icon: '🔔', iconImg: '', description: 'Aumenta la curación de todas tus habilidades un 5% por punto.', maxRank: 5, tier: 1, requires: null, branch: 1 },
    { id: 'harmonic_series', name: 'Harmonic Series', icon: '📈', iconImg: '', description: '5% de probabilidad por punto de generar una nota un tono mas alta de lo normal.', maxRank: 3, tier: 2, requires: null, branch: 0 },
    { id: 'improved_vivace', name: 'Improved Vivace', icon: '✨', iconImg: '', description: 'Aumenta la curacion de Vivace un 10% por punto.', maxRank: 3, tier: 2, requires: null, branch: 1 },
    { id: 'extended_fermata', name: 'Extended Fermata', icon: '⏸️', iconImg: '', description: 'Aumenta la mana restaurada por Fermata un 5% por punto.', maxRank: 3, tier: 2, requires: null, branch: 1 },
    { id: 'maestro', name: 'Maestro', icon: '👑', iconImg: '', description: 'Los remates hacen un 10% mas de dano/curacion por punto.', maxRank: 3, tier: 3, requires: null, branch: 2 },
    { id: 'perfect_pitch', name: 'Perfect Pitch', icon: '🎯', iconImg: '', description: '10% de probabilidad por punto de que un remate no consuma las notas.', maxRank: 2, tier: 3, requires: null, branch: 2 },
    { id: 'grandioso', name: 'Grandioso', icon: '🌟', iconImg: '', description: 'Aumenta el buff de Da Capo un 5% por punto.', maxRank: 3, tier: 3, requires: null, branch: 2 },
  ],

  abilities: [
    { id: 'staccato', name: 'Staccato', icon: '🤺', iconImg: 'img/abilities/bard/staccato.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 20, spellPowerRatio: 0, costPct: 0.02, castType: 'instant', cooldown: 0, generatesNote: 1, description: 'Una estocada rapida y precisa. Genera un Do.', damageRanges: [{ rank: 1, level: 1, min: 14, max: 22 }, { rank: 2, level: 8, min: 24, max: 34 }, { rank: 3, level: 16, min: 36, max: 48 }, { rank: 4, level: 24, min: 52, max: 68 }, { rank: 5, level: 32, min: 70, max: 90 }] },
    { id: 'scherzo', name: 'Scherzo', icon: '🎭', iconImg: 'img/abilities/bard/scherzo.jpg', school: 'Físico', type: 'damage', requiredLevel: 4, damageType: 'physical', baseDamage: 35, spellPowerRatio: 0.3, costPct: 0.12, castType: 'instant', cooldown: 1, usesWeaponDamage: true, generatesNote: 2, description: 'Una finta engañosa que inflige daño adicional. Genera un Re.', damageRanges: [{ rank: 1, level: 4, min: 24, max: 36 }, { rank: 2, level: 12, min: 38, max: 54 }, { rank: 3, level: 20, min: 56, max: 78 }, { rank: 4, level: 28, min: 78, max: 106 }] },
    { id: 'fermata', name: 'Fermata', icon: '⏸️', iconImg: 'img/abilities/bard/fermata.jpg', school: 'Magia', type: 'utility', requiredLevel: 5, costPct: 0, castType: 'cast', cooldown: 1, restoresManaPct: 0.35, generatesNote: 5, description: 'Pausa el combate para recuperar el aliento. Restaura 35% de tu mana maximo y genera un Sol.', buff: null, buffRanks: [{ rank: 1, level: 5, value: 0, costPct: 0 }, { rank: 2, level: 15, value: 0, costPct: 0 }, { rank: 3, level: 25, value: 0, costPct: 0 }] },
    { id: 'vivace', name: 'Vivace', icon: '✨', iconImg: 'img/abilities/bard/vivace.jpg', school: 'Magia', type: 'heal', requiredLevel: 6, baseDamage: 55, spellPowerRatio: 1.2, costPct: 0.18, castType: 'cast', cooldown: 0, modulateNotes: 1, description: 'Curacion rapida y costosa. Sube el tono de todas las notas en tu partitura +1.', damageRanges: [{ rank: 1, level: 6, min: 45, max: 65 }, { rank: 2, level: 14, min: 75, max: 105 }, { rank: 3, level: 22, min: 115, max: 155 }, { rank: 4, level: 30, min: 165, max: 215 }] },
    { id: 'crescendo', name: 'Crescendo', icon: '📈', iconImg: 'img/abilities/bard/crescendo.jpg', school: 'Magia', type: 'utility', requiredLevel: 8, costPct: 0.12, castType: 'instant', cooldown: 1, modulateNotes: 1, buff: { stat: 'damage_boost', duration: 1, applySelf: false }, description: 'Otorga a un aliado +10 de dano en su proximo ataque. Sube el tono de las notas.', buffRanks: [{ rank: 1, level: 8, value: 10, costPct: 0.12 }, { rank: 2, level: 16, value: 15, costPct: 0.12 }, { rank: 3, level: 24, value: 20, costPct: 0.14 }] },
    { id: 'diminuendo', name: 'Diminuendo', icon: '📉', iconImg: 'img/abilities/bard/diminuendo.jpg', school: 'Magia', type: 'utility', requiredLevel: 10, costPct: 0.10, castType: 'instant', cooldown: 3, generatesNote: 4, inflictsEffects: [{ type: 'debuff', name: 'Diminuendo', target: 'attackPower', value: 25, duration: 2, debuffType: 'magic' }], description: 'Reduce el dano del enemigo un 25% durante 2 turnos. Genera un Fa.', buff: null, buffRanks: [{ rank: 1, level: 10, value: 20, costPct: 0.10 }, { rank: 2, level: 20, value: 30, costPct: 0.12 }, { rank: 3, level: 30, value: 40, costPct: 0.14 }] },
    { id: 'vibrato', name: 'Vibrato', icon: '🛡️', iconImg: 'img/abilities/bard/vibrato.jpg', school: 'Magia', type: 'utility', requiredLevel: 12, costPct: 0.08, castType: 'instant', cooldown: 3, generatesNote: 3, buff: { stat: 'armor', duration: 3, applySelf: false }, description: 'Aumenta la defensa de un aliado durante 3 turnos. Genera un Mi.', buffRanks: [{ rank: 1, level: 12, value: 15, costPct: 0.08 }, { rank: 2, level: 22, value: 25, costPct: 0.10 }, { rank: 3, level: 32, value: 40, costPct: 0.12 }] },
    { id: 'arpeggio', name: 'Arpeggio', icon: '🎼', iconImg: 'img/abilities/bard/arpeggio.jpg', school: 'Magia', type: 'heal', requiredLevel: 14, baseDamage: 20, spellPowerRatio: 0.8, costPct: 0.15, castType: 'instant', cooldown: 0, isHot: true, hotDuration: 4, generatesNote: 6, description: 'Cura al objetivo gradualmente durante 4 turnos. Genera un La.', damageRanges: [{ rank: 1, level: 14, min: 80, max: 80 }, { rank: 2, level: 22, min: 140, max: 140 }, { rank: 3, level: 30, min: 220, max: 220 }], dotScales: true, dotRanges: [{ rank: 1, level: 14, value: 12, duration: 4 }, { rank: 2, level: 22, value: 20, duration: 4 }, { rank: 3, level: 30, value: 32, duration: 5 }] },
    { id: 'fortissimo', name: 'Fortissimo', icon: '💥', iconImg: 'img/abilities/bard/fortissimo.jpg', school: 'Magia', type: 'damage', requiredLevel: 16, damageType: 'magical', aoe: true, baseDamage: 30, spellPowerRatio: 0.8, costPct: 0.05, castType: 'cast', cooldown: 0, spendsNotes: true, description: 'Remate devastador en area. Consume todas las notas. El dano escala con el valor de las notas gastadas.', damageRanges: [{ rank: 1, level: 16, min: 18, max: 26 }, { rank: 2, level: 24, min: 30, max: 42 }, { rank: 3, level: 32, min: 46, max: 62 }] },
    { id: 'adagio', name: 'Adagio', icon: '🕊️', iconImg: 'img/abilities/bard/adagio.jpg', school: 'Magia', type: 'heal', requiredLevel: 18, aoe: true, baseDamage: 40, spellPowerRatio: 1.0, costPct: 0.05, castType: 'cast', cooldown: 0, spendsNotes: true, description: 'Remate sanador en area. Consume todas las notas. La sanacion escala con el valor de las notas gastadas.', damageRanges: [{ rank: 1, level: 18, min: 35, max: 50 }, { rank: 2, level: 26, min: 55, max: 75 }, { rank: 3, level: 34, min: 80, max: 105 }] },
    { id: 'da_capo', name: 'Da Capo', icon: '🔄', iconImg: 'img/abilities/bard/da_capo.jpg', school: 'Magia', type: 'utility', requiredLevel: 20, aoe: true, costPct: 0, castType: 'instant', cooldown: 0, spendsNotes: true, description: 'Remate inspirador. Consume todas las notas para otorgar un buff de dano al grupo. El poder depende del valor de las notas.', buff: { stat: 'damage_boost', duration: 2, applySelf: false }, buffRanks: [{ rank: 1, level: 20, value: 8, costPct: 0 }, { rank: 2, level: 28, value: 12, costPct: 0 }, { rank: 3, level: 36, value: 18, costPct: 0 }] },
  ],
};
