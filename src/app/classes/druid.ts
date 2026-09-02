import { CharacterClass } from '../models/game.models';

export const DRUID: CharacterClass = {
  name: 'Druid Balance',
  color: '#FF7D0A',
  icon: '🦉',
  iconImg: 'img/classes/druid.jpg',

  formulas: {
    hp: (s, lvl) => 40 + s.aguante * 9 + lvl * 5,
    mana: (s, lvl) => 45 + s.intelecto * 15 + lvl * 5,
    spellPower: (s) => Math.round(s.intelecto * 0.35 + s.espiritu * 0.05),
    attackPower: (s) => s.fuerza * 2 + s.agilidad - 20,
    manaRegen: (s) => Math.round(s.espiritu * 0.25 + 15),
  },

  baseStats: { fuerza: 15, agilidad: 14, intelecto: 18, aguante: 15, espiritu: 20 },
  startingLevel: 1,
  statGrowth: { fuerza: 0.55, agilidad: 0.55, intelecto: 1.3, aguante: 0.7, espiritu: 1.8 },
  armor: 5,
  magicResist: 5,

  resource: { type: 'mana', label: 'Maná', color: '#3498db', max: null, start: 'full' },

  comboConfig: {
    label: 'Moon Shards',
    icon: '🌙',
    max: 4,
  },

  sunComboConfig: {
    label: 'Sun Shards',
    icon: '☀️',
    max: 4,
  },

  talents: [
    { id: 'improved_mark_of_the_wild', name: 'Improved Mark of the Wild', icon: '🐾', iconImg: 'img/abilities/druid/mark_of_the_wild.jpg', description: 'Aumenta el efecto de Mark of the Wild un 15% por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'improved_wrath', name: 'Improved Wrath', icon: '☀️', iconImg: 'img/abilities/druid/wrath.jpg', description: 'Aumenta el daño de Wrath un 3% por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'lunar_healing', name: 'Lunar Healing', icon: '🌙', iconImg: 'img/talents/druid/lunar_healing.jpg', description: 'Tus hechizos de curación tienen un 10% de probabilidad por punto de otorgarte una Moon Shard.', maxRank: 3, tier: 1, requires: null },
    { id: 'natures_remains', name: "Nature's Remains", icon: '🍂', iconImg: 'img/talents/druid/natures_remains.jpg', description: 'Reduce el coste de maná de Wrath y Starfire un 5% por punto.', maxRank: 2, tier: 1, requires: null },
    { id: 'improved_moonfire', name: 'Improved Moonfire', icon: '🌙', iconImg: 'img/abilities/druid/moonfire.jpg', description: 'Aumenta el daño de Moonfire un 10% por punto y reduce su coste de maná un 5% por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'improved_rejuvenation', name: 'Improved Rejuvenation', icon: '🍃', iconImg: 'img/abilities/druid/rejuvenation.jpg', description: 'Aumenta la curación de Rejuvenation un 7% por punto. Al máximo desbloquea Germination.', maxRank: 3, tier: 2, requires: null },
    { id: 'germination', name: 'Germination', icon: '🌸', iconImg: 'img/talents/druid/germination.jpg', description: 'Rejuvenation también florece en un segundo aliado: lanza un Germination con el 50% de potencia que puede stackearse con el Rejuvenation.', maxRank: 1, tier: 2, requires: { id: 'improved_rejuvenation', points: 3 } },
    { id: 'first_of_the_wild', name: 'First of the Wild', icon: '👊', iconImg: 'img/abilities/druid/basic_attack.jpg', description: 'Tus Basic Attacks restauran un 1% de tu maná total por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'balance_of_nature', name: 'Balance of Nature', icon: '⚖️', iconImg: 'img/talents/druid/balance_of_nature.jpg', description: 'Aumenta tu poder de hechizo en un 6% de tu Espíritu por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'equinox', name: 'Equinox', icon: '🌗', iconImg: 'img/talents/druid/equinox.jpg', description: 'Aumenta el efecto que aportan tus Moon y Sun Shards a Starsurge y Sunfall un 10% por punto.', maxRank: 3, tier: 3, requires: null },
    { id: 'improved_hurricane', name: 'Improved Hurricane', icon: '🌪️', iconImg: 'img/abilities/druid/hurricane.jpg', description: 'Aumenta el daño de Hurricane un 20% por punto.', maxRank: 2, tier: 3, requires: null },
    { id: 'natural_perfection', name: 'Natural Perfection', icon: '🎯', iconImg: 'img/talents/druid/natural_perfection.jpg', description: 'Aumenta tu probabilidad de crítico con hechizos un 2% por punto.', maxRank: 3, tier: 3, requires: null },
    { id: 'stone_of_rhythms', name: 'Stone of Rhythms', icon: '🔮', iconImg: 'img/talents/druid/clearcasting.jpg', description: 'Al final de tu turno tienes un 15% de probabilidad por punto de gastar una Sun Shard para recuperar un 5% de tu maná máximo.', maxRank: 3, tier: 3, requires: null },
    { id: 'improved_sunfire', name: 'Improved Sunfire', icon: '🔥', iconImg: 'img/abilities/druid/sunfire.jpg', description: 'Aumenta el daño de Sunfire un 10% por punto y su duración en 1 turno por punto.', maxRank: 2, tier: 3, requires: null },
  ],

  capstones: [
    { id: 'gift_of_the_wild', name: 'Gift of the Wild', icon: '🎁', iconImg: 'img/capstones/druid/gift_of_the_wild.jpg', description: 'Pasiva. Aumenta todas tus estadísticas en una cantidad igual a tu nivel, además de +1 de armadura física y resistencias mágicas por nivel. A nivel 25, +25 a todas las estadísticas.' },
    { id: 'insect_swarm', name: 'Insect Swarm', icon: '🦗', iconImg: 'img/capstones/druid/insect_swarm.jpg', description: 'Invoca un enjambre de insectos que reduce enormemente el ataque del enemigo un 50% durante 2 turnos. CD 6.' },
    { id: 'nature_guardian', name: 'Nature Guardian', icon: '🌳', iconImg: 'img/capstones/druid/nature_guardian.jpg', description: 'El poder de la naturaleza te envuelve y te otorga 2 Moon Shards y 2 Sun Shards. CD 10.' },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '👊', iconImg: 'img/abilities/druid/basic_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, castType: 'instant', cooldown: 0, description: 'Un golpe básico.', usesWeaponDamage: true },
    { id: 'wrath', name: 'Wrath', icon: '☀️', iconImg: 'img/abilities/druid/wrath.jpg', school: 'Naturaleza', type: 'damage', requiredLevel: 1, damageType: 'magical', baseDamage: 55, spellPowerRatio: 0.9, costPct: 0.10, castType: 'cast', cooldown: 0, generatesSunShard: 1, description: 'Lanza energía solar al objetivo. Cuesta más maná que las habilidades lunares pero pega más. Genera 1 Sun Shard.', damageRanges: [{ rank: 1, level: 1, min: 18, max: 24 }, { rank: 2, level: 8, min: 40, max: 52 }, { rank: 3, level: 14, min: 70, max: 88 }] },
    { id: 'starfire', name: 'Starfire', icon: '✴️', iconImg: 'img/abilities/druid/starfire.jpg', school: 'Arcano', type: 'damage', requiredLevel: 2, damageType: 'magical', baseDamage: 35, spellPowerRatio: 0.55, costPct: 0.04, castType: 'cast', cooldown: 0, generatesCombo: 1, description: 'Invoca la energía estelar al objetivo. Barato y de daño moderado. Genera 1 Moon Shard.', damageRanges: [{ rank: 1, level: 2, min: 11, max: 15 }, { rank: 2, level: 10, min: 26, max: 34 }, { rank: 3, level: 16, min: 47, max: 60 }] },
    { id: 'moonfire', name: 'Moonfire', icon: '🌙', iconImg: 'img/abilities/druid/moonfire.jpg', school: 'Arcano', type: 'damage', requiredLevel: 4, damageType: 'magical', baseDamage: 20, spellPowerRatio: 0.4, costPct: 0.11, castType: 'instant', cooldown: 0, generatesCombo: 1, isDot: true, dotDuration: 4, description: 'Quema al enemigo y le inflige daño durante 4 turnos. Los DoTs cuestan más maná que los casts. Genera 1 Moon Shard.', damageRanges: [{ rank: 1, level: 4, min: 20, max: 25 }, { rank: 2, level: 10, min: 34, max: 44 }, { rank: 3, level: 16, min: 62, max: 76 }], inflictsEffects: [{ type: 'dot', name: 'Moonfire', value: 11, duration: 4, debuffType: 'magic' }], dotScales: true, dotRanges: [{ rank: 1, level: 4, value: 11, duration: 4 }, { rank: 2, level: 10, value: 19, duration: 4 }, { rank: 3, level: 16, value: 27, duration: 4 }] },
    { id: 'sunfire', name: 'Sunfire', icon: '🔥', iconImg: 'img/abilities/druid/sunfire.jpg', school: 'Fuego', type: 'damage', requiredLevel: 12, damageType: 'magical', baseDamage: 20, spellPowerRatio: 0.4, costPct: 0.16, castType: 'instant', cooldown: 0, generatesSunShard: 1, isDot: true, dotDuration: 2, description: 'Quema al enemigo y le inflige el mismo daño que Moonfire pero en menos tiempo. El DoT solar más caro. Genera 1 Sun Shard.', damageRanges: [{ rank: 1, level: 12, min: 50, max: 62 }, { rank: 2, level: 18, min: 85, max: 102 }, { rank: 3, level: 24, min: 125, max: 148 }], inflictsEffects: [{ type: 'dot', name: 'Sunfire', value: 34, duration: 2, debuffType: 'magic' }], dotScales: true, dotRanges: [{ rank: 1, level: 12, value: 34, duration: 2 }, { rank: 2, level: 18, value: 46, duration: 2 }, { rank: 3, level: 24, value: 58, duration: 2 }] },
    { id: 'starsurge', name: 'Starsurge', icon: '🌟', iconImg: 'img/abilities/druid/starsurge.jpg', school: 'Arcano', type: 'damage', requiredLevel: 10, damageType: 'magical', baseDamage: 40, spellPowerRatio: 1.5, costPct: 0.06, castType: 'cast', cooldown: 0, spendsCombo: true, noWeaponScaling: true, description: 'Invoca el poder de las estrellas. Gasta todas las Moon Shards. Cada Moon Shard aumenta el daño.', damageRanges: [{ rank: 1, level: 10, min: 40, max: 52 }, { rank: 2, level: 18, min: 70, max: 90 }, { rank: 3, level: 26, min: 110, max: 140 }] },
    { id: 'sunfall', name: 'Sunfall', icon: '☀️', iconImg: 'img/abilities/druid/sunfall.jpg', school: 'Fuego', type: 'damage', requiredLevel: 10, damageType: 'magical', baseDamage: 40, spellPowerRatio: 1.5, costPct: 0.06, castType: 'cast', cooldown: 0, spendsSunShards: true, noWeaponScaling: true, description: 'Invoca el poder del sol. Gasta todas las Sun Shards. Cada Sun Shard aumenta el daño.', damageRanges: [{ rank: 1, level: 10, min: 48, max: 62 }, { rank: 2, level: 18, min: 82, max: 104 }, { rank: 3, level: 26, min: 130, max: 162 }] },
    { id: 'hurricane', name: 'Hurricane', icon: '🌪️', iconImg: 'img/abilities/druid/hurricane.jpg', school: 'Naturaleza', type: 'damage', requiredLevel: 20, damageType: 'magical', aoe: true, baseDamage: 45, spellPowerRatio: 0.6, costPct: 0.16, castType: 'instant', cooldown: 3, noWeaponScaling: true, description: 'Crea una tormenta en área que daña a todos los enemigos. No gasta Moon ni Sun Shards.', damageRanges: [{ rank: 1, level: 20, min: 60, max: 80 }, { rank: 2, level: 28, min: 110, max: 130 }] },
    { id: 'healing_touch', name: 'Healing Touch', icon: '🌿', iconImg: 'img/abilities/druid/healing_touch.jpg', school: 'Naturaleza', type: 'heal', requiredLevel: 1, baseDamage: 80, spellPowerRatio: 1.2, costPct: 0.12, castType: 'cast', cooldown: 0, description: 'Sana una gran cantidad de salud al objetivo.', damageRanges: [{ rank: 1, level: 1, min: 40, max: 55 }, { rank: 2, level: 8, min: 90, max: 120 }, { rank: 3, level: 14, min: 180, max: 230 }] },
    { id: 'rejuvenation', name: 'Rejuvenation', icon: '🍃', iconImg: 'img/abilities/druid/rejuvenation.jpg', school: 'Naturaleza', type: 'heal', requiredLevel: 6, baseDamage: 30, spellPowerRatio: 0.8, costPct: 0.08, castType: 'instant', cooldown: 0, isHot: true, hotDuration: 4, description: 'Sana al objetivo durante 4 turnos. Aplicar manualmente en Efectos.', damageRanges: [{ rank: 1, level: 6, min: 60, max: 60 }, { rank: 2, level: 12, min: 110, max: 110 }, { rank: 3, level: 18, min: 180, max: 180 }] },
    { id: 'entangling_roots', name: 'Entangling Roots', icon: '🌱', iconImg: 'img/abilities/druid/entangling_roots.jpg', school: 'Naturaleza', type: 'utility', requiredLevel: 8, costPct: 0.06, castType: 'cast', cooldown: 4, description: 'Inmoviliza al objetivo durante 2 turnos. Aplícalo al enemigo.', buff: { stat: 'rooted', duration: 2, applySelf: false }, buffRanks: [{ rank: 1, level: 8, value: 0, costPct: 0.06 }, { rank: 2, level: 16, value: 0, costPct: 0.06 }, { rank: 3, level: 24, value: 0, costPct: 0.06 }] },
    { id: 'moonkin_form', name: 'Moonkin Form', icon: '🪶', iconImg: 'img/abilities/druid/moonkin_form.jpg', school: 'Físico', type: 'utility', requiredLevel: 10, costPct: 0.15, castType: 'instant', cooldown: 1,       description: 'Te transformas en Lechúcico durante 6 turnos. +10 armadura y +6% probabilidad de critico magico.', buff: { stat: 'moonkin', duration: 6, applySelf: true }, buffRanks: [{ rank: 1, level: 10, value: 1, costPct: 0.15 }] },
    { id: 'mark_of_the_wild', name: 'Mark of the Wild', icon: '🐾', iconImg: 'img/abilities/druid/mark_of_the_wild.jpg', school: 'Naturaleza', type: 'utility', requiredLevel: 2, costPct: 0.08, castType: 'instant', cooldown: 0, description: 'Aumenta todos los atributos. El buffo más mítico del druida. Aplicar manualmente en Efectos.', buff: { stat: 'all_stats', duration: 30, applySelf: false }, buffRanks: [{ rank: 1, level: 2, value: 2, costPct: 0.08 }, { rank: 2, level: 12, value: 4, costPct: 0.09 }, { rank: 3, level: 24, value: 7, costPct: 0.10 }, { rank: 4, level: 36, value: 10, costPct: 0.11 }] },
    { id: 'dispel', name: 'Dispel', icon: '✨', iconImg: 'img/abilities/mage/remove_curse.jpg', school: 'Naturaleza', type: 'utility', requiredLevel: 8, costPct: 0.05, castType: 'instant', cooldown: 0, description: 'Elimina una maldición (curse) del objetivo.', bonusPerRank: [0, 0, 0] },
    { id: 'power_of_the_eclipse', name: 'Power of the Eclipse', icon: '🌘', iconImg: 'img/abilities/druid/power_of_the_eclipse.jpg', school: 'Pasiva', type: 'utility', requiredLevel: 10, costPct: 0, castType: 'instant', cooldown: 0, passive: true, description: 'Pasiva aprendida al nivel 10: por cada Sun Shard tus hechizos hacen un +2.5% de crítico. Por cada Moon Shard tus hechizos cuestan un 2.5% menos de maná.' },
    { id: 'insect_swarm', name: 'Insect Swarm', icon: '🦗', iconImg: 'img/capstones/druid/insect_swarm.jpg', school: 'Naturaleza', type: 'utility', requiredLevel: 1, costPct: 0.05, castType: 'instant', cooldown: 6, description: 'Enjambre de insectos: baja un 50% el ataque del enemigo durante 2 turnos. CD 6.', buff: null, capstoneGate: 'insect_swarm', inflictsEffects: [{ type: 'debuff', name: 'Insect Swarm', target: 'attackPower', value: 50, duration: 2, debuffType: 'magic' }] },
    { id: 'nature_guardian', name: 'Nature Guardian', icon: '🌳', iconImg: 'img/capstones/druid/nature_guardian.jpg', school: 'Naturaleza', type: 'utility', requiredLevel: 1, costPct: 0, castType: 'instant', cooldown: 10, noGcd: true, description: 'Te otorga 2 Moon Shards y 2 Sun Shards. CD 10.', buff: null, capstoneGate: 'nature_guardian' },
  ],
};
