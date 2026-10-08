import { Component, inject, signal } from '@angular/core';
import { Item, ItemRarity, ItemSlot, StatKey, Stats } from '../../models/game.models';
import { FirebaseService } from '../../services/firebase.service';
import { STAT_ABBR, STAT_ICONS, STAT_LABELS } from '../../data/game-data';
import { ITEM_RARITIES, ITEM_SLOTS, RARITY_COLOR, SLOT_ICON } from '../../data/items';

const STAT_KEYS_ARRAY: StatKey[] = ['fuerza', 'agilidad', 'intelecto', 'aguante', 'espiritu'];
const EMPTY_STATS: Stats = { fuerza: 0, agilidad: 0, intelecto: 0, aguante: 0, espiritu: 0 };

@Component({
  selector: 'app-item-generator',
  standalone: true,
  templateUrl: './item-generator.component.html',
  styleUrls: ['./item-generator.component.css'],
})
export class ItemGeneratorComponent {
  private firebase = inject(FirebaseService);

  statKeys = STAT_KEYS_ARRAY;
  statIcons = STAT_ICONS;
  statAbbr = STAT_ABBR;
  statLabels = STAT_LABELS;
  rarities = ITEM_RARITIES;
  slots = ITEM_SLOTS;
  rarityColor = RARITY_COLOR;
  slotIcon = SLOT_ICON;

  rarityLabel = (r: ItemRarity) => this.rarities.find(x => x.key === r)?.label || r;
  slotLabel = (s: ItemSlot) => this.slots.find(x => x.key === s)?.label || s;

  name = signal('');
  slot = signal<ItemSlot>('head');
  rarity = signal<ItemRarity>('common');
  statValues = signal<Record<StatKey, number>>({ ...EMPTY_STATS });
  defense = signal<number | null>(null);
  weaponDamage = signal<number | null>(null);
  saving = signal(false);
  toastMessage = signal('');
  lastItem = signal<Item | null>(null);

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  onStatInput(key: StatKey, event: Event) {
    const value = Math.max(0, Math.floor(Number((event.target as HTMLInputElement).value)) || 0);
    this.statValues.update(s => ({ ...s, [key]: value }));
  }

  onDefenseInput(event: Event) {
    this.defense.set(Math.max(0, Math.floor(Number((event.target as HTMLInputElement).value)) || 0) || null);
  }

  onWeaponInput(event: Event) {
    this.weaponDamage.set(Math.max(0, Math.floor(Number((event.target as HTMLInputElement).value)) || 0) || null);
  }

  previewStats(): { key: StatKey; value: number }[] {
    return STAT_KEYS_ARRAY
      .map(key => ({ key, value: this.statValues()[key] || 0 }))
      .filter(s => s.value > 0);
  }

  previewEmpty(): boolean {
    return this.name().trim() === ''
      && this.previewStats().length === 0
      && !(this.defense() || 0)
      && !(this.weaponDamage() || 0);
  }

  async saveItem() {
    const trimmed = this.name().trim();
    if (!trimmed) {
      this.showToast('Pon un nombre al ítem');
      return;
    }
    const bonus: Partial<Stats> = {};
    for (const key of STAT_KEYS_ARRAY) {
      bonus[key] = this.statValues()[key] || 0;
    }
    const defense = this.defense() || 0;
    const weaponDamage = this.weaponDamage() || 0;
    const hasStatBonus = STAT_KEYS_ARRAY.some(key => (bonus[key] || 0) > 0);
    if (!hasStatBonus && defense <= 0 && weaponDamage <= 0) {
      this.showToast('Añade al menos un bonus (stat, armadura o daño)');
      return;
    }
    this.saving.set(true);
    try {
      const payload: any = {
        name: trimmed,
        slot: this.slot(),
        rarity: this.rarity(),
        bonus,
        defense: this.defense() || 0,
        weaponDamage: this.weaponDamage() || 0,
        owner: null,
        createdAt: Date.now(),
      };
      const result = await this.firebase.pushData('items', payload);
      this.lastItem.set({ id: result.key ?? '', ...payload } as Item);
      this.showToast('✅ ' + trimmed + ' guardado en el stash');
      this.name.set('');
      this.statValues.set({ ...EMPTY_STATS });
      this.defense.set(null);
      this.weaponDamage.set(null);
    } catch (e) {
      console.error('Firebase save item error:', e);
      const err = e as { code?: string; message?: string };
      this.showToast('❌ No se pudo guardar: ' + (err?.code || err?.message || 'revisa consola'));
    } finally {
      this.saving.set(false);
    }
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 2500);
  }
}
