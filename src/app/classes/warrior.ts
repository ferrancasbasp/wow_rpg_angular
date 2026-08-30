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
    { id: 'improved_heroic_strike', name: 'Improved Heroic Strike', icon: '⚔️', iconImg: 'img/abilities/rogue/ambush.jpg', description: 'Reduce el coste de ira de Heroic Strike en 1 por punto y aumenta su daño un 5% por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'anticipation', name: 'Anticipation', icon: '🛡️', iconImg: 'img/abilities/warrior/last_stand.jpg', description: 'Aumenta tu armadura física y mágica en 5 por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'improved_rend', name: 'Improved Rend', icon: '🩸', iconImg: 'img/abilities/warrior/rend.jpg', description: 'Aumenta el daño de Rend un 35% por punto.', maxRank: 2, tier: 1, requires: null },
    { id: 'improved_taunt', name: 'Improved Taunt', icon: '🗯️', iconImg: 'img/abilities/warrior/taunt.jpg', description: 'Taunt ya no consume cooldown global (GCD).', maxRank: 1, tier: 1, requires: { id: 'anticipation', points: 3 } },
    { id: 'endless_rage', name: 'Endless Rage', icon: '🔋', iconImg: 'img/talents/warrior/endless_rage.jpg', description: 'Reduce la ira que pierdes al final del turno en 1 por punto (base 3). Con 3 puntos no pierdes nada.', maxRank: 3, tier: 1, requires: null },
    { id: 'improved_bloodrage', name: 'Improved Bloodrage', icon: '🩸', iconImg: 'img/abilities/warrior/bloodrage.jpg', description: 'Aumenta la ira por turno de Blood Rage en 5 por punto y reduce su coste de vida un 2,5% por punto (base 15%).', maxRank: 2, tier: 2, requires: null },
    { id: 'improved_charge', name: 'Improved Charge', icon: '🏃', iconImg: 'img/abilities/warrior/charge.jpg', description: 'Aumenta la ira generada por Charge en 3 por punto y hace un daño extra del 15% del Heroic Strike por punto.', maxRank: 2, tier: 2, requires: null },
    { id: 'cruelty', name: 'Cruelty', icon: '💢', iconImg: 'img/talents/warrior/cruelty.jpg', description: 'Aumenta tu probabilidad de crítico físico un 1% por punto.', maxRank: 5, tier: 2, requires: null },
    { id: 'improved_stances', name: 'Improved Stances', icon: '🛡️', iconImg: 'img/talents/warrior/improved_stances.jpg', description: 'Aumenta la armadura de Protection en 4, el crítico de Fury en 2% y el daño de Battle en 2% por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'improved_last_stand', name: 'Improved Last Stand', icon: '🛡️', iconImg: 'img/abilities/warrior/last_stand.jpg', description: 'Last Stand te cura un 5% de vida por punto y reduce su cooldown en 1 turno por punto.', maxRank: 2, tier: 3, requires: null },
    { id: 'improved_cleave', name: 'Improved Cleave', icon: '🪓', iconImg: 'img/abilities/warrior/cleave.jpg', description: 'Aumenta el daño de Cleave un 20% por punto.', maxRank: 2, tier: 3, requires: null },
    { id: 'improved_battle_shout', name: 'Improved Battle Shout', icon: '📢', iconImg: 'img/abilities/warrior/battle_shout.jpg', description: 'Aumenta el AP otorgado por Battle Shout un 6% y reduce su coste de ira en 2 por punto.', maxRank: 3, tier: 3, requires: null },
    { id: 'unyielding_strikes', name: 'Unyielding Strikes', icon: '⚡', iconImg: 'img/abilities/warrior/basic_attack.jpg', description: 'Los ataques básicos tienen un 4% de probabilidad por punto de no gastar acción y un +1% de crítico por punto.', maxRank: 3, tier: 3, requires: null },
  ],

  stances: [
    { id: 'battle', name: 'Battle', icon: '⚔️', iconImg: 'img/talents/warrior/battle_stance.jpg', effect: 'damageBonus', value: 0.10 },
    { id: 'fury', name: 'Fury', icon: '😤', effect: 'critBonus', value: 5 },
    { id: 'protection', name: 'Protection', icon: '🛡️', iconImg: 'img/talents/warrior/protection_stance.jpg', effect: 'armorBonus', value: 5 },
  ],

  capstones: [
    { id: 'shield_wall', name: 'Shield Wall', icon: '🛡️', iconImg: 'img/capstones/warrior/shield_wall.jpg', description: 'Adopta una postura defensiva extrema durante 3 turnos, reduciendo todo el daño recibido en un 60%. Mientras Shield Wall está activo, eres inmune a efectos de control de masas. CD 10.' },
    { id: 'recklessness', name: 'Recklessness', icon: '🔥', iconImg: 'img/capstones/warrior/recklessness.jpg', description: 'Entras en un estado de frenesí durante 3 turnos, aumentando tu probabilidad de golpe crítico un 20% y tu daño crítico un 20%. Mientras Recklessness está activo, recibes un 30% más de daño de todas las fuentes. CD 10.' },
    { id: 'colossus_smash', name: 'Colossus Smash', icon: '🗿', iconImg: 'img/capstones/warrior/colossus_smash.jpg', description: 'Golpea brutalmente al objetivo infligiendo el doble del daño de tu arma y destroza su armadura (−30) durante 2 turnos. Cuesta 15 de ira. CD 6.' },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '👊', iconImg: 'img/abilities/warrior/basic_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 0, generatesRage: 5, castType: 'instant', cooldown: 0, description: 'Un golpe básico que genera ira. El daño depende del arma equipada.', usesWeaponDamage: true },
    { id: 'heroic_strike', name: 'Heroic Strike', icon: '⚔️', iconImg: 'img/abilities/rogue/ambush.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 20, spellPowerRatio: 0, costPct: 0, costRage: 15, castType: 'instant', cooldown: 0, description: 'Un golpe potente que gasta ira para hacer daño extra.', weaponMultiplier: 1.0, bonusPerRank: [8, 18, 32, 46, 68] },
    { id: 'charge', name: 'Charge', icon: '🏃', iconImg: 'img/abilities/warrior/charge.jpg', school: 'Físico', type: 'damage', requiredLevel: 4, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 0, generatesRage: 10, castType: 'instant', cooldown: 3, description: 'Carga hacia el enemigo, aturdiéndolo y generando ira.', damageRanges: [{ rank: 1, level: 4, min: 0, max: 0 }], inflictsEffects: [{ type: 'status', name: 'Aturdido', target: 'stunned', value: 0, duration: 1, debuffType: 'none' }] },
    { id: 'rend', name: 'Rend', icon: '🩸', iconImg: 'img/abilities/warrior/rend.jpg', school: 'Físico', type: 'damage', requiredLevel: 6, damageType: 'physical', baseDamage: 10, spellPowerRatio: 0, costPct: 0, costRage: 5, castType: 'instant', cooldown: 0, description: 'Causa sangrado al enemigo. No escala con arma, solo con nivel.', damageRanges: [{ rank: 1, level: 6, min: 4, max: 6 }, { rank: 2, level: 12, min: 8, max: 12 }, { rank: 3, level: 18, min: 16, max: 22 }, { rank: 4, level: 24, min: 28, max: 36 }], inflictsEffects: [{ type: 'dot', name: 'Rend', value: 8, duration: 5, debuffType: 'disease' }], dotScales: true, dotRanges: [{ rank: 1, level: 6, value: 8, duration: 5 }, { rank: 2, level: 12, value: 16, duration: 5 }, { rank: 3, level: 18, value: 30, duration: 5 }, { rank: 4, level: 24, value: 48, duration: 5 }] },
    { id: 'sunder_armor', name: 'Sunder Armor', icon: '🛡️', iconImg: 'img/abilities/warrior/taunt.jpg', school: 'Físico', type: 'damage', requiredLevel: 14, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 10, castType: 'instant', cooldown: 0, weaponMultiplier: 1.0, description: 'Golpe contundente que golpea más fuerte que el ataque básico y destroza la armadura del enemigo: reduce su armadura (8/12/18 según rango) y se acumula hasta 5 veces.', damageRanges: [{ rank: 1, level: 14, min: 8, max: 12 }, { rank: 2, level: 20, min: 16, max: 22 }, { rank: 3, level: 26, min: 28, max: 38 }], armorShred: [8, 12, 18], inflictsEffects: [{ type: 'debuff', name: 'Armadura Destrozada', stat: 'armor', value: 8, duration: 4, stackable: true, maxStacks: 5, debuffType: 'none' }] },
    { id: 'cleave', name: 'Cleave', icon: '🪓', iconImg: 'img/abilities/warrior/cleave.jpg', school: 'Físico', type: 'damage', requiredLevel: 12, damageType: 'physical', baseDamage: 20, spellPowerRatio: 0, costPct: 0, costRage: 15, generatesRage: 0, castType: 'instant', cooldown: 0, description: 'Golpe a dos enemigos cercanos. Envía dos ataques al master.', weaponMultiplier: 1.0, bonusPerRank: [7, 13, 22, 33], multiHit: 2 },
    { id: 'thunder_clap', name: 'Thunder Clap', icon: '⚡', iconImg: 'img/abilities/warrior/thunder_clap.jpg', school: 'Físico', type: 'damage', requiredLevel: 14, damageType: 'physical', baseDamage: 15, spellPowerRatio: 0, costPct: 0, costRage: 10, castType: 'instant', cooldown: 2, noWeaponScaling: true, description: 'Daño en área que ralentiza a los enemigos.', damageRanges: [{ rank: 1, level: 14, min: 8, max: 12 }, { rank: 2, level: 20, min: 14, max: 20 }, { rank: 3, level: 26, min: 24, max: 32 }, { rank: 4, level: 32, min: 38, max: 50 }], aoe: true, inflictsEffects: [{ type: 'debuff', name: 'Ralentizado', stat: 'speed', value: 1, duration: 2, debuffType: 'none' }] },
    { id: 'shout', name: 'Battle Shout', icon: '📢', iconImg: 'img/abilities/warrior/battle_shout.jpg', school: 'Físico', type: 'utility', requiredLevel: 8, costPct: 0, costRage: 10, castType: 'instant', cooldown: 0, description: 'Aumenta el Poder de Ataque de todo el equipo.', buff: { stat: 'attackPower', duration: 6, applySelf: true }, partyBuff: true, buffRanks: [{ rank: 1, level: 8, value: 30, costRage: 10 }, { rank: 2, level: 18, value: 60, costRage: 10 }, { rank: 3, level: 28, value: 100, costRage: 10 }] },
    { id: 'taunt', name: 'Taunt', icon: '🗯️', iconImg: 'img/abilities/warrior/taunt.jpg', school: 'Físico', type: 'utility', requiredLevel: 4, costPct: 0, costRage: 0, castType: 'instant', cooldown: 4, description: 'Obliga al enemigo a atacarte durante su próximo turno.', buff: null },
    { id: 'master_of_weapons', name: 'Master of Weapons', icon: '⚔️', iconImg: 'img/talents/warrior/master_of_weapons.jpg', school: 'Pasiva', type: 'utility', requiredLevel: 8, costPct: 0, costRage: 0, castType: 'instant', cooldown: 0, passive: true, description: 'Pasiva aprendida al nivel 8: desbloquea el uso de armas a dos manos y permite combinar arma de una mano con off hand. Los stats de ambos se acumulan.' },
    { id: 'bloodrage', name: 'Blood Rage', icon: '🩸', iconImg: 'img/abilities/warrior/bloodrage.jpg', school: 'Físico', type: 'utility', requiredLevel: 2, costPct: 0, costRage: 0, castType: 'instant', cooldown: 5, noGcd: true, rageGain: 20, healthCostPct: 0.15, description: 'Pierde 15% de vida máxima y gana 20 de ira. Otorga 3 de ira por turno durante 2 turnos. No usable en estancia Defensiva.', buff: { stat: 'bloodrage', duration: 2, applySelf: true }, buffRanks: [{ rank: 1, level: 2, value: 3, costRage: 0 }], blockedStance: 'protection' },
    { id: 'last_stand', name: 'Last Stand', icon: '🛡️', iconImg: 'img/abilities/warrior/last_stand.jpg', school: 'Físico', type: 'utility', requiredLevel: 18, costPct: 0, costRage: 0, castType: 'instant', cooldown: 10, noGcd: true, description: 'Aumenta tu vida máxima un 20% durante 4 turnos. El % de vida actual se mantiene.', buff: { stat: 'maxHP', duration: 4, applySelf: true, isPercent: true }, buffRanks: [{ rank: 1, level: 18, value: 20, costRage: 0 }] },
    { id: 'shield_wall', name: 'Shield Wall', icon: '🛡️', iconImg: 'img/capstones/warrior/shield_wall.jpg', school: 'Físico', type: 'utility', requiredLevel: 1, costPct: 0, costRage: 0, castType: 'instant', cooldown: 10, description: 'Postura defensiva extrema durante 3 turnos: todo el daño recibido se reduce un 60% y eres inmune a efectos de control de masas.', buff: null, capstoneGate: 'shield_wall' },
    { id: 'recklessness', name: 'Recklessness', icon: '🔥', iconImg: 'img/capstones/warrior/recklessness.jpg', school: 'Físico', type: 'utility', requiredLevel: 1, costPct: 0, costRage: 0, castType: 'instant', cooldown: 10, description: 'Frenesi durante 3 turnos: +20% critico y +20% danyo critico. Recibes un 30% mas de danyo de todas las fuentes. CD 10.', buff: null, capstoneGate: 'recklessness' },
    { id: 'colossus_smash', name: 'Colossus Smash', icon: '🗿', iconImg: 'img/capstones/warrior/colossus_smash.jpg', school: 'Físico', type: 'utility', requiredLevel: 1, costPct: 0, costRage: 15, castType: 'instant', cooldown: 6, description: 'Golpe bestia: inflige el doble del dano de tu arma y destroza la armadura del enemigo (−30) durante 2 turnos. Cuesta 15 de ira. CD 6.', buff: null, capstoneGate: 'colossus_smash' },
    { id: 'group_last_stand', name: 'Iron Wall', icon: '🏰', iconImg: '', school: 'Físico', type: 'utility', requiredLevel: 20, costPct: 0, costRage: 0, castType: 'instant', cooldown: 6, noGcd: true, description: 'Aumenta la vida máxima de todo el grupo un 15% durante 4 turnos. Cada jugador debe aplicarse el buff manualmente.', buff: { stat: 'maxHP', duration: 4, applySelf: false, isPercent: true }, partyBuff: true, buffRanks: [{ rank: 1, level: 20, value: 15, costRage: 0 }, { rank: 2, level: 28, value: 20, costRage: 0 }] },
  ],
};
