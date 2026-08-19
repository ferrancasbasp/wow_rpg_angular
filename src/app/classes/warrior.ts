import { CharacterClass } from '../models/game.models';

export const WARRIOR: CharacterClass = {
  name: 'Warrior',
  color: '#C79C6E',
  icon: '⚔️',
  iconImg: 'img/classes/warrior.jpg',

  formulas: {
    hp: (s, lvl) => 40 + s.aguante * 10 + lvl * 6,
    mana: () => 0,
    spellPower: () => 0,
    attackPower: (s) => s.fuerza * 2 - 20,
    manaRegen: () => 0,
  },

  baseStats: { fuerza: 25, agilidad: 12, intelecto: 5, aguante: 22, espiritu: 8 },
  startingLevel: 1,
  statGrowth: { fuerza: 2.0, agilidad: 0.5, intelecto: 0.1, aguante: 1.5, espiritu: 0.3 },
  armor: 8,
  magicResist: 2,

  resource: { type: 'rage', label: 'Ira', color: '#c0392b', max: 100, start: '0' },

  talents: [
    { id: 'master_of_weapons', name: 'Master of Weapons', icon: '⚔️', iconImg: '', description: 'Desbloquea el uso de armas a dos manos y permite combinar arma de una mano con off hand. Los stats de ambos se acumulan.', maxRank: 1, tier: 1, requires: null },
    { id: 'improved_heroic_strike', name: 'Improved Heroic Strike', icon: '⚔️', iconImg: '', description: 'Reduce el coste de ira de Heroic Strike en 1 por punto.', maxRank: 5, tier: 1, requires: null },
    { id: 'anticipation', name: 'Anticipation', icon: '🛡️', iconImg: '', description: 'Aumenta tu armadura física en 1 por punto.', maxRank: 5, tier: 1, requires: null },
    { id: 'improved_bloodrage', name: 'Improved Bloodrage', icon: '🩸', iconImg: 'img/abilities/warrior/bloodrage.jpg', description: 'Aumenta la ira otorgada por Blood Rage en 3 por punto.', maxRank: 2, tier: 2, requires: null },
    { id: 'improved_charge', name: 'Improved Charge', icon: '🏃', iconImg: '', description: 'Aumenta la ira generada por Charge en 2 por punto.', maxRank: 2, tier: 2, requires: null },
    { id: 'cruelty', name: 'Cruelty', icon: '💢', iconImg: 'img/talents/warrior/cruelty.jpg', description: 'Aumenta tu probabilidad de crítico físico un 1% por punto.', maxRank: 5, tier: 2, requires: null },
    { id: 'improved_last_stand', name: 'Improved Last Stand', icon: '🛡️', iconImg: '', description: 'Last Stand también te cura un 5% de vida por punto.', maxRank: 2, tier: 3, requires: null },
    { id: 'improved_cleave', name: 'Improved Cleave', icon: '🪓', iconImg: '', description: 'Aumenta el daño de Cleave un 20% por punto.', maxRank: 2, tier: 3, requires: null },
    { id: 'improved_battle_shout', name: 'Improved Battle Shout', icon: '📢', iconImg: '', description: 'Aumenta el AP otorgado por Battle Shout un 5% y reduce su coste de ira en 1 por punto.', maxRank: 5, tier: 3, requires: null },
  ],

  stances: [
    { id: 'battle', name: 'Battle', icon: '⚔️', iconImg: 'img/talents/warrior/battle_stance.jpg', effect: 'damageBonus', value: 0.10 },
    { id: 'fury', name: 'Fury', icon: '😤', effect: 'critBonus', value: 5 },
    { id: 'protection', name: 'Protection', icon: '🛡️', iconImg: 'img/talents/warrior/protection_stance.jpg', effect: 'armorBonus', value: 5 },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '👊', iconImg: 'img/abilities/warrior/basic_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 0, generatesRage: 5, castType: 'instant', cooldown: 0, description: 'Un golpe básico que genera ira. El daño depende del arma equipada.', usesWeaponDamage: true },
    { id: 'heroic_strike', name: 'Heroic Strike', icon: '⚔️', iconImg: 'img/abilities/rogue/ambush.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 20, spellPowerRatio: 0, costPct: 0, costRage: 15, castType: 'instant', cooldown: 0, description: 'Un golpe potente que gasta ira para hacer daño extra.', weaponMultiplier: 1.0, bonusPerRank: [8, 18, 32, 46, 68] },
    { id: 'charge', name: 'Charge', icon: '🏃', iconImg: 'img/abilities/warrior/charge.jpg', school: 'Físico', type: 'damage', requiredLevel: 4, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 0, generatesRage: 10, castType: 'instant', cooldown: 3, description: 'Carga hacia el enemigo, aturdiéndolo y generando ira.', damageRanges: [{ rank: 1, level: 4, min: 0, max: 0 }], inflictsEffects: [{ type: 'status', name: 'Aturdido', target: 'stunned', value: 0, duration: 1, debuffType: 'none' }] },
    { id: 'rend', name: 'Rend', icon: '🩸', iconImg: 'img/abilities/warrior/rend.jpg', school: 'Físico', type: 'damage', requiredLevel: 6, damageType: 'physical', baseDamage: 10, spellPowerRatio: 0, costPct: 0, costRage: 5, castType: 'instant', cooldown: 0, description: 'Causa sangrado al enemigo. No escala con arma, solo con nivel.', damageRanges: [{ rank: 1, level: 6, min: 4, max: 6 }, { rank: 2, level: 12, min: 8, max: 12 }, { rank: 3, level: 18, min: 16, max: 22 }, { rank: 4, level: 24, min: 28, max: 36 }], inflictsEffects: [{ type: 'dot', name: 'Rend', value: 8, duration: 5, debuffType: 'disease' }], dotScales: true, dotRanges: [{ rank: 1, level: 6, value: 4, duration: 5 }, { rank: 2, level: 12, value: 8, duration: 5 }, { rank: 3, level: 18, value: 16, duration: 5 }, { rank: 4, level: 24, value: 28, duration: 5 }] },
    { id: 'cleave', name: 'Cleave', icon: '🪓', iconImg: 'img/abilities/warrior/cleave.jpg', school: 'Físico', type: 'damage', requiredLevel: 12, damageType: 'physical', baseDamage: 20, spellPowerRatio: 0, costPct: 0, costRage: 15, generatesRage: 0, castType: 'instant', cooldown: 0, description: 'Golpe a dos enemigos cercanos. Envía dos ataques al master.', weaponMultiplier: 1.0, bonusPerRank: [7, 13, 22, 33], multiHit: 2 },
    { id: 'thunder_clap', name: 'Thunder Clap', icon: '⚡', iconImg: 'img/abilities/warrior/thunder_clap.jpg', school: 'Físico', type: 'damage', requiredLevel: 14, damageType: 'physical', baseDamage: 15, spellPowerRatio: 0, costPct: 0, costRage: 10, castType: 'instant', cooldown: 2, description: 'Daño en área que ralentiza a los enemigos.', damageRanges: [{ rank: 1, level: 14, min: 8, max: 12 }, { rank: 2, level: 20, min: 14, max: 20 }, { rank: 3, level: 26, min: 24, max: 32 }, { rank: 4, level: 32, min: 38, max: 50 }], aoe: true, inflictsEffects: [{ type: 'debuff', name: 'Ralentizado', stat: 'speed', value: 1, duration: 2, debuffType: 'none' }] },
    { id: 'shout', name: 'Battle Shout', icon: '📢', iconImg: 'img/abilities/warrior/battle_shout.jpg', school: 'Físico', type: 'utility', requiredLevel: 8, costPct: 0, costRage: 10, castType: 'instant', cooldown: 0, description: 'Aumenta el Poder de Ataque de todo el equipo.', buff: { stat: 'attackPower', duration: 6, applySelf: true }, partyBuff: true, buffRanks: [{ rank: 1, level: 8, value: 30, costRage: 10 }, { rank: 2, level: 18, value: 60, costRage: 10 }, { rank: 3, level: 28, value: 100, costRage: 10 }] },
    { id: 'taunt', name: 'Taunt', icon: '🗯️', iconImg: 'img/abilities/warrior/taunt.jpg', school: 'Físico', type: 'utility', requiredLevel: 4, costPct: 0, costRage: 0, castType: 'instant', cooldown: 4, description: 'Obliga al enemigo a atacarte durante su próximo turno.', buff: null },
    { id: 'bloodrage', name: 'Blood Rage', icon: '🩸', iconImg: 'img/abilities/warrior/bloodrage.jpg', school: 'Físico', type: 'utility', requiredLevel: 2, costPct: 0, costRage: 0, castType: 'instant', cooldown: 6, noGcd: true, description: 'Pierde 15% de vida máxima y gana 20 de ira. No usable en estancia Defensiva.', buff: null, blockedStance: 'protection' },
    { id: 'last_stand', name: 'Last Stand', icon: '🛡️', iconImg: 'img/abilities/warrior/last_stand.jpg', school: 'Físico', type: 'utility', requiredLevel: 18, costPct: 0, costRage: 0, castType: 'instant', cooldown: 10, noGcd: true, description: 'Aumenta tu vida máxima un 20% durante 4 turnos. El % de vida actual se mantiene.', buff: { stat: 'maxHP', duration: 4, applySelf: true, isPercent: true }, buffRanks: [{ rank: 1, level: 18, value: 20, costRage: 0 }] },
    { id: 'group_last_stand', name: 'Iron Wall', icon: '🏰', iconImg: '', school: 'Físico', type: 'utility', requiredLevel: 36, costPct: 0, costRage: 0, castType: 'instant', cooldown: 6, noGcd: true, description: 'Aumenta la vida máxima de todo el grupo un 20% durante 4 turnos. Cada jugador debe aplicarse el buff manualmente.', buff: { stat: 'maxHP', duration: 4, applySelf: false, isPercent: true }, buffRanks: [{ rank: 1, level: 36, value: 20, costRage: 0 }] },
  ],
};
