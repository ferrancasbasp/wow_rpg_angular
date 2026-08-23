import { CharacterClass } from '../models/game.models';

/*
 * MAGE DESIGN — Dos vias de juego:
 *
 * 1. CASTERS (sostenible): Fireball, Frostbolt — cast (2 acciones), mas danyo por mana,
 *    sostenible 7-9 turnos. Talentos: Casting Master (+5%/punto danyo cast), Mana Efficiency (-3%/punto coste).
 *
 * 2. INSTANTS (burst): Arcane Missiles, Fire Blast, Arcane Explosion, Cone of Cold — instant (1 accion),
 *    mas DPS pero coste de mana brutal (~21-27% por turno combo), sostenible 4-5 turnos.
 *    Talentos: Magic Resistance (+1%/punto crit instant), Improved Fire Blast (CD-1/punto).
 *
 * Crossover: Elemental Mastery (+2%/punto danyo global) mejora ambas vias.
 *            Improved Frostbolt (+10%/punto Frostbolt) especializa Frostbolt.
 *
 * Combos:
 * - Opcion A: Fireball (cast) = ~111-316 danyo/turno, 12-14% mana
 * - Opcion B: AM + Fire Blast (instant) = ~158-405 danyo/turno, 21-27% mana
 * - Fire Blast CD3: el combo instant solo cada 3 turnos, el resto toca cast o AM solo
 *
 * Movimiento cuesta 1 accion — los instants permiten moverse Y atacar en el mismo turno.
 */
export const MAGE: CharacterClass = {
  name: 'Mage',
  color: '#3FC7EB',
  icon: '🔥',
  iconImg: 'img/classes/mage.jpg',

  formulas: {
    hp: (s, lvl) => 30 + s.aguante * 8 + lvl * 4,
    mana: (s, lvl) => 50 + s.intelecto * 20 + lvl * 5,
    spellPower: (s) => Math.round(s.intelecto * 0.4),
    attackPower: (s) => 0,
    manaRegen: (s) => Math.round(s.espiritu * 0.25 + 15),
  },

  baseStats: { fuerza: 3, agilidad: 3, intelecto: 20, aguante: 14, espiritu: 18 },
  startingLevel: 1,
  statGrowth: { fuerza: 0.1, agilidad: 0.1, intelecto: 2.0, aguante: 0.7, espiritu: 1.1 },
  armor: 0,
  magicResist: 5,

  resource: { type: 'mana', label: 'Maná', color: '#3498db', max: null, start: 'full' },

  talents: [
    { id: 'elemental_mastery', name: 'Elemental Mastery', icon: '🔥', iconImg: 'img/talents/mage/elemental_mastery.jpg', description: 'Aumenta el daño de todos tus hechizos un 2% por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'mana_efficiency', name: 'Arcane Efficiency', icon: '✨', iconImg: 'img/talents/mage/arcane_efficiency.jpg', description: 'Reduce el coste de maná de todos tus hechizos un 3% por punto.', maxRank: 3, tier: 1, requires: null },
    { id: 'improved_frostbolt', name: 'Improved Frostbolt', icon: '❄️', iconImg: '', description: 'Aumenta el daño de Frostbolt un 10% por punto.', maxRank: 2, tier: 1, requires: null },
    { id: 'improved_arcane_intellect', name: 'Improved Arcane Intellect', icon: '🧠', iconImg: 'img/talents/mage/improved_arcane_intellect.jpg', description: 'Aumenta el efecto de Arcane Intellect un 15% por punto.', maxRank: 2, tier: 2, requires: null },
    { id: 'improved_frost_armor', name: 'Improved Frost Armor', icon: '🧊', iconImg: 'img/talents/mage/improved_frost_armor.jpg', description: 'Aumenta el efecto de Frost Armor un 10% por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'casting_master', name: 'Casting Master', icon: '📜', iconImg: '', description: 'Aumenta el daño de todos tus hechizos con tiempo de lanzamiento un 5% por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'magic_resistance', name: 'Magic Resistance', icon: '🛡️', iconImg: 'img/talents/mage/magic_resistance.jpg', description: 'Aumenta tu armadura mágica +1 por punto y tu probabilidad de crítico con hechizos instantáneos un 1% por punto.', maxRank: 3, tier: 2, requires: null },
    { id: 'improved_fire_blast', name: 'Improved Fire Blast', icon: '💥', iconImg: 'img/talents/mage/improved_fire_blast.jpg', description: 'Reduce el cooldown de Fire Blast 1 turno por punto.', maxRank: 2, tier: 3, requires: null },
    { id: 'frost_power', name: 'Frost Power', icon: '❄️', iconImg: 'img/talents/mage/frost_power.jpg', description: 'Aumenta el daño de tus hechizos de Escarcha un 2% por punto.', maxRank: 3, tier: 3, requires: null },
    { id: 'spell_crit_talent', name: 'Spell Critical', icon: '🎯', iconImg: 'img/talents/mage/spell_critical.jpg', description: 'Aumenta tu probabilidad de crítico con hechizos un 1% por punto.', maxRank: 3, tier: 3, requires: null },
    { id: 'clearcasting', name: 'Clearcasting', icon: '🔮', iconImg: 'img/talents/mage/clearcasting.jpg', description: 'Tus hechizos tienen un 2% de probabilidad por punto de ser gratuitos al lanzarlos.', maxRank: 5, tier: 3, requires: null },
  ],

  capstones: [
    { id: 'combustion', name: 'Combustion', icon: '🔥', iconImg: 'img/capstones/mage/combustion.jpg', description: 'Durante 2 turnos, aumenta la probabilidad de golpe crítico y el daño crítico de tus spells de Fuego en 25%.' },
    { id: 'icy_veins', name: 'Icy Veins', icon: '🧊', iconImg: 'img/capstones/mage/icy_veins.jpg', description: 'Durante 2 turnos, tus hechizos de Escarcha se lanzan de forma instantánea y solo consumen un punto de acción.' },
    { id: 'arcane_power', name: 'Arcane Power', icon: '⚡', iconImg: 'img/capstones/mage/arcane_power.jpg', description: 'Durante 2 turnos, tus spells no consumen mana, tu Spell Power aumenta un 20% y tu danyo critico aumenta un 25%. Al final de cada turno recuperas un 20% de tu mana maximo. CD 5.' },
  ],

  abilities: [
    { id: 'fireball', name: 'Fireball', icon: '🔥', iconImg: 'img/abilities/mage/fireball.jpg', school: 'Fuego', type: 'damage', requiredLevel: 1, baseDamage: 60, spellPowerRatio: 1.0, costPct: 0.09, castType: 'cast', cooldown: 0, description: 'Lanza una bola de fuego que explota al impactar.', damageRanges: [{ rank: 1, level: 1, min: 14, max: 22 }, { rank: 2, level: 6, min: 31, max: 45 }, { rank: 3, level: 12, min: 53, max: 73 }, { rank: 4, level: 18, min: 104, max: 166 }, { rank: 5, level: 24, min: 165, max: 265 }] },
    { id: 'fire_blast', name: 'Fire Blast', icon: '💥', iconImg: 'img/abilities/mage/fire_blast.jpg', school: 'Fuego', type: 'damage', requiredLevel: 4, baseDamage: 35, spellPowerRatio: 0.429, costPct: 0.05, castType: 'instant', cooldown: 3, description: 'Una explosión instantánea de llamas al objetivo.', damageRanges: [{ rank: 1, level: 4, min: 16, max: 26 }, { rank: 2, level: 10, min: 30, max: 50 }, { rank: 3, level: 16, min: 56, max: 90 }, { rank: 4, level: 22, min: 99, max: 159 }] },
    { id: 'frostbolt', name: 'Frostbolt', icon: '❄️', iconImg: 'img/abilities/mage/frostbolt.jpg', school: 'Escarcha', type: 'damage', requiredLevel: 6, baseDamage: 45, spellPowerRatio: 0.814, costPct: 0.08, castType: 'cast', cooldown: 0, description: 'Lanza un proyectil de hielo que ralentiza al objetivo.', damageRanges: [{ rank: 1, level: 6, min: 22, max: 26 }, { rank: 2, level: 12, min: 37, max: 43 }, { rank: 3, level: 18, min: 63, max: 73 }, { rank: 4, level: 24, min: 104, max: 120 }] },
    { id: 'arcane_missiles', name: 'Arcane Missiles', icon: '✨', iconImg: 'img/abilities/mage/arcane_missiles.jpg', school: 'Arcano', type: 'damage', requiredLevel: 14, baseDamage: 100, spellPowerRatio: 1.142, costPct: 0.15, castType: 'instant', cooldown: 0, description: 'Dispara misiles de energía arcana al objetivo cada segundo.', damageRanges: [{ rank: 1, level: 14, min: 64, max: 64 }, { rank: 2, level: 20, min: 112, max: 112 }, { rank: 3, level: 26, min: 184, max: 184 }] },
    { id: 'cone_of_cold', name: 'Cone of Cold', icon: '🌬️', iconImg: 'img/abilities/mage/cone_of_cold.jpg', school: 'Escarcha', type: 'damage', requiredLevel: 20, aoe: true, baseDamage: 50, spellPowerRatio: 0.571, costPct: 0.08, castType: 'instant', cooldown: 6, description: 'Cono de hielo instantaneo que danya y ralentiza a todos los enemigos frontales.', damageRanges: [{ rank: 1, level: 20, min: 90, max: 115 }, { rank: 2, level: 28, min: 145, max: 180 }, { rank: 3, level: 36, min: 220, max: 270 }] },
    { id: 'arcane_explosion', name: 'Arcane Explosion', icon: '🔮', iconImg: 'img/abilities/mage/arcane_explosion.jpg', school: 'Arcano', type: 'damage', requiredLevel: 18, aoe: true, baseDamage: 30, spellPowerRatio: 0.286, costPct: 0.16, castType: 'instant', cooldown: 0, description: 'Estalla energía arcana alrededor del mago dañando a todos los enemigos cercanos.', damageRanges: [{ rank: 1, level: 18, min: 70, max: 85 }, { rank: 2, level: 24, min: 115, max: 140 }] },
    { id: 'blast_wave', name: 'Blast Wave', icon: '🌋', iconImg: 'img/abilities/mage/blast_wave.jpg', school: 'Fuego', type: 'damage', requiredLevel: 24, aoe: true, baseDamage: 60, spellPowerRatio: 0.571, costPct: 0.10, castType: 'instant', cooldown: 8, description: 'Onda expansiva de fuego instantanea que danya y empuja a todos los enemigos cercanos.', damageRanges: [{ rank: 1, level: 24, min: 160, max: 200 }, { rank: 2, level: 32, min: 250, max: 310 }] },
    { id: 'combustion', name: 'Combustion', icon: '🔥', iconImg: 'img/capstones/mage/combustion.jpg', school: 'Fuego', type: 'utility', requiredLevel: 1, costPct: 0, castType: 'instant', cooldown: 0, description: 'Durante 2 turnos, aumenta la probabilidad de golpe critico y el danyo critico de tus spells de Fuego en 25%.', buff: null, capstoneGate: 'combustion' },
    { id: 'icy_veins', name: 'Icy Veins', icon: '🧊', iconImg: 'img/capstones/mage/icy_veins.jpg', school: 'Escarcha', type: 'utility', requiredLevel: 1, costPct: 0, castType: 'instant', cooldown: 5, description: 'Durante 2 turnos, tus hechizos de Escarcha se lanzan de forma instantanea y solo consumen un punto de accion.', buff: null, capstoneGate: 'icy_veins' },
    { id: 'arcane_power', name: 'Arcane Power', icon: '⚡', iconImg: 'img/capstones/mage/arcane_power.jpg', school: 'Arcano', type: 'utility', requiredLevel: 1, costPct: 0, castType: 'instant', cooldown: 5, description: 'Durante 2 turnos, tus spells no consumen mana, tu Spell Power aumenta un 20% y tu danyo critico un 25%. Al final de cada turno recuperas un 20% de tu mana maximo. CD 5.', buff: null, capstoneGate: 'arcane_power' },
    { id: 'arcane_intellect', name: 'Arcane Intellect', icon: '🧠', iconImg: 'img/abilities/mage/arcane_intellect.jpg', school: 'Arcano', type: 'utility', requiredLevel: 1, costPct: 0.06, castType: 'instant', cooldown: 0, description: 'Aumenta el Intelecto del objetivo. Aplica manualmente el buff en la hoja.', buff: { stat: 'intelecto', duration: 30 }, buffRanks: [{ rank: 1, level: 1, value: 2, costPct: 0.06 }, { rank: 2, level: 14, value: 7, costPct: 0.07 }, { rank: 3, level: 28, value: 10, costPct: 0.08 }, { rank: 4, level: 42, value: 15, costPct: 0.09 }, { rank: 5, level: 56, value: 20, costPct: 0.10 }] },
    { id: 'frost_armor', name: 'Frost Armor', icon: '🧊', iconImg: 'img/abilities/mage/frost_armor.jpg', school: 'Escarcha', type: 'utility', requiredLevel: 4, costPct: 0.30, castType: 'instant', cooldown: 0, description: 'Crea una barrera de hielo que aumenta tu armadura física.', buff: { stat: 'armor', duration: 30, applySelf: true }, buffRanks: [{ rank: 1, level: 4, value: 5, costPct: 0.30 }, { rank: 2, level: 14, value: 7, costPct: 0.30 }, { rank: 3, level: 24, value: 9, costPct: 0.30 }, { rank: 4, level: 34, value: 11, costPct: 0.30 }, { rank: 5, level: 44, value: 13, costPct: 0.30 }, { rank: 6, level: 54, value: 15, costPct: 0.30 }] },
    { id: 'blink', name: 'Blink', icon: '💨', iconImg: 'img/abilities/mage/blink.jpg', school: 'Arcano', type: 'utility', requiredLevel: 15, costPct: 0.10, castType: 'instant', cooldown: 4, noGcd: true, description: 'Te teletransportas instantáneamente, escapando de efectos de control.', buff: null },
    { id: 'remove_curse', name: 'Remove Curse', icon: '✨', iconImg: 'img/abilities/mage/remove_curse.jpg', school: 'Arcano', type: 'utility', requiredLevel: 12, costPct: 0.05, castType: 'instant', cooldown: 0, description: 'Elimina una maldicion del objetivo.', bonusPerRank: [0, 0, 0] },
  ],
};
