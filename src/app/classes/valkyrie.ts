import { CharacterClass } from '../models/game.models';

export const VALKYRIE: CharacterClass = {
  name: 'Valkyrie',
  color: '#B8C7D9',
  icon: '🪽',
  iconImg: 'img/classes/valkyrie.jpg',

  formulas: {
    hp: (s, lvl) => 40 + s.aguante * 11 + lvl * 7,
    mana: () => 0,
    spellPower: () => 0,
    attackPower: (s) => s.fuerza * 2 - 20,
    manaRegen: () => 0,
  },

  baseStats: { fuerza: 24, agilidad: 12, intelecto: 6, aguante: 26, espiritu: 8 },
  startingLevel: 1,
  statGrowth: { fuerza: 1.8, agilidad: 0.5, intelecto: 0.2, aguante: 1.8, espiritu: 0.4 },
  armor: 12,
  magicResist: 4,

  resource: { type: 'rage', label: 'Ira', color: '#c0392b', max: 100, start: '0' },

  talents: [
    { id: 'valk_toughness', name: 'Dureza Valkiria', icon: '🛡️', iconImg: '', description: 'Aumenta tu armadura física en 3 por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'valk_rage_fury', name: 'Furia de Batalla', icon: '😤', iconImg: '', description: 'Tus ataques básicos generan 2 de ira extra por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'valk_shield_mastery', name: 'Maestría de Escudo', icon: '🛡️', iconImg: '', description: 'Golpe de Escudo inflige un 15% más de daño y tiene un 10% de probabilidad por punto de no gastar CD.', maxRank: 2, tier: 2, requires: null },
    { id: 'valk_taunt', name: 'Voz de Mando', icon: '🗯️', iconImg: '', description: 'Provocar reduce el daño que recibes del objetivo un 5% por punto durante 2 turnos.', maxRank: 2, tier: 2, requires: null },
    { id: 'valk_aegis', name: 'Égida Valkiria', icon: '🛡️', iconImg: '', description: 'Bloqueo de Escudo también otorga un escudo de vida igual al 10% de tu vida máxima por punto.', maxRank: 3, tier: 3, requires: null },
    { id: 'valk_last_breath', name: 'Último Aliento', icon: '💙', iconImg: '', description: 'Cuando tu vida baja del 25% durante el combate, recuperas un 8% de tu vida máxima por punto (una vez por encuentro).', maxRank: 2, tier: 3, requires: null },
  ],

  capstones: [
    { id: 'valk_wings', name: 'Alas de la Valquiria', icon: '🪽', iconImg: '', description: 'Provisional: despliegas tus alas y te vuelves inmune a aturdimientos durante 3 turnos, con +20% de armadura. CD 10.' },
    { id: 'valk_havel', name: 'Valhalla', icon: '⚔️', iconImg: '', description: 'Provisional: canal para resucitar a un aliado caído o aumentar su vida máxima un 15% durante 5 turnos. CD 10.' },
    { id: 'valk_judgment', name: 'Juicio Divino', icon: '✨', iconImg: '', description: 'Provisional: castiga al enemigo con daño sagrado y reduce su poder de ataque un 25% durante 3 turnos. CD 6.' },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '👊', iconImg: 'img/abilities/warrior/basic_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 0, generatesRage: 5, castType: 'instant', cooldown: 0, description: 'Un golpe básico que genera ira. El daño depende del arma equipada.', usesWeaponDamage: true },
    { id: 'valk_strike', name: 'Golpe Valkirio', icon: '⚔️', iconImg: '', school: 'Físico', type: 'damage', requiredLevel: 2, damageType: 'physical', baseDamage: 20, spellPowerRatio: 0, costPct: 0, costRage: 10, generatesRage: 5, castType: 'instant', cooldown: 0, description: 'Un golpe potente que gasta ira para hacer daño extra y genera un poco de ira.', weaponMultiplier: 1.0, bonusPerRank: [8, 18, 32, 46] },
    { id: 'shield_bash', name: 'Golpe de Escudo', icon: '🛡️', iconImg: '', school: 'Físico', type: 'damage', requiredLevel: 4, damageType: 'physical', baseDamage: 15, spellPowerRatio: 0, costPct: 0, costRage: 10, castType: 'instant', cooldown: 3, weaponMultiplier: 0.8, description: 'Golpea con el escudo aturdiendo al enemigo durante 1 turno.', damageRanges: [{ rank: 1, level: 4, min: 10, max: 16 }, { rank: 2, level: 12, min: 20, max: 30 }, { rank: 3, level: 20, min: 34, max: 48 }, { rank: 4, level: 28, min: 52, max: 72 }], inflictsEffects: [{ type: 'status', name: 'Aturdido', target: 'stunned', value: 0, duration: 1, debuffType: 'none' }] },
    { id: 'taunt', name: 'Provocar', icon: '🗯️', iconImg: 'img/abilities/warrior/taunt.jpg', school: 'Físico', type: 'utility', requiredLevel: 4, costPct: 0, costRage: 0, castType: 'instant', cooldown: 4, description: 'Obliga al enemigo a atacarte durante su próximo turno.', buff: null },
    { id: 'shield_block', name: 'Bloqueo de Escudo', icon: '🛡️', iconImg: '', school: 'Físico', type: 'utility', requiredLevel: 6, costPct: 0, costRage: 5, castType: 'instant', cooldown: 3, description: 'Levantas el escudo: +10 de armadura durante 3 turnos.', buff: { stat: 'armor', duration: 3, applySelf: true }, buffRanks: [{ rank: 1, level: 6, value: 10, costRage: 5 }, { rank: 2, level: 14, value: 16, costRage: 5 }, { rank: 3, level: 22, value: 24, costRage: 5 }] },
    { id: 'valk_shout', name: 'Grito de Guerra', icon: '📢', iconImg: '', school: 'Físico', type: 'utility', requiredLevel: 10, costPct: 0, costRage: 10, castType: 'instant', cooldown: 0, description: 'Aumenta el Poder de Ataque de todo el equipo.', buff: { stat: 'attackPower', duration: 6, applySelf: true }, partyBuff: true, buffRanks: [{ rank: 1, level: 10, value: 25, costRage: 10 }, { rank: 2, level: 18, value: 50, costRage: 10 }, { rank: 3, level: 26, value: 85, costRage: 10 }] },
    { id: 'valk_cleave', name: 'Barrido Valkirio', icon: '🪓', iconImg: '', school: 'Físico', type: 'damage', requiredLevel: 12, damageType: 'physical', baseDamage: 18, spellPowerRatio: 0, costPct: 0, costRage: 15, castType: 'instant', cooldown: 0, description: 'Golpea a dos enemigos cercanos. Envía dos ataques al master.', weaponMultiplier: 1.0, bonusPerRank: [7, 13, 22], multiHit: 2 },
  ],
};
