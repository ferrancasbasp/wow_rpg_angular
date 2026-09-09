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
    { id: 'valk_recover_magic', name: 'Recover of Magic', icon: '🔮', iconImg: '', description: 'Requiere nivel 5. Al recibir daño mágico, un 30% del daño por punto se añade a tu carga de escudo.', maxRank: 3, tier: 1, requires: null },
  ],

  capstones: [
    { id: 'valk_wings', name: 'Alas de la Valquiria', icon: '🪽', iconImg: '', description: 'Provisional: despliegas tus alas y te vuelves inmune a aturdimientos durante 3 turnos, con +20% de armadura. CD 10.' },
    { id: 'valk_havel', name: 'Valhalla', icon: '⚔️', iconImg: '', description: 'Provisional: canal para resucitar a un aliado caído o aumentar su vida máxima un 15% durante 5 turnos. CD 10.' },
    { id: 'valk_judgment', name: 'Juicio Divino', icon: '✨', iconImg: '', description: 'Provisional: castiga al enemigo con daño sagrado y reduce su poder de ataque un 25% durante 3 turnos. CD 6.' },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '👊', iconImg: 'img/abilities/warrior/basic_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 0, generatesRage: 5, castType: 'instant', cooldown: 0, description: 'Un golpe básico que genera ira. El daño depende del arma equipada.', usesWeaponDamage: true },
    { id: 'empalar', name: 'Empalar', icon: '🔱', iconImg: '', school: 'Físico', type: 'damage', requiredLevel: 2, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 10, castType: 'instant', cooldown: 0, description: 'Empala al enemigo con tu lanza. Gastas 10 de ira y conviertes el 50% del daño infligido en carga de la lanza.', usesWeaponDamage: true },
    { id: 'shield_bash', name: 'Golpe de Escudo', icon: '🛡️', iconImg: '', school: 'Físico', type: 'damage', requiredLevel: 4, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 5, castType: 'instant', cooldown: 0, description: 'Golpea con el escudo. Gastas 5 de ira, generas carga de escudo igual al 100% del daño y provocas al enemigo.', usesWeaponDamage: true },
    { id: 'valk_luminous_cone', name: 'Cono Luminoso', icon: '✨', iconImg: '', school: 'Sagrado', type: 'utility', requiredLevel: 8, costPct: 0, costRage: 0, castType: 'instant', cooldown: 4, description: 'Ciega a un enemigo: sus ataques tienen probabilidad de no hacer nada durante 2 turnos.', buff: null, inflictsEffects: [{ type: 'debuff', name: 'Cono Luminoso', target: 'misfire_chance', value: 20, duration: 2, debuffType: 'magic', stackable: false }], buffRanks: [{ rank: 1, level: 8, value: 20 }, { rank: 2, level: 14, value: 25 }, { rank: 3, level: 20, value: 30 }, { rank: 4, level: 26, value: 35 }] },
    { id: 'valk_angel_jump', name: 'Salto de Ángel', icon: '🕊️', iconImg: '', school: 'Físico', type: 'utility', requiredLevel: 6, costPct: 0, costRage: 0, castType: 'instant', cooldown: 5, noGcd: true, description: 'Te desplazas sin gastar acción. No consume GCD. CD 5 turnos.', buff: null },
    { id: 'valk_speed_of_light', name: 'Speed of Light', icon: '⚡', iconImg: '', school: 'Físico', type: 'utility', requiredLevel: 14, costPct: 0, costRage: 0, castType: 'instant', cooldown: 6, description: 'Ganas un punto de acción adicional durante 2 turnos. CD 6.', buff: { stat: 'actions_per_turn', duration: 2, applySelf: true }, buffRanks: [{ rank: 1, level: 14, value: 1 }, { rank: 2, level: 22, value: 2 }] },
    { id: 'valk_odins_will', name: 'Odins Will', icon: '🪽', iconImg: '', school: 'Sagrado', type: 'utility', requiredLevel: 18, costPct: 0, costRage: 0, castType: 'instant', cooldown: 4, description: 'Despliegas tus alas: durante 2 turnos, toda la energía (cargas de lanza o escudo) que generas aumenta.', buff: { stat: 'valkyrie_charge_gain', duration: 2, applySelf: true }, buffRanks: [{ rank: 1, level: 18, value: 50 }, { rank: 2, level: 26, value: 75 }, { rank: 3, level: 34, value: 100 }] },
    { id: 'taunt', name: 'Provocar', icon: '🗯️', iconImg: 'img/abilities/warrior/taunt.jpg', school: 'Físico', type: 'utility', requiredLevel: 4, costPct: 0, costRage: 0, castType: 'instant', cooldown: 4, description: 'Obliga al enemigo a atacarte durante su próximo turno.', buff: null },
    { id: 'shield_block', name: 'Bloqueo de Escudo', icon: '🛡️', iconImg: '', school: 'Físico', type: 'utility', requiredLevel: 6, costPct: 0, costRage: 5, castType: 'instant', cooldown: 3, description: 'Levantas el escudo: +10 de armadura durante 3 turnos.', buff: { stat: 'armor', duration: 3, applySelf: true }, buffRanks: [{ rank: 1, level: 6, value: 10, costRage: 5 }, { rank: 2, level: 14, value: 16, costRage: 5 }, { rank: 3, level: 22, value: 24, costRage: 5 }] },
    { id: 'valk_shout', name: 'Grito de Guerra', icon: '📢', iconImg: '', school: 'Físico', type: 'utility', requiredLevel: 10, costPct: 0, costRage: 10, castType: 'instant', cooldown: 0, description: 'Aumenta el Poder de Ataque de todo el equipo.', buff: { stat: 'attackPower', duration: 6, applySelf: true }, partyBuff: true, buffRanks: [{ rank: 1, level: 10, value: 25, costRage: 10 }, { rank: 2, level: 18, value: 50, costRage: 10 }, { rank: 3, level: 26, value: 85, costRage: 10 }] },
    { id: 'valk_cleave', name: 'Barrido Valkirio', icon: '🪓', iconImg: '', school: 'Físico', type: 'damage', requiredLevel: 12, damageType: 'physical', baseDamage: 18, spellPowerRatio: 0, costPct: 0, costRage: 15, castType: 'instant', cooldown: 0, description: 'Ataca en cono a hasta tres enemigos. Envía tres ataques al master.', weaponMultiplier: 1.0, bonusPerRank: [7, 13, 22], multiHit: 3 },
  ],
};
