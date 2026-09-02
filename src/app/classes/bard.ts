import { CharacterClass } from '../models/game.models';

export const BARD: CharacterClass = {
  name: 'Bard',
  color: '#9B59B6',
  icon: '🎵',
  iconImg: 'img/classes/bard.jpg',

  formulas: {
    hp: (s, lvl) => 30 + s.aguante * 8 + lvl * 5,
    mana: (s, lvl) => 60 + s.intelecto * 15 + lvl * 5,
    spellPower: (s) => Math.round(s.intelecto * 0.3 + s.agilidad * 0.3),
    attackPower: (s) => s.agilidad * 1.5,
    manaRegen: (s) => Math.round(s.espiritu * 0.1 + 5),
  },

  baseStats: { fuerza: 5, agilidad: 20, intelecto: 20, aguante: 12, espiritu: 10 },
  startingLevel: 1,
  statGrowth: { fuerza: 0.2, agilidad: 1.4, intelecto: 1.4, aguante: 0.7, espiritu: 0.4 },
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
    { id: 'improved_staccato', name: 'Improved Staccato', icon: '🤺', iconImg: 'img/abilities/bard/staccato.jpg', description: 'Aumenta el danyo de Staccato un 5% y reduce su coste de mana un 10% por punto.', maxRank: 5, tier: 1, requires: null, branch: 0 },
    { id: 'quick_fingers', name: 'Quick Fingers', icon: '✋', iconImg: '', description: 'Aumenta tu probabilidad de esquivar un 2% por punto.', maxRank: 5, tier: 1, requires: null, branch: 0 },
    { id: 'resonance', name: 'Resonance', icon: '🔔', iconImg: '', description: 'Aumenta la curación de todas tus habilidades un 5% por punto.', maxRank: 5, tier: 1, requires: null, branch: 1 },
    { id: 'improved_crescendo', name: 'Improved Crescendo', icon: '📈', iconImg: 'img/abilities/bard/crescendo.jpg', description: 'Al lanzar Crescendo, tambien recibes un buff de dano equivalente al 10% del valor enviado por punto.', maxRank: 5, tier: 2, requires: null, branch: 0 },
    { id: 'improved_vivace', name: 'Improved Vivace', icon: '✨', iconImg: 'img/abilities/bard/vivace.jpg', description: 'Aumenta la curacion de Vivace un 10% por punto.', maxRank: 3, tier: 2, requires: null, branch: 1 },
    { id: 'improved_fermata', name: 'Improved Fermata', icon: '⏸️', iconImg: 'img/abilities/bard/fermata.jpg', description: 'Tras lanzar Fermata, aumentas tu armadura fisica en 14 por punto.', maxRank: 3, tier: 2, requires: null, branch: 1 },
    { id: 'maestro', name: 'Maestro', icon: '👑', iconImg: '', description: 'Los remates tienen un 15% de probabilidad por punto de devolverte un punto de accion.', maxRank: 3, tier: 3, requires: null, branch: 2 },
    { id: 'improved_diminuendo', name: 'Improved Diminuendo', icon: '📉', iconImg: 'img/abilities/bard/diminuendo.jpg', description: 'Aumenta la efectividad del debuff de Diminuendo un 10% por punto.', maxRank: 2, tier: 3, requires: null, branch: 2 },
    { id: 'ballerino', name: 'Ballerino', icon: '🩰', iconImg: '', description: 'Aumenta tu Agilidad un 2% por punto.', maxRank: 5, tier: 3, requires: null, branch: 2 },
    { id: 'harmonioso', name: 'Harmonioso', icon: '🎵', iconImg: '', description: 'Reduce el coste de mana de tus curas un 5% por punto.', maxRank: 3, tier: 3, requires: null, branch: 2 },
  ],

  capstones: [
    { id: 'capstone_1', name: 'Capstone I', icon: '👑', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
    { id: 'capstone_2', name: 'Capstone II', icon: '🔮', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
    { id: 'capstone_3', name: 'Capstone III', icon: '⚡', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
  ],

  abilities: [
    { id: 'staccato', name: 'Staccato', icon: '🤺', iconImg: 'img/abilities/bard/staccato.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 20, spellPowerRatio: 0, costPct: 0.04, castType: 'instant', cooldown: 0, usesWeaponDamage: true, generatesNote: 1, description: 'Una estocada rapida y precisa. Genera un Do.' },
    { id: 'scherzo', name: 'Scherzo', icon: '🎭', iconImg: 'img/abilities/bard/scherzo.jpg', school: 'Físico', type: 'damage', requiredLevel: 4, damageType: 'physical', baseDamage: 35, spellPowerRatio: 0.3, costPct: 0.18, castType: 'instant', cooldown: 1, weaponMultiplier: 1.0, generatesNote: 2, description: 'Una finta engañosa que inflige daño adicional. Genera un Re.', bonusPerRank: [12, 24, 38, 55] },
    { id: 'fermata', name: 'Fermata', icon: '⏸️', iconImg: 'img/abilities/bard/fermata.jpg', school: 'Magia', type: 'utility', requiredLevel: 5, costPct: 0, castType: 'cast', cooldown: 1, restoresManaPct: 0.35, generatesNote: 5, description: 'Pausa el combate para recuperar el aliento. Restaura 35% de tu mana maximo y genera un Sol.', buff: null, buffRanks: [{ rank: 1, level: 5, value: 0, costPct: 0 }, { rank: 2, level: 15, value: 0, costPct: 0 }, { rank: 3, level: 25, value: 0, costPct: 0 }] },
    { id: 'vivace', name: 'Vivace', icon: '✨', iconImg: 'img/abilities/bard/vivace.jpg', school: 'Magia', type: 'heal', requiredLevel: 6, baseDamage: 55, spellPowerRatio: 1.2, costPct: 0.25, castType: 'cast', cooldown: 2, modulateNotes: 1, description: 'Curacion rapida y costosa. Sube el tono de todas las notas en tu partitura +1.', damageRanges: [{ rank: 1, level: 6, min: 45, max: 65 }, { rank: 2, level: 14, min: 75, max: 105 }, { rank: 3, level: 22, min: 115, max: 155 }, { rank: 4, level: 30, min: 165, max: 215 }] },
    { id: 'crescendo', name: 'Crescendo', icon: '📈', iconImg: 'img/abilities/bard/crescendo.jpg', school: 'Magia', type: 'utility', requiredLevel: 8, costPct: 0.18, castType: 'instant', cooldown: 1, modulateNotes: 1, buff: { stat: 'damage_boost', duration: 3, applySelf: false }, description: 'Otorga a un aliado +10 de dano en su proximo ataque. Se consume al atacar. Sube el tono de las notas.', buffRanks: [{ rank: 1, level: 8, value: 10, costPct: 0.18 }, { rank: 2, level: 16, value: 15, costPct: 0.18 }, { rank: 3, level: 24, value: 20, costPct: 0.20 }] },
    { id: 'diminuendo', name: 'Diminuendo', icon: '📉', iconImg: 'img/abilities/bard/diminuendo.jpg', school: 'Magia', type: 'utility', requiredLevel: 10, costPct: 0.15, castType: 'instant', cooldown: 3, generatesNote: 4, inflictsEffects: [{ type: 'debuff', name: 'Diminuendo', target: 'attackPower', value: 25, duration: 2, debuffType: 'magic' }], description: 'Reduce el dano del enemigo un 25% durante 2 turnos. Genera un Fa.', buff: null, buffRanks: [{ rank: 1, level: 10, value: 20, costPct: 0.15 }, { rank: 2, level: 20, value: 30, costPct: 0.17 }, { rank: 3, level: 30, value: 40, costPct: 0.19 }] },
    { id: 'vibrato', name: 'Vibrato', icon: '🛡️', iconImg: 'img/abilities/bard/vibrato.jpg', school: 'Magia', type: 'utility', requiredLevel: 12, costPct: 0.14, castType: 'instant', cooldown: 3, generatesNote: 3, buff: { stat: 'armor', duration: 3, applySelf: false }, description: 'Aumenta la defensa de un aliado durante 3 turnos. Genera un Mi.', buffRanks: [{ rank: 1, level: 12, value: 15, costPct: 0.14 }, { rank: 2, level: 22, value: 25, costPct: 0.16 }, { rank: 3, level: 32, value: 40, costPct: 0.18 }] },
    { id: 'arpeggio', name: 'Arpeggio', icon: '🎼', iconImg: 'img/abilities/bard/arpeggio.jpg', school: 'Magia', type: 'heal', requiredLevel: 14, baseDamage: 20, spellPowerRatio: 0.8, costPct: 0.22, castType: 'instant', cooldown: 0, isHot: true, hotDuration: 4, generatesNote: 6, description: 'Cura al objetivo gradualmente durante 4 turnos. Genera un La.', damageRanges: [{ rank: 1, level: 14, min: 80, max: 80 }, { rank: 2, level: 22, min: 140, max: 140 }, { rank: 3, level: 30, min: 220, max: 220 }], dotScales: true, dotRanges: [{ rank: 1, level: 14, value: 12, duration: 4 }, { rank: 2, level: 22, value: 20, duration: 4 }, { rank: 3, level: 30, value: 32, duration: 5 }] },
    { id: 'fortissimo', name: 'Fortissimo', icon: '💥', iconImg: 'img/abilities/bard/fortissimo.jpg', school: 'Magia', type: 'damage', requiredLevel: 16, damageType: 'magical', aoe: true, baseDamage: 30, spellPowerRatio: 0.8, costPct: 0.10, castType: 'cast', cooldown: 0, spendsNotes: true, description: 'Remate devastador en area. Consume todas las notas. El dano escala con el valor de las notas gastadas.', damageRanges: [{ rank: 1, level: 16, min: 18, max: 26 }, { rank: 2, level: 24, min: 30, max: 42 }, { rank: 3, level: 32, min: 46, max: 62 }] },
    { id: 'adagio', name: 'Adagio', icon: '🕊️', iconImg: 'img/abilities/bard/adagio.jpg', school: 'Magia', type: 'heal', requiredLevel: 18, aoe: true, baseDamage: 40, spellPowerRatio: 1.0, costPct: 0.10, castType: 'cast', cooldown: 0, spendsNotes: true, description: 'Remate sanador en area. Consume todas las notas. La sanacion escala con el valor de las notas gastadas.', damageRanges: [{ rank: 1, level: 18, min: 35, max: 50 }, { rank: 2, level: 26, min: 55, max: 75 }, { rank: 3, level: 34, min: 80, max: 105 }] },
    { id: 'da_capo', name: 'Da Capo', icon: '🔄', iconImg: 'img/abilities/bard/da_capo.jpg', school: 'Magia', type: 'utility', requiredLevel: 20, aoe: true, costPct: 0, castType: 'instant', cooldown: 0, spendsNotes: true, description: 'Remate inspirador. Consume todas las notas para otorgar un buff de dano al grupo. El poder depende del valor de las notas.', buff: { stat: 'damage_boost', duration: 2, applySelf: false }, buffRanks: [{ rank: 1, level: 20, value: 8, costPct: 0 }, { rank: 2, level: 28, value: 12, costPct: 0 }, { rank: 3, level: 36, value: 18, costPct: 0 }] },
  ],
};
