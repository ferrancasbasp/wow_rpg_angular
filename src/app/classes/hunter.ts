import { CharacterClass } from '../models/game.models';

export const HUNTER: CharacterClass = {
  name: 'Hunter',
  color: '#AAD372',
  icon: '🏹',
  iconImg: 'img/classes/hunter.jpg',

  formulas: {
    hp: (s, lvl) => 35 + s.aguante * 9 + lvl * 5,
    mana: () => 0,
    spellPower: () => 0,
    attackPower: (s) => s.agilidad * 2,
    manaRegen: () => 0,
  },

  baseStats: { fuerza: 10, agilidad: 25, intelecto: 6, aguante: 19, espiritu: 12 },
  startingLevel: 1,
  statGrowth: { fuerza: 0.4, agilidad: 2.2, intelecto: 0.1, aguante: 1.3, espiritu: 0.3 },
  armor: 5,
  magicResist: 2,

  resource: { type: 'focus', label: 'Focus', color: '#aad372', max: 100, start: 'full', regen: 0 },

  talents: [],

  capstones: [
    { id: 'capstone_1', name: 'Capstone I', icon: '⬜', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
    { id: 'capstone_2', name: 'Capstone II', icon: '⬜', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
    { id: 'capstone_3', name: 'Capstone III', icon: '⬜', iconImg: '', description: 'Capstone de ejemplo. (Por definir)' },
  ],

  abilities: [
    { id: 'basic_attack', name: 'Basic Attack', icon: '🎯', iconImg: 'img/abilities/hunter/basic_attack.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costFocus: 0, castType: 'instant', cooldown: 0, description: 'Un ataque básico con tu arma que no gasta focus.', usesWeaponDamage: true },
    { id: 'auto_shot', name: 'Auto Shot', icon: '🏹', iconImg: 'img/abilities/hunter/auto_shot.jpg', school: 'Físico', type: 'damage', requiredLevel: 1, damageType: 'physical', baseDamage: 1, spellPowerRatio: 0, costPct: 0, costFocus: 0, focusGain: 5, castType: 'instant', cooldown: 0, description: 'Realiza un disparo basico que inflige dano fisico (suma el arma) y genera 5 Focus.', damageRanges: [{ rank: 1, level: 1, min: 20, max: 30 }, { rank: 2, level: 8, min: 40, max: 55 }, { rank: 3, level: 16, min: 72, max: 92 }, { rank: 4, level: 24, min: 115, max: 142 }] },
    { id: 'arcanic_shot', name: 'Arcane Shot', icon: '✨', iconImg: 'img/abilities/hunter/arcanic_shot.jpg', school: 'Arcano', type: 'damage', requiredLevel: 4, damageType: 'magical', baseDamage: 1, spellPowerRatio: 0, costPct: 0, costFocus: 0, focusGain: 10, castType: 'instant', cooldown: 2, description: 'Dispara un proyectil arcano que inflige dano Arcano plano y genera 10 Focus. CD 2.', damageRanges: [{ rank: 1, level: 4, min: 45, max: 60 }, { rank: 2, level: 12, min: 85, max: 110 }, { rank: 3, level: 20, min: 140, max: 175 }, { rank: 4, level: 28, min: 210, max: 260 }] },
    { id: 'aimed_shot', name: 'Aimed Shot', icon: '🎯', iconImg: 'img/abilities/hunter/aimed_shot.jpg', school: 'Físico', type: 'damage', requiredLevel: 6, damageType: 'physical', baseDamage: 1, spellPowerRatio: 0, costPct: 0, costFocus: 50, castType: 'cast', cooldown: 0, description: 'Dispara con cuidado apuntado: dano fisico elevado (suma el arma). Cuesta 50 Focus.', damageRanges: [{ rank: 1, level: 6, min: 100, max: 130 }, { rank: 2, level: 14, min: 180, max: 230 }, { rank: 3, level: 22, min: 300, max: 370 }, { rank: 4, level: 30, min: 460, max: 560 }] },
    { id: 'multi_shot', name: 'Multi-Shot', icon: '🌪️', iconImg: 'img/abilities/hunter/multi_shot.jpg', school: 'Físico', type: 'damage', requiredLevel: 10, damageType: 'physical', baseDamage: 1, spellPowerRatio: 0, costPct: 0, costFocus: 30, castType: 'instant', cooldown: 3, aoe: true, description: 'Dispara proyectiles a todos los enemigos infligiendo dano fisico (suma el arma). Cuesta 30 Focus. CD 3.', damageRanges: [{ rank: 1, level: 10, min: 30, max: 42 }, { rank: 2, level: 18, min: 55, max: 72 }, { rank: 3, level: 26, min: 90, max: 115 }] },
    { id: 'serpent_sting', name: 'Serpent Sting', icon: '🐍', iconImg: 'img/abilities/hunter/serpent_sting.jpg', school: 'Naturaleza', type: 'damage', requiredLevel: 8, damageType: 'magical', baseDamage: 1, spellPowerRatio: 0, costPct: 0, costFocus: 10, castType: 'instant', cooldown: 3, isDot: true, dotDuration: 4, dotScales: true, description: 'Envenena al objetivo: dano de Naturaleza durante 4 turnos. Cuesta 10 Focus. CD 3.', dotRanges: [{ rank: 1, level: 8, value: 64, duration: 4 }, { rank: 2, level: 16, value: 112, duration: 4 }, { rank: 3, level: 24, value: 180, duration: 4 }, { rank: 4, level: 32, value: 280, duration: 4 }], damageRanges: [{ rank: 1, level: 8, min: 64, max: 64 }, { rank: 2, level: 16, min: 112, max: 112 }, { rank: 3, level: 24, min: 180, max: 180 }, { rank: 4, level: 32, min: 280, max: 280 }] },
    { id: 'kill_command', name: 'Kill Command', icon: '🐾', iconImg: 'img/abilities/hunter/kill_command.jpg', school: 'Físico', type: 'utility', requiredLevel: 12, costPct: 0, costFocus: 0, focusGain: 15, castType: 'instant', cooldown: 3, description: 'Ordena a tu pet atacar al objetivo con un golpe extra. Genera 15 Focus y el ataque extra del pet da 10 Focus mas. CD 3.', buff: null },
    { id: 'disengage', name: 'Disengage', icon: '💨', iconImg: 'img/abilities/hunter/disengage.jpg', school: 'Físico', type: 'utility', requiredLevel: 6, costPct: 0, costFocus: 0, focusGain: 5, castType: 'instant', cooldown: 3, noGcd: true, description: 'Saltas hacia atras alejandote del enemigo: +5 Focus, +20% esquivar 1 turno y no gasta accion. CD 3.', buff: null },
    { id: 'hunters_mark', name: "Hunter's Mark", icon: '🎯', iconImg: 'img/abilities/hunter/hunters_mark.jpg', school: 'Físico', type: 'damage', requiredLevel: 2, damageType: 'physical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costFocus: 5, castType: 'instant', cooldown: 0, description: 'Marca al objetivo 5 turnos reduciendo su Armor. Cuesta 5 Focus.', buffRanks: [{ rank: 1, level: 2, value: 20 }, { rank: 2, level: 12, value: 30 }, { rank: 3, level: 22, value: 40 }, { rank: 4, level: 30, value: 50 }] },
    { id: 'frost_trap', name: 'Frost Trap', icon: '❄️', iconImg: 'img/abilities/hunter/frost_trap.jpg', school: 'Escarcha', type: 'damage', requiredLevel: 6, damageType: 'magical', baseDamage: 0, spellPowerRatio: 0, costPct: 0, costFocus: 10, castType: 'instant', cooldown: 3, aoe: true, description: 'Trampa de escarcha que afecta a todos los enemigos reduciendo su capacidad de movimiento: -40% dano 3 turnos. Cuesta 10 Focus. CD 3.', buffRanks: [{ rank: 1, level: 6, value: 40 }, { rank: 2, level: 16, value: 45 }, { rank: 3, level: 26, value: 50 }] },
    { id: 'aspect_of_the_hawk', name: 'Aspect of the Hawk', icon: '🦅', iconImg: 'img/abilities/hunter/aspect_of_the_hawk.jpg', school: 'Físico', type: 'utility', requiredLevel: 2, costPct: 0, costFocus: 5, castType: 'instant', cooldown: 0, noGcd: true, description: 'Aumenta tu Attack Power en +20 por rango. Solo un Aspect activo. Cuesta 5 Focus.', buffRanks: [{ rank: 1, level: 2, value: 20 }, { rank: 2, level: 12, value: 40 }, { rank: 3, level: 22, value: 60 }, { rank: 4, level: 32, value: 80 }], buff: { stat: 'attackPower', duration: 999, applySelf: true } },
    { id: 'aspect_of_the_monkey', name: 'Aspect of the Monkey', icon: '🐒', iconImg: 'img/abilities/hunter/aspect_of_the_monkey.jpg', school: 'Físico', type: 'utility', requiredLevel: 8, costPct: 0, costFocus: 5, castType: 'instant', cooldown: 0, noGcd: true, description: 'Aumenta tu Dodge +6% y +2% por rango. Solo un Aspect activo. Cuesta 5 Focus.', buffRanks: [{ rank: 1, level: 8, value: 6 }, { rank: 2, level: 18, value: 8 }, { rank: 3, level: 28, value: 10 }, { rank: 4, level: 38, value: 12 }], buff: { stat: 'evasion', duration: 999, applySelf: true } },
    { id: 'summon_wolf', name: 'Summon Wolf', icon: '🐺', iconImg: 'img/abilities/hunter/summon_wolf.jpg', school: 'Invocacion', type: 'utility', requiredLevel: 4, costPct: 0, costFocus: 15, castType: 'cast', cooldown: 0, description: 'Invoca un Wolf que lucha a tu lado: ataca cada turno y genera 5 Focus. Puede usar Furious Howl. Un solo pet activo. Cuesta 15 Focus.', isPetSummon: 'wolf', buff: null },
    { id: 'summon_bear', name: 'Summon Bear', icon: '🐻', iconImg: 'img/abilities/hunter/summon_bear.jpg', school: 'Invocacion', type: 'utility', requiredLevel: 10, costPct: 0, costFocus: 15, castType: 'cast', cooldown: 0, description: 'Invoca un Bear tanque que lucha a tu lado: ataca cada turno y genera 5 Focus. Puede usar Growl. Un solo pet activo. Cuesta 15 Focus.', isPetSummon: 'bear', buff: null },
    { id: 'furious_howl', name: 'Furious Howl', icon: '🐺', iconImg: 'img/abilities/hunter/furious_howl.jpg', school: 'Bestial', type: 'utility', requiredLevel: 4, costPct: 0, castType: 'instant', cooldown: 3, description: 'El Wolf aulla: aumenta el dano del Hunter y del Wolf un 15% durante 3 turnos. CD 3.', petAbility: 'wolf', buffRanks: [{ rank: 1, level: 4, value: 15 }], buff: { stat: 'furious_howl', duration: 3, applySelf: true } },
    { id: 'growl', name: 'Growl', icon: '🐻', iconImg: 'img/abilities/hunter/growl.jpg', school: 'Bestial', type: 'utility', requiredLevel: 10, costPct: 0, castType: 'instant', cooldown: 0, description: 'El Bear gruñe obligando al enemigo a atacarle durante 3 turnos.', petAbility: 'bear', buffRanks: [{ rank: 1, level: 10, value: 3 }], buff: { stat: 'growl', duration: 3, applySelf: true } },
  ],

  pets: [
    {
      id: 'wolf',
      name: 'Wolf',
      icon: '🐺',
      iconImg: 'img/abilities/hunter/summon_wolf.jpg',
      requiredLevel: 4,
      hpPct: 0.45,
      manaPct: 0,
      attackName: 'Bite',
      attackMin: 18,
      attackMax: 28,
      attackSchool: 'Físico',
      manaCostPct: 0,
      focusGain: 5,
    },
    {
      id: 'bear',
      name: 'Bear',
      icon: '🐻',
      iconImg: 'img/abilities/hunter/summon_bear.jpg',
      requiredLevel: 10,
      hpPct: 0.70,
      manaPct: 0,
      attackName: 'Claw',
      attackMin: 16,
      attackMax: 24,
      attackSchool: 'Físico',
      manaCostPct: 0,
      focusGain: 5,
    },
  ],
};
