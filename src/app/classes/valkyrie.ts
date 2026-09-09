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
    { id: 'hate', name: 'Hate', icon: '😡', iconImg: 'img/talents/valkyrie/hate.jpg', description: 'Al recibir un golpe ganas 2 puntos de ira adicionales por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'endurance', name: 'Endurance', icon: '❤️', iconImg: 'img/talents/valkyrie/endurance.jpg', description: 'Aumenta tu stamina un 3% y tu probabilidad de crítico un 1% por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'improved_abs_magic', name: 'Improved ABS Magic', icon: '✨', iconImg: 'img/abilities/valkyrie/absortion_of_magic.jpg', description: 'Aumenta la carga de energía de la pasiva Absortion of Magic un 5% por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'critical_energy', name: 'Critical energy', icon: '💥', iconImg: 'img/talents/valkyrie/critical_energy.jpg', description: 'Los críticos con ataques de lanza cargan un 33% más de energía por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'energy_conduit', name: 'Energy Conduit', icon: '🔄', iconImg: 'img/talents/valkyrie/energy_conduit.jpg', description: 'El 6% de la energía gastada en la lanza se transfiere al escudo, y viceversa, por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'twin_mending', name: 'Twin Mending', icon: '🤝', iconImg: 'img/talents/valkyrie/twin_mending.jpg', description: 'Mending cura además a otra persona de la party un 20% de su potencia por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'warded', name: 'Warded', icon: '🛡️', iconImg: 'img/talents/valkyrie/warded.jpg', description: 'Reduce el coste de ira de Slam en 1 por punto y aumenta su daño un 10% por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'improved_fly_the_nest', name: 'Improved Fly the Nest', icon: '🕊️', iconImg: 'img/abilities/valkyrie/fly_the_nest.jpg', description: 'Fly the Nest te da energía de lanza y escudo: R1 = tu nivel, R2 = 2×nivel de cada una.', maxRank: 2, tier: 2, requires: null },
    { id: 'improved_javelin', name: 'Improved Javelin', icon: '⚡', iconImg: 'img/talents/valkyrie/improved_javelin.jpg', description: 'Javelin of Lightning aporta un +10% de tu carga al daño por punto (70% base). A rango 3 vuelves al 100%.', maxRank: 3, tier: 2, requires: null },
    { id: 'improved_odins_will', name: "Improved Odin's Will", icon: '🪽', iconImg: 'img/abilities/valkyrie/odins_will.jpg', description: "Aumenta la energía generada durante Odin's Will un 5% adicional por punto.", maxRank: 3, tier: 3, requires: null },
    { id: 'odins_fly', name: "Odin's Fly", icon: '🦅', iconImg: 'img/abilities/valkyrie/fly_indicator.jpg', description: "Al lanzar Odin's Will haces un Fly the Nest gratuito: vuelas y se beneficia de sus talentos (Improved Fly the Nest).", maxRank: 1, tier: 3, requires: { id: 'improved_odins_will', points: 3 } },
    { id: 'hurtfull_lightning', name: 'Hurtfull lightning', icon: '⚡', iconImg: 'img/talents/valkyrie/hurtfull_lightning.jpg', description: 'Aumenta tu daño crítico un 5% y tu probabilidad de crítico un 1% por punto.', maxRank: 3, tier: 3, requires: null },
    { id: 'lightning_vortex', name: 'Lightning Vortex', icon: '🌀', iconImg: 'img/talents/valkyrie/lightning_vortex.jpg', description: 'Aumenta el daño de Javelin of Lightning un 10% por punto. Con al menos 1 punto, también otorga un +5% fijo a la contribución de energía de Plunge, Impale y Slam.', maxRank: 2, tier: 3, requires: null },
    { id: 'perseverance', name: 'Perseverance', icon: '⏳', iconImg: 'img/talents/valkyrie/perseverance.jpg', description: 'Aumenta la duración de Holy Mantle y Speed of Light en 1 turno por punto.', maxRank: 2, tier: 3, requires: null },
  ],

  capstones: [
    { id: 'bless_by_odin', name: 'Bless by Odin', icon: '🪽', iconImg: 'img/capstones/valkyrie/bless_by_odin.jpg', description: "Odin's Will dura 1 turno más y aumentas un 25% la energía que generas mientras está activo." },
    { id: 'call_from_valhalla', name: 'Call from Valhalla', icon: '⚔️', iconImg: 'img/capstones/valkyrie/call_from_valhalla.jpg', description: 'Si tu vida llega a 0 en combate, una vez por encuentro renaces al instante con el 50% de tu vida máxima.' },
    { id: 'valkyries_call', name: "Valkyrie's Call", icon: '📯', iconImg: 'img/capstones/valkyrie/valkyries_call.jpg', description: 'Restaura 1 punto de acción a todos los aliados y les cura un 15% de tu vida máxima.' },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '👊', iconImg: 'img/abilities/warrior/basic_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 0, generatesRage: 5, castType: 'instant', cooldown: 0, description: 'Un golpe básico que genera ira. El daño depende del arma equipada.', usesWeaponDamage: true },
    { id: 'valk_recover_magic', name: 'Absortion of Magic', icon: '🔮', iconImg: 'img/abilities/valkyrie/absortion_of_magic.jpg', school: 'Pasiva', type: 'utility', requiredLevel: 5, costPct: 0, castType: 'instant', cooldown: 0, passive: true, description: 'Pasiva aprendida al nivel 5: al recibir daño mágico, un 30% del daño se añade a tu carga de escudo.' },
    { id: 'empalar', name: 'Impale', icon: '🔱', iconImg: 'img/abilities/valkyrie/empalar.jpg', school: 'Físico', type: 'damage', requiredLevel: 2, damageType: 'physical', baseDamage: 20, spellPowerRatio: 0, costPct: 0, costRage: 10, castType: 'instant', cooldown: 0, description: 'Un golpe potente igual que un ataque básico más un daño extra que crece con el rango. Gastas 10 de ira y el 50% del daño infligido se convierte en carga de la lanza.', weaponMultiplier: 1.0, bonusPerRank: [6, 14, 24, 36] },
    { id: 'valk_mending', name: 'Mending', icon: '💚', iconImg: 'img/abilities/valkyrie/mending.jpg', school: 'Sagrado', type: 'heal', requiredLevel: 5, baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 0, castType: 'cast', cooldown: 2, description: 'Gasta toda la carga de lanza o escudo seleccionada y te cura esa cantidad más una cantidad fija que aumenta con el rango.', buff: null, buffRanks: [{ rank: 1, level: 5, value: 60 }, { rank: 2, level: 12, value: 100 }, { rank: 3, level: 20, value: 150 }, { rank: 4, level: 28, value: 210 }] },
    { id: 'shield_bash', name: 'Slam', icon: '🛡️', iconImg: 'img/abilities/valkyrie/slam.jpg', school: 'Físico', type: 'damage', requiredLevel: 4, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 5, castType: 'instant', cooldown: 2, description: 'Golpea con el escudo: el daño escala con la armadura de tu escudo más un bonus que crece con tu nivel, no con tu arma. Gastas 5 de ira, provocas y ganas carga de escudo igual al 100% del daño infligido. CD 2 turnos.' },
    { id: 'valk_luminous_cone', name: 'Cone of Light', icon: '✨', iconImg: 'img/abilities/valkyrie/cone_of_light.jpg', school: 'Sagrado', type: 'utility', requiredLevel: 8, costPct: 0, costRage: 0, castType: 'cast', cooldown: 5, description: 'Deslumbra a un enemigo: sus ataques tienen probabilidad de fallar durante 2 turnos.', buff: null, inflictsEffects: [{ type: 'debuff', name: 'Cone of Light', target: 'misfire_chance', value: 20, duration: 2, debuffType: 'magic', stackable: false }], buffRanks: [{ rank: 1, level: 8, value: 20 }, { rank: 2, level: 14, value: 25 }, { rank: 3, level: 20, value: 30 }, { rank: 4, level: 26, value: 35 }] },
    { id: 'valk_divine_protection', name: 'Holy Mantle', icon: '🐑', iconImg: 'img/abilities/valkyrie/holy_mantle.jpg', school: 'Sagrado', type: 'utility', requiredLevel: 12, costPct: 0, costRage: 0, castType: 'instant', cooldown: 3, description: 'Gasta toda la carga seleccionada: aumenta tu armadura una cantidad fija y, por cada 100 de carga gastada, dura 1 turno adicional.', buff: { stat: 'armor', duration: 2, applySelf: true }, buffRanks: [{ rank: 1, level: 12, value: 10 }, { rank: 2, level: 20, value: 16 }, { rank: 3, level: 28, value: 24 }, { rank: 4, level: 36, value: 34 }] },
    { id: 'valk_angel_jump', name: 'Angel Leap', icon: '🕊️', iconImg: 'img/abilities/valkyrie/angel_leap.jpg', school: 'Físico', type: 'utility', requiredLevel: 6, costPct: 0, costRage: 0, castType: 'instant', cooldown: 5, noGcd: true, description: 'Te desplazas sin gastar acción. No consume GCD. CD 5 turnos.', buff: null },
    { id: 'valk_speed_of_light', name: 'Speed of Light', icon: '⚡', iconImg: 'img/abilities/valkyrie/speed_of_light.jpg', school: 'Sagrado', type: 'utility', requiredLevel: 14, costPct: 0, costRage: 15, castType: 'cast', cooldown: 6, description: 'Gastas 15 de ira y ganas un punto de acción adicional durante 2 turnos. CD 6.', buff: { stat: 'actions_per_turn', duration: 2, applySelf: true }, buffRanks: [{ rank: 1, level: 14, value: 1 }, { rank: 2, level: 22, value: 2 }] },
    { id: 'valk_odins_will', name: 'Odin\'s Will', icon: '🪽', iconImg: 'img/abilities/valkyrie/odins_will.jpg', school: 'Sagrado', type: 'utility', requiredLevel: 10, costPct: 0, costRage: 0, castType: 'cast', cooldown: 4, description: 'Despliegas tus alas durante 2 turnos: desbloquea Plunge, Fly the Nest y Javelin of Lightning y multiplica la energía generada por tus habilidades un +50/65/80/95% según el rango. CD 4.', buff: { stat: 'valkyrie_charge_gain', duration: 2, applySelf: true }, buffRanks: [{ rank: 1, level: 10, value: 50 }, { rank: 2, level: 25, value: 65 }, { rank: 3, level: 40, value: 80 }, { rank: 4, level: 55, value: 95 }] },
    { id: 'valk_take_flight', name: 'Fly the Nest', icon: '🕊️', iconImg: 'img/abilities/valkyrie/fly_the_nest.jpg', school: 'Físico', type: 'utility', requiredLevel: 10, costPct: 0, costRage: 0, castType: 'instant', cooldown: 0, description: 'Alzas el vuelo durante 2 turnos y no puedes ser impactado. Solo usable mientras dura Odin\'s Will.', buff: null },
    { id: 'valk_dive_strike', name: 'Plunge', icon: '🦅', iconImg: 'img/abilities/valkyrie/plunge.jpg', school: 'Físico', type: 'damage', requiredLevel: 10, damageType: 'physical', baseDamage: 20, spellPowerRatio: 0, costPct: 0, costRage: 15, castType: 'instant', cooldown: 0, description: 'Requiere estar volando y consume tu vuelo al usarlo. Igual que un ataque básico más un gran daño extra que crece mucho con el rango. El 40% del daño infligido carga la lanza. CD 0.', weaponMultiplier: 1.0, bonusPerRank: [45, 80, 125, 185] },
    { id: 'valk_lightning_bolt', name: 'Javelin of Lightning', icon: '⚡', iconImg: 'img/abilities/valkyrie/lightning_javelin.jpg', school: 'Sagrado', type: 'damage', requiredLevel: 18, damageType: 'magical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costRage: 0, castType: 'instant', cooldown: 0, description: 'Lanza una jabalina de rayos a distancia: causa un gran daño plano más el 70% de la carga seleccionada que gastes (mejorable al 100% con Improved Javelin). Solo usable durante Odin\'s Will.', damageRanges: [{ rank: 1, level: 18, min: 30, max: 40 }, { rank: 2, level: 26, min: 50, max: 65 }, { rank: 3, level: 34, min: 80, max: 100 }] },
    { id: 'valk_cleave', name: 'Multi Attack', icon: '🪓', iconImg: 'img/abilities/valkyrie/multi_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 12, damageType: 'physical', baseDamage: 18, spellPowerRatio: 0, costPct: 0, costRage: 15, castType: 'instant', cooldown: 0, description: 'Realiza 3 golpes básicos en cono con un extra de daño. El 30% del daño infligido carga la lanza.', weaponMultiplier: 1.0, bonusPerRank: [7, 13, 22], multiHit: 3 },
    { id: 'valkyries_call', name: "Valkyrie's Call", icon: '📯', iconImg: 'img/abilities/valkyrie/valkyries_call.jpg', school: 'Sagrado', type: 'utility', requiredLevel: 1, costPct: 0, costRage: 0, castType: 'instant', cooldown: 6, capstoneGate: 'valkyries_call', description: "Restaura 1 punto de acción a todos los aliados y les cura un 15% de tu vida máxima. CD 6.", buff: null },
  ],
};
