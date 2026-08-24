import { Npc } from '../models/game.models';

export const NPC_REGISTRY: Record<string, Npc> = {
  mottled_boar: {
    id: 'mottled_boar', name: 'Mottled Boar', level: 3, hp: 85, armor: 10, zone: 'Elwynn Forest',
    imageUrl: 'img/enemies/Boar-3.jpeg',
    attacks: [
      { name: 'Charge', minDamage: 10, maxDamage: 18 },
      { name: 'Bite', minDamage: 8, maxDamage: 14 },
    ],
  },
  dire_boar: {
    id: 'dire_boar', name: 'Dire Boar', level: 5, hp: 152, armor: 20, zone: 'Elwynn Forest',
    imageUrl: 'img/enemies/Boar-5.jpeg',
    attacks: [
      { name: 'Charge', minDamage: 16, maxDamage: 28 },
      { name: 'Bite', minDamage: 12, maxDamage: 22, inflictsEffects: [{ type: 'dot', name: 'Sangrado', target: 'hp', value: 4, duration: 3, debuffType: 'disease' }] },
    ],
  },
  defias_looter: {
    id: 'defias_looter', name: 'Defias Looter', level: 6, hp: 175, armor: 25, zone: 'Westfall',
    imageUrl: 'img/enemies/Defias-6.jpeg',
    attacks: [
      { name: 'Backstab', minDamage: 18, maxDamage: 30 },
      { name: 'Slash', minDamage: 14, maxDamage: 24 },
    ],
  },
  defias_evoker: {
    id: 'defias_evoker', name: 'Defias Evoker', level: 7, hp: 198, armor: 10, zone: 'Westfall',
    imageUrl: 'img/enemies/Defias-Mage-7.jpeg',
    attacks: [
      { name: 'Fire Bolt', minDamage: 42, maxDamage: 58, inflictsEffects: [{ type: 'dot', name: 'Queadura', target: 'hp', value: 8, duration: 3, debuffType: 'magic' }] },
      { name: 'Frost Nova', minDamage: 32, maxDamage: 48, inflictsEffects: [{ type: 'status', name: 'Ralentizado', target: 'slowed', value: 0, duration: 2, debuffType: 'magic' }] },
    ],
  },
  riverpaw_gnoll: {
    id: 'riverpaw_gnoll', name: 'Riverpaw Gnoll', level: 6, hp: 210, armor: 25, zone: 'Westfall',
    imageUrl: 'img/enemies/Gnoll-6.jpeg',
    attacks: [
      { name: 'Cleave', minDamage: 20, maxDamage: 32 },
      { name: 'Strike', minDamage: 16, maxDamage: 26 },
      { name: 'Mend', minDamage: 25, maxDamage: 45, isHeal: true },
    ],
  },
  wolf_pup: {
    id: 'wolf_pup', name: 'Wolf Pup', level: 4, hp: 110, armor: 12, zone: 'Elwynn Forest',
    imageUrl: 'img/enemies/Wolf-4.jpeg',
    attacks: [
      { name: 'Bite', minDamage: 12, maxDamage: 20 },
      { name: 'Howl', minDamage: 6, maxDamage: 10, inflictsEffects: [{ type: 'debuff', name: 'Aullido', target: 'attackPower', value: 3, duration: 3, debuffType: 'none' }] },
    ],
  },
  wolf_alpha: {
    id: 'wolf_alpha', name: 'Wolf Alpha', level: 9, hp: 285, armor: 22, zone: 'Elwynn Forest',
    imageUrl: 'img/enemies/Wolf-9.jpeg',
    attacks: [
      { name: 'Savage Bite', minDamage: 24, maxDamage: 38, inflictsEffects: [{ type: 'dot', name: 'Sangrado', target: 'hp', value: 6, duration: 3, debuffType: 'disease' }] },
      { name: 'Howl', minDamage: 10, maxDamage: 16, inflictsEffects: [{ type: 'debuff', name: 'Aullido', target: 'attackPower', value: 5, duration: 3, debuffType: 'none' }] },
    ],
  },
  great_goretusk: {
    id: 'great_goretusk', name: 'Great Goretusk', level: 12, hp: 412, armor: 40, zone: 'Redridge Mountains',
    imageUrl: 'img/enemies/Boar-12.jpeg',
    attacks: [
      { name: 'Gore', minDamage: 32, maxDamage: 50, inflictsEffects: [{ type: 'dot', name: 'Sangrado', target: 'hp', value: 8, duration: 4, debuffType: 'disease' }] },
      { name: 'Savage Bite', minDamage: 24, maxDamage: 40 },
      { name: 'Trample', minDamage: 20, maxDamage: 60 },
    ],
  },
  gnoll_healer_16: {
    id: 'gnoll_healer_16', name: 'Gnoll Healer', level: 16, hp: 620, armor: 25, magicResist: 30, zone: 'Redridge Mountains',
    imageUrl: 'img/enemies/Gnoll-Healer-16.jpeg',
    attacks: [
      { name: 'Healing Wave', minDamage: 150, maxDamage: 220, isHeal: true },
      { name: 'Lightning Bolt', minDamage: 55, maxDamage: 75, inflictsEffects: [{ type: 'debuff', name: 'Chispa', target: 'spellPower', value: 10, duration: 4, debuffType: 'magic' }] },
      { name: 'Staff Smash', minDamage: 30, maxDamage: 45 },
    ],
  },
  riverpaw_bone_chanter: {
    id: 'riverpaw_bone_chanter', name: 'Riverpaw Bone Chanter', level: 13, hp: 475, armor: 35, zone: 'Redridge Mountains',
    imageUrl: 'img/enemies/Gnoll-13.jpeg',
    attacks: [
      { name: 'Bone Strike', minDamage: 36, maxDamage: 56 },
      { name: 'Shadow Bolt', minDamage: 52, maxDamage: 72, inflictsEffects: [{ type: 'dot', name: 'Sombra', target: 'hp', value: 10, duration: 3, debuffType: 'magic' }] },
      { name: 'Cursed Howl', minDamage: 44, maxDamage: 88, inflictsEffects: [{ type: 'debuff', name: 'Maldición', target: 'all_stats', value: 5, duration: 4, debuffType: 'curse' }] },
    ],
  },
  elder_goretusk: {
    id: 'elder_goretusk', name: 'Elder Goretusk', level: 15, hp: 585, armor: 55, zone: 'Redridge Mountains',
    imageUrl: 'img/enemies/Boar-15.jpeg',
    attacks: [
      { name: 'Gore', minDamage: 44, maxDamage: 68, inflictsEffects: [{ type: 'dot', name: 'Sangrado', target: 'hp', value: 10, duration: 4, debuffType: 'disease' }] },
      { name: 'Savage Bite', minDamage: 34, maxDamage: 54 },
      { name: 'Trample', minDamage: 28, maxDamage: 82 },
    ],
  },
  dire_wolf: {
    id: 'dire_wolf', name: 'Dire Wolf', level: 17, hp: 680, armor: 40, zone: 'Redridge Mountains',
    imageUrl: 'img/enemies/Wolf-17.jpeg',
    attacks: [
      { name: 'Savage Bite', minDamage: 38, maxDamage: 58, inflictsEffects: [{ type: 'dot', name: 'Sangrado', target: 'hp', value: 12, duration: 4, debuffType: 'disease' }] },
      { name: 'Furious Howl', minDamage: 22, maxDamage: 34, inflictsEffects: [{ type: 'debuff', name: 'Aullido', target: 'attackPower', value: 8, duration: 3, debuffType: 'none' }] },
    ],
  },
  elite_defias_pirate_gun: {
    id: 'elite_defias_pirate_gun', name: 'Elite Defias Pirate (Gun)', level: 16, hp: 920, armor: 50, zone: 'Westfall',
    imageUrl: 'img/enemies/Elite-Defias-Pirate-gun-16.jpeg', isElite: true,
    attacks: [
      { name: 'Pistol Shot', minDamage: 48, maxDamage: 72, inflictsEffects: [{ type: 'dot', name: 'Sangrado', target: 'hp', value: 12, duration: 3, debuffType: 'disease' }] },
      { name: 'Bayonet', minDamage: 36, maxDamage: 56 },
      { name: 'Suppressing Fire', minDamage: 28, maxDamage: 44, inflictsEffects: [{ type: 'status', name: 'Silenciado', target: 'silenced', value: 0, duration: 2, debuffType: 'none' }] },
    ],
  },
  elite_defias_pirate_mage: {
    id: 'elite_defias_pirate_mage', name: 'Elite Defias Pirate (Mage)', level: 17, hp: 1050, armor: 30, zone: 'Westfall',
    imageUrl: 'img/enemies/Elite-Defias-Pirate-mage-17.jpeg', isElite: true,
    attacks: [
      { name: 'Fireball', minDamage: 62, maxDamage: 88, inflictsEffects: [{ type: 'dot', name: 'Quemadura', target: 'hp', value: 14, duration: 3, debuffType: 'magic' }] },
      { name: 'Frost Nova', minDamage: 48, maxDamage: 68, inflictsEffects: [{ type: 'status', name: 'Ralentizado', target: 'slowed', value: 0, duration: 3, debuffType: 'magic' }] },
      { name: 'Hex', minDamage: 40, maxDamage: 60, inflictsEffects: [{ type: 'debuff', name: 'Maldición', target: 'spellPower', value: 15, duration: 4, debuffType: 'curse' }] },
    ],
  },
  elite_defias_pirate_sword: {
    id: 'elite_defias_pirate_sword', name: 'Elite Defias Pirate (Sword)', level: 18, hp: 1180, armor: 70, zone: 'Westfall',
    imageUrl: 'img/enemies/Elite-Defias-Pirtal-sword-18.jpeg', isElite: true,
    attacks: [
      { name: 'Sword Slash', minDamage: 54, maxDamage: 80, inflictsEffects: [{ type: 'dot', name: 'Sangrado', target: 'hp', value: 14, duration: 4, debuffType: 'disease' }] },
      { name: 'Shield Bash', minDamage: 40, maxDamage: 60, inflictsEffects: [{ type: 'status', name: 'Aturdido', target: 'stunned', value: 0, duration: 1, debuffType: 'none' }] },
    ],
  },
  elite_iron_golem: {
    id: 'elite_iron_golem', name: 'Elite Iron Golem', level: 18, hp: 1450, armor: 90, zone: 'Redridge Mountains',
    imageUrl: 'img/enemies/Elite-Iron-Golem-18.jpeg', isElite: true,
    attacks: [
      { name: 'Iron Fist', minDamage: 68, maxDamage: 96, inflictsEffects: [{ type: 'status', name: 'Aturdido', target: 'stunned', value: 0, duration: 1, debuffType: 'none' }] },
      { name: 'Ground Slam', minDamage: 52, maxDamage: 78, inflictsEffects: [{ type: 'debuff', name: 'Ralentizado', target: 'slowed', value: 0, duration: 3, debuffType: 'none' }] },
    ],
  },
};
