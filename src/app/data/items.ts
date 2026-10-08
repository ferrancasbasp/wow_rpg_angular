import { ItemRarity, ItemSlot } from '../models/game.models';

export interface ItemRarityMeta {
  key: ItemRarity;
  label: string;
  color: string;
}

export const ITEM_RARITIES: ItemRarityMeta[] = [
  { key: 'common', label: 'Común', color: '#9d9d9d' },
  { key: 'uncommon', label: 'Poco común', color: '#1eff00' },
  { key: 'rare', label: 'Raro', color: '#0070dd' },
  { key: 'epic', label: 'Épico', color: '#a335ee' },
  { key: 'legendary', label: 'Legendario', color: '#ff8000' },
];

export const RARITY_COLOR: Record<ItemRarity, string> = Object.fromEntries(
  ITEM_RARITIES.map((r) => [r.key, r.color]),
) as Record<ItemRarity, string>;

export interface ItemSlotMeta {
  key: ItemSlot;
  label: string;
  icon: string;
}

export const ITEM_SLOTS: ItemSlotMeta[] = [
  { key: 'head', label: 'Cabeza', icon: '⛑️' },
  { key: 'chest', label: 'Pecho', icon: '🦺' },
  { key: 'hands', label: 'Manos', icon: '🧤' },
  { key: 'legs', label: 'Piernas', icon: '👖' },
  { key: 'feet', label: 'Pies', icon: '👢' },
  { key: 'mainHand', label: 'Mano principal', icon: '⚔️' },
  { key: 'offHand', label: 'Mano no dominante', icon: '🛡️' },
  { key: 'twoHand', label: 'A dos manos', icon: '🗡️' },
  { key: 'ranged', label: 'A distancia', icon: '🏹' },
];

export const SLOT_ICON: Record<ItemSlot, string> = Object.fromEntries(
  ITEM_SLOTS.map((s) => [s.key, s.icon]),
) as Record<ItemSlot, string>;
