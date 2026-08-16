import { Npc } from '../models/game.models';

export const NPC_REGISTRY: Record<string, Npc> = {
  mottled_boar: {
    id: 'mottled_boar', name: 'Mottled Boar', level: 3, hp: 85, armor: 10, zone: 'Elwynn Forest',
    imageUrl: 'img/enemies/boar_young.jpg',
    attacks: [
      { name: 'Charge', minDamage: 10, maxDamage: 18 },
      { name: 'Bite', minDamage: 8, maxDamage: 14 },
    ],
  },
  dire_boar: {
    id: 'dire_boar', name: 'Dire Boar', level: 5, hp: 152, armor: 20, zone: 'Elwynn Forest',
    imageUrl: 'img/enemies/boar_dire.jpg',
    attacks: [
      { name: 'Charge', minDamage: 16, maxDamage: 28 },
      { name: 'Bite', minDamage: 12, maxDamage: 22 },
    ],
  },
  defias_looter: {
    id: 'defias_looter', name: 'Defias Looter', level: 6, hp: 175, armor: 25, zone: 'Westfall',
    imageUrl: 'img/enemies/defias_looter.jpg',
    attacks: [
      { name: 'Backstab', minDamage: 18, maxDamage: 30 },
      { name: 'Slash', minDamage: 14, maxDamage: 24 },
      { name: 'Pickpocket Strike', minDamage: 12, maxDamage: 20 },
    ],
  },
  defias_evoker: {
    id: 'defias_evoker', name: 'Defias Evoker', level: 7, hp: 198, armor: 10, zone: 'Westfall',
    imageUrl: 'img/enemies/defias_evoker.jpg',
    attacks: [
      { name: 'Fire Bolt', minDamage: 42, maxDamage: 58 },
      { name: 'Frost Nova', minDamage: 32, maxDamage: 48 },
      { name: 'Arcane Missiles', minDamage: 24, maxDamage: 40 },
    ],
  },
  riverpaw_gnoll: {
    id: 'riverpaw_gnoll', name: 'Riverpaw Gnoll', level: 6, hp: 210, armor: 25, zone: 'Westfall',
    imageUrl: 'img/enemies/gnoll_riverpaw.jpg',
    attacks: [
      { name: 'Cleave', minDamage: 20, maxDamage: 32 },
      { name: 'Strike', minDamage: 16, maxDamage: 26 },
    ],
  },
  great_goretusk: {
    id: 'great_goretusk', name: 'Great Goretusk', level: 12, hp: 412, armor: 40, zone: 'Redridge Mountains',
    imageUrl: 'img/enemies/boar_goretusk.jpg',
    attacks: [
      { name: 'Gore', minDamage: 32, maxDamage: 50 },
      { name: 'Savage Bite', minDamage: 24, maxDamage: 40 },
      { name: 'Trample', minDamage: 20, maxDamage: 60 },
    ],
  },
  riverpaw_bone_chanter: {
    id: 'riverpaw_bone_chanter', name: 'Riverpaw Bone Chanter', level: 13, hp: 475, armor: 35, zone: 'Redridge Mountains',
    imageUrl: 'img/enemies/gnoll_bone_chanter.jpg',
    attacks: [
      { name: 'Bone Strike', minDamage: 36, maxDamage: 56 },
      { name: 'Shadow Bolt', minDamage: 52, maxDamage: 72 },
      { name: 'Cursed Howl', minDamage: 44, maxDamage: 88 },
    ],
  },
  elder_goretusk: {
    id: 'elder_goretusk', name: 'Elder Goretusk', level: 15, hp: 585, armor: 55, zone: 'Redridge Mountains',
    imageUrl: 'img/enemies/boar_elder_goretusk.jpg',
    attacks: [
      { name: 'Gore', minDamage: 44, maxDamage: 68 },
      { name: 'Savage Bite', minDamage: 34, maxDamage: 54 },
      { name: 'Trample', minDamage: 28, maxDamage: 82 },
    ],
  },
};
