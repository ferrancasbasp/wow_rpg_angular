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
    { id: 'valk_recover_magic', name: 'Recover of Magic', icon: '🔮', iconImg: '', description: 'Requiere nivel 5. Al recibir daño mágico, un 30% del daño por punto se añade a tu carga de escudo.', maxRank: 3, tier: 1, requires: null },
  ],

  capstones: [],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '👊', iconImg: 'img/abilities/warrior/basic_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 0, generatesRage: 5, castType: 'instant', cooldown: 0, description: 'Un golpe básico que genera ira. El daño depende del arma equipada.', usesWeaponDamage: true },
    { id: 'empalar', name: 'Empalar', icon: '🔱', iconImg: '', school: 'Físico', type: 'damage', requiredLevel: 2, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 10, castType: 'instant', cooldown: 0, description: 'Empala al enemigo con tu lanza. Gastas 10 de ira y conviertes el 50% del daño infligido en carga de la lanza.', usesWeaponDamage: true },
    { id: 'valk_mending', name: 'Mending', icon: '💚', iconImg: '', school: 'Sagrado', type: 'heal', requiredLevel: 5, baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 0, castType: 'instant', cooldown: 2, description: 'Gasta toda la carga de lanza o escudo seleccionada y te cura esa cantidad más una cantidad fija que aumenta con el rango.', buff: null, buffRanks: [{ rank: 1, level: 5, value: 60 }, { rank: 2, level: 12, value: 100 }, { rank: 3, level: 20, value: 150 }, { rank: 4, level: 28, value: 210 }] },
    { id: 'shield_bash', name: 'Golpe de Escudo', icon: '🛡️', iconImg: '', school: 'Físico', type: 'damage', requiredLevel: 4, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 5, castType: 'instant', cooldown: 0, description: 'Golpea con el escudo. Gastas 5 de ira, generas carga de escudo igual al 100% del daño y provocas al enemigo.', usesWeaponDamage: true },
    { id: 'valk_luminous_cone', name: 'Cono Luminoso', icon: '✨', iconImg: '', school: 'Sagrado', type: 'utility', requiredLevel: 8, costPct: 0, costRage: 0, castType: 'instant', cooldown: 4, description: 'Ciega a un enemigo: sus ataques tienen probabilidad de no hacer nada durante 2 turnos.', buff: null, inflictsEffects: [{ type: 'debuff', name: 'Cono Luminoso', target: 'misfire_chance', value: 20, duration: 2, debuffType: 'magic', stackable: false }], buffRanks: [{ rank: 1, level: 8, value: 20 }, { rank: 2, level: 14, value: 25 }, { rank: 3, level: 20, value: 30 }, { rank: 4, level: 26, value: 35 }] },
    { id: 'valk_divine_protection', name: 'Divine Protection', icon: '🐑', iconImg: '', school: 'Sagrado', type: 'utility', requiredLevel: 12, costPct: 0, costRage: 0, castType: 'instant', cooldown: 3, description: 'Gasta toda la carga de lanza o escudo seleccionada: aumenta tu armadura una cantidad fija y, por cada 100 de carga gastada, dura 1 turno adicional.', buff: { stat: 'armor', duration: 2, applySelf: true }, buffRanks: [{ rank: 1, level: 12, value: 10 }, { rank: 2, level: 20, value: 16 }, { rank: 3, level: 28, value: 24 }, { rank: 4, level: 36, value: 34 }] },
    { id: 'valk_angel_jump', name: 'Salto de Ángel', icon: '🕊️', iconImg: '', school: 'Físico', type: 'utility', requiredLevel: 6, costPct: 0, costRage: 0, castType: 'instant', cooldown: 5, noGcd: true, description: 'Te desplazas sin gastar acción. No consume GCD. CD 5 turnos.', buff: null },
    { id: 'valk_speed_of_light', name: 'Speed of Light', icon: '⚡', iconImg: '', school: 'Físico', type: 'utility', requiredLevel: 14, costPct: 0, costRage: 0, castType: 'instant', cooldown: 6, description: 'Ganas un punto de acción adicional durante 2 turnos. CD 6.', buff: { stat: 'actions_per_turn', duration: 2, applySelf: true }, buffRanks: [{ rank: 1, level: 14, value: 1 }, { rank: 2, level: 22, value: 2 }] },
    { id: 'valk_odins_will', name: 'Odins Will', icon: '🪽', iconImg: '', school: 'Sagrado', type: 'utility', requiredLevel: 18, costPct: 0, costRage: 0, castType: 'instant', cooldown: 4, description: 'Despliegas tus alas durante 2 turnos: generas más energía (cargas de lanza o escudo) y desbloqueas Alza el Vuelo, Golpe en Picado y Descarga de Rayo.', buff: { stat: 'valkyrie_charge_gain', duration: 2, applySelf: true }, buffRanks: [{ rank: 1, level: 18, value: 50 }, { rank: 2, level: 26, value: 75 }, { rank: 3, level: 34, value: 100 }] },
    { id: 'valk_take_flight', name: 'Alza el Vuelo', icon: '🕊️', iconImg: '', school: 'Físico', type: 'utility', requiredLevel: 18, costPct: 0, costRage: 0, castType: 'instant', cooldown: 0, description: 'Asciendes al cielo. Solo usable mientras dura el buffo de Odins Will.', buff: null },
    { id: 'valk_dive_strike', name: 'Golpe en Picado', icon: '🦅', iconImg: '', school: 'Físico', type: 'damage', requiredLevel: 20, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 30, castType: 'instant', cooldown: 0, description: 'Requiere estar en el cielo. Gasta 30 de ira y causa mucho daño.', damageRanges: [{ rank: 1, level: 20, min: 60, max: 80 }, { rank: 2, level: 27, min: 110, max: 145 }, { rank: 3, level: 34, min: 180, max: 230 }] },
    { id: 'valk_lightning_bolt', name: 'Descarga de Rayo', icon: '⚡', iconImg: '', school: 'Sagrado', type: 'damage', requiredLevel: 22, damageType: 'magical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 0, castType: 'instant', cooldown: 0, description: 'Ataque a distancia: causa un daño plano más toda la carga de lanza o escudo seleccionada que gastes. Solo usable durante Odins Will.', damageRanges: [{ rank: 1, level: 22, min: 30, max: 40 }, { rank: 2, level: 30, min: 50, max: 65 }, { rank: 3, level: 38, min: 80, max: 100 }] },
    { id: 'valk_cleave', name: 'Barrido Valkirio', icon: '🪓', iconImg: '', school: 'Físico', type: 'damage', requiredLevel: 12, damageType: 'physical', baseDamage: 18, spellPowerRatio: 0, costPct: 0, costRage: 15, castType: 'instant', cooldown: 0, description: 'Ataca en cono a hasta tres enemigos. Envía tres ataques al master.', weaponMultiplier: 1.0, bonusPerRank: [7, 13, 22], multiHit: 3 },
  ],
};
