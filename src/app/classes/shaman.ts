import { CharacterClass } from '../models/game.models';

export const SHAMAN: CharacterClass = {
  name: 'Shaman',
  color: '#0070DE',
  icon: '⚡',
  iconImg: 'img/classes/shaman.jpg',

  formulas: {
    hp: (s, lvl) => 40 + s.aguante * 10 + lvl * 5,
    mana: (s, lvl) => 30 + s.intelecto * 15 + lvl * 5,
    spellPower: (s) => Math.round(s.intelecto * 0.3),
    attackPower: (s) => s.fuerza * 2,
    manaRegen: (s) => Math.round(s.espiritu * 0.25 + 15),
  },

  baseStats: { fuerza: 15, agilidad: 10, intelecto: 25, aguante: 20, espiritu: 18 },
  startingLevel: 1,
  statGrowth: { fuerza: 0.8, agilidad: 0.4, intelecto: 1.4, aguante: 0.9, espiritu: 0.5 },
  armor: 3,
  magicResist: 3,

  resource: { type: 'mana', label: 'Maná', color: '#3498db', max: null, start: 'full' },

  comboConfig: { label: 'Maelstorm Charges', icon: '⚡', max: 4 },

  talents: [
    { id: 'thundering_strikes', name: 'Trueno Atronador', icon: '⚡', iconImg: '', description: 'Aumenta la probabilidad de golpe crítico de tus Descarga de Rayo y Cadena de Rayos en 5% por punto.', maxRank: 2, tier: 1, requires: null },
    { id: 'elemental_focus', name: 'Enfoque Elemental', icon: '🔮', iconImg: '', description: 'Requiere Trueno Atronador 2/2. Los golpes críticos de Descarga de Rayo y Cadena de Rayos generan 1 carga de Maelstorm.', maxRank: 1, tier: 1, requires: { id: 'thundering_strikes', points: 2 } },
    { id: 'improved_weapon_imbues', name: 'Imbuements Mejorados', icon: '⚔️', iconImg: '', description: 'Mejora tus Imbuements de Arma. Viento Furioso: +5% de probabilidad de ataque adicional por punto. Lengua de Fuego: +10% de daño de fuego en tus Ataques Básicos por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'ancestral_knowledge', name: 'Conocimiento Ancestral', icon: '📜', iconImg: '', description: 'Aumenta el crecimiento por nivel de Intelecto y reduce el de Fuerza en 10% por punto.', maxRank: 2, tier: 1, requires: null },
    { id: 'healing_grace', name: 'Gracia Sanadora', icon: '💚', iconImg: '', description: 'Aumenta la curación realizada por Ola de Sanación y Cadena de Sanación en 10% por punto. Además, estas habilidades tienen un 15% por punto de probabilidad de generar 1 carga de Maelstorm.', maxRank: 3, tier: 1, requires: null },
    { id: 'elemental_assault', name: 'Asalto Elemental', icon: '👊', iconImg: '', description: 'Aumenta en +10% por punto la probabilidad de que tus Ataques Básicos generen 1 carga de Maelstorm.', maxRank: 3, tier: 2, requires: null },
    { id: 'improved_totems', name: 'Tótems Mejorados', icon: '🪵', iconImg: '', description: 'Aumenta la efectividad de tus Tótems de Fuego y Agua en 10% por punto, aumentando su daño, curación o maná restaurado según corresponda.', maxRank: 3, tier: 2, requires: null },
    { id: 'static_shock', name: 'Choque Estático', icon: '⚡', iconImg: '', description: 'Choque de Tierra tiene un 25% por punto de probabilidad de generar 1 carga de Maelstorm adicional.', maxRank: 3, tier: 2, requires: null },
    { id: 'tidal_focus', name: 'Enfoque de Marea', icon: '🌊', iconImg: '', description: 'Reduce el coste de Maná de Ola de Sanación y Cadena de Sanación en 15% por punto.', maxRank: 2, tier: 2, requires: null },
    { id: 'erupting_lava', name: 'Lava Eruptiva', icon: '🌋', iconImg: '', description: 'Aumenta el daño inicial y periódico de Choque de Llamas en 15% por punto y aumenta su duración en 1 turno por punto.', maxRank: 2, tier: 2, requires: null },
  ],

  capstones: [
    { id: 'capstone_1', name: 'Capstone I', icon: '👑', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
    { id: 'capstone_2', name: 'Capstone II', icon: '🔮', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
    { id: 'capstone_3', name: 'Capstone III', icon: '⚡', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '👊', iconImg: 'img/abilities/shaman/basic_attack.png', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, castType: 'instant', cooldown: 0, generatesCombo: 1, generatesComboChance: 20, description: 'Realiza un ataque cuerpo a cuerpo que no gasta maná. Tiene un 20% de probabilidad de generar una carga de Maelstorm.', usesWeaponDamage: true },
    { id: 'lightning_bolt', name: 'Lightning Bolt', icon: '⚡', iconImg: 'img/abilities/shaman/lightning_bolt.jpg', school: 'Naturaleza', type: 'damage', requiredLevel: 1, baseDamage: 50, spellPowerRatio: 0.714, costPct: 0.06, castType: 'cast', cooldown: 0, description: 'Lanza un rayo de energía natural al objetivo. Coste de maná bajo.', damageRanges: [{ rank: 1, level: 1, min: 12, max: 18 }, { rank: 2, level: 6, min: 24, max: 34 }, { rank: 3, level: 12, min: 48, max: 62 }, { rank: 4, level: 18, min: 84, max: 104 }, { rank: 5, level: 24, min: 140, max: 172 }] },
    { id: 'flame_shock', name: 'Choque de Llamas', icon: '🔥', iconImg: 'img/abilities/shaman/flameshock.jpg', school: 'Fuego', type: 'damage', requiredLevel: 4, damageType: 'magical', baseDamage: 20, spellPowerRatio: 0.429, costPct: 0.10, castType: 'instant', cooldown: 2, description: 'Quema al objetivo: daño de fuego directo y un DoT de fuego durante 3 turnos. Coste de maná medio.', isDot: true, dotDuration: 3, damageRanges: [{ rank: 1, level: 4, min: 12, max: 18 }, { rank: 2, level: 10, min: 24, max: 34 }, { rank: 3, level: 16, min: 44, max: 60 }, { rank: 4, level: 22, min: 74, max: 96 }], dotRanges: [{ rank: 1, level: 4, value: 8, duration: 3 }, { rank: 2, level: 10, value: 14, duration: 3 }, { rank: 3, level: 16, value: 22, duration: 3 }, { rank: 4, level: 22, value: 32, duration: 3 }] },
    { id: 'earth_shock', name: 'Choque de Tierra', icon: '🌍', iconImg: 'img/abilities/shaman/earthshock.jpg', school: 'Naturaleza', type: 'damage', requiredLevel: 4, baseDamage: 40, spellPowerRatio: 0.429, costPct: 0.10, castType: 'instant', cooldown: 3, generatesCombo: 1, description: 'Libera una onda de tierra que daña al objetivo y genera 1 carga de Maelstorm. Coste de maná medio.', damageRanges: [{ rank: 1, level: 4, min: 10, max: 16 }, { rank: 2, level: 10, min: 22, max: 32 }, { rank: 3, level: 16, min: 44, max: 60 }, { rank: 4, level: 22, min: 80, max: 104 }] },
    { id: 'flametongue_weapon', name: 'Arma Lengua de Fuego', icon: '🔥', iconImg: 'img/abilities/shaman/flametongue.jpg', school: 'Fuego', type: 'utility', requiredLevel: 6, castType: 'instant', cooldown: 0, costPct: 0.02, noGcd: true, weaponImbue: true, buff: { stat: 'weapon_imbue', duration: 999, applySelf: true }, buffRanks: [{ rank: 1, level: 6, value: 6 }, { rank: 2, level: 12, value: 12 }, { rank: 3, level: 18, value: 20 }, { rank: 4, level: 24, value: 30 }], description: 'Imbuye tu arma con fuego (no gasta acción, maná muy bajo). Tus Ataques Básicos causan daño de fuego adicional. Solo puede haber un imbuíto de arma activo.', category: 'elemental' },
    { id: 'healing_wave', name: 'Ola de Sanación', icon: '🌊', iconImg: 'img/abilities/shaman/healing_wave.jpg', school: 'Naturaleza', type: 'heal', requiredLevel: 8, baseDamage: 60, spellPowerRatio: 0.857, costPct: 0.10, castType: 'cast', cooldown: 0, description: 'Canaliza energía curativa para restaurar vida al aliado. Coste de maná medio.', damageRanges: [{ rank: 1, level: 8, min: 32, max: 48 }, { rank: 2, level: 14, min: 56, max: 80 }, { rank: 3, level: 20, min: 92, max: 124 }] },
    { id: 'chain_lightning', name: 'Cadena de Rayos', icon: '🌩️', iconImg: 'img/abilities/shaman/chain_lightning.jpg', school: 'Naturaleza', type: 'damage', requiredLevel: 8, damageType: 'magical', baseDamage: 80, spellPowerRatio: 0.9, costPct: 0.18, castType: 'cast', cooldown: 2, chain: true, bounces: 2, chainDecay: 0.7, description: 'Un rayo golpea al objetivo y salta a otros 2 enemigos, perdiendo un 30% de daño por salto. Envía 3 ataques separados para que el Master los asigne manualmente. Coste de maná muy alto.', damageRanges: [{ rank: 1, level: 8, min: 30, max: 40 }, { rank: 2, level: 14, min: 55, max: 70 }, { rank: 3, level: 20, min: 90, max: 115 }, { rank: 4, level: 26, min: 145, max: 180 }] },
    { id: 'windfury_weapon', name: 'Arma Viento Furioso', icon: '💨', iconImg: 'img/abilities/shaman/windfury.jpg', school: 'Naturaleza', type: 'utility', requiredLevel: 10, castType: 'instant', cooldown: 0, costPct: 0.02, noGcd: true, weaponImbue: true, buff: { stat: 'weapon_imbue', duration: 999, applySelf: true }, buffRanks: [{ rank: 1, level: 10, value: 20 }, { rank: 2, level: 22, value: 28 }], description: 'Imbuye tu arma con el viento (no gasta acción, maná muy bajo). Tus Ataques Básicos tienen un 20% de probabilidad (28% en rango alto) de realizar un ataque adicional que también puede generar Maelstorm. Solo puede haber un imbuíto de arma activo.', category: 'enhancement' },
    { id: 'chain_heal', name: 'Cadena de Sanación', icon: '🌊', iconImg: 'img/abilities/shaman/chain_heal.jpg', school: 'Naturaleza', type: 'heal', requiredLevel: 10, baseDamage: 70, spellPowerRatio: 0.9, costPct: 0.18, castType: 'cast', cooldown: 2, chain: true, bounces: 2, chainDecay: 0.6, description: 'Cura al aliado objetivo y salta a los siguientes aliados del grupo (hasta 2), perdiendo un 40% de efectividad por salto. Coste de maná muy alto.', damageRanges: [{ rank: 1, level: 10, min: 40, max: 55 }, { rank: 2, level: 16, min: 75, max: 95 }, { rank: 3, level: 22, min: 120, max: 150 }] },
    { id: 'searing_totem', name: 'Tótem Abrasador', icon: '🔥', iconImg: 'img/abilities/shaman/searing_totem.jpg', school: 'Fuego', type: 'utility', requiredLevel: 12, castType: 'instant', cooldown: 0, costPct: 0.10, totem: 'fire', totemType: 'searing', totemTurns: 5, damageType: 'magical', baseDamage: 25, spellPowerRatio: 0.3, damageRanges: [{ rank: 1, level: 12, min: 18, max: 26 }, { rank: 2, level: 18, min: 30, max: 42 }, { rank: 3, level: 24, min: 48, max: 64 }], description: 'Invoca un tótem de fuego que ataca automáticamente cada turno con daño de fuego. Dura 5 turnos (desaparece antes si su objetivo muere). Solo puedes tener un Tótem de Fuego activo.', category: 'elemental' },
    { id: 'healing_stream_totem', name: 'Tótem de Corriente Sanadora', icon: '💧', iconImg: 'img/abilities/shaman/healing_spring_totem.jpg', school: 'Naturaleza', type: 'utility', requiredLevel: 12, castType: 'instant', cooldown: 0, costPct: 0.05, totem: 'water', totemType: 'healing_stream', totemTurns: 4, damageRanges: [{ rank: 1, level: 12, min: 12, max: 12 }, { rank: 2, level: 18, min: 22, max: 22 }, { rank: 3, level: 24, min: 34, max: 34 }], description: 'Invoca un tótem de agua que cura a todo el grupo cada turno durante 4 turnos. Solo puedes tener un Tótem de Agua activo.', category: 'restoration' },
    { id: 'fire_nova_totem', name: 'Tótem Nova de Fuego', icon: '💥', iconImg: 'img/abilities/shaman/fire_nova_totem.jpg', school: 'Fuego', type: 'utility', requiredLevel: 16, castType: 'instant', cooldown: 3, costPct: 0.14, totem: 'fire', totemType: 'fire_nova', totemTurns: 2, damageType: 'magical', baseDamage: 60, spellPowerRatio: 0.6, damageRanges: [{ rank: 1, level: 16, min: 55, max: 75 }, { rank: 2, level: 22, min: 95, max: 125 }], description: 'Invoca un tótem de fuego que explota durante tu siguiente turno causando daño de fuego en área y desaparece. Solo puedes tener un Tótem de Fuego activo.', category: 'elemental' },
    { id: 'mana_spring_totem', name: 'Tótem Manantial de Maná', icon: '💠', iconImg: 'img/abilities/shaman/mana_spring_totem.jpg', school: 'Naturaleza', type: 'utility', requiredLevel: 18, castType: 'instant', cooldown: 0, costPct: 0.04, totem: 'water', totemType: 'mana_spring', totemTurns: 4, damageRanges: [{ rank: 1, level: 18, min: 12, max: 12 }, { rank: 2, level: 24, min: 20, max: 20 }], description: 'Invoca un tótem de agua que restaura maná al Shaman cada turno durante 4 turnos. Solo puedes tener un Tótem de Agua activo.', category: 'restoration' },
  ],
};
