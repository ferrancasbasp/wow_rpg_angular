import type { ClassAbilityHooks, ClassHooksContext } from './class-hooks';

export const shamanAbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {
    if (ability.totem) {
      castTotem(ability, ctx);
      return true;
    }
    if (ability.weaponImbue) {
      castWeaponImbue(ability, ctx);
      return true;
    }
    switch (ability.id) {
      case 'ascendance':
        castAscendance(ability, ctx);
        return true;
      case 'bloodlust':
        castBloodlust(ability, ctx);
        return true;
      case 'spirit_link_totem':
        castSpiritLink(ability, ctx);
        return true;
      default:
        return false;
    }
  },
  spell: {
    modifyCost(_ability, ctx) {
      if (ctx.maelstormFree) {
        ctx.cost = Math.round((ctx.cost || 0) * 0.5 * (1 - ctx.svc.talentRank('maelstrom_efficiency') * 0.15));
      }
    },
    modifyCritChance(ability, ctx) {
      const svc = ctx.svc;
      if (svc.character().classKey === 'shaman' && (ability.id === 'lightning_bolt' || ability.id === 'chain_lightning')) {
        ctx.critChance += svc.talentRank('thundering_strikes') * 5;
      }
      if (svc.character().classKey === 'shaman' && svc.hasEffect('ascendance') && ['lightning_bolt', 'chain_lightning', 'flame_shock', 'earth_shock'].includes(ability.id)) {
        ctx.critChance += 5;
      }
    },
    critMultLate(ability, ctx) {
      const svc = ctx.svc;
      if (svc.character().classKey === 'shaman' && ['lightning_bolt', 'chain_lightning', 'flame_shock', 'earth_shock'].includes(ability.id)) {
        ctx.critMult += svc.talentRank('elemental_fury') * 0.05;
      }
      if (svc.character().classKey === 'shaman' && svc.hasEffect('ascendance') && ['lightning_bolt', 'chain_lightning', 'flame_shock', 'earth_shock'].includes(ability.id)) {
        ctx.critMult = ctx.critMult * 1.25;
      }
    },
  },
};

function castTotem(ability: any, { svc }: ClassHooksContext) {
  const slot = ability.totem === 'fire' ? 'fire' : 'water';
  const prev = svc.totemInfo(slot);
  const itRank = svc.talentRank('improved_totems');
  const totemMult = 1 + itRank * 0.10;
  svc.summonTotem(slot, ability.totemType || 'searing', ability.totemTurns || 4, Math.round((ability.currentMin || 0) * totemMult), Math.round((ability.currentMax || 0) * totemMult), Math.round((ability.currentBuffValue || ability.currentMin || 0) * totemMult));
  const slotLabel = ability.totem === 'fire' ? 'Tótem de Fuego' : 'Tótem de Agua';
  const prevText = prev ? ' (sustituye al anterior)' : '';
  const detail = ability.totemType === 'fire_nova'
    ? 'explotará durante tu siguiente turno'
    : 'duración ' + (ability.totemTurns || 4) + ' turnos';
  const multText = itRank > 0 ? ' · efectividad +' + Math.round(itRank * 10) + '%' : '';
  svc.showToast('🪵 ' + ability.name + ' R' + ability.currentRank + ': ' + detail + ' · ' + slotLabel + prevText + multText);
}

function castWeaponImbue(ability: any, { svc }: ClassHooksContext) {
  const imbValue = ability.currentBuffValue;
  svc.character.update(c => ({
    ...c,
    activeEffects: [
      ...(c.activeEffects || []).filter(e => e.target !== 'weapon_imbue'),
      { id: Date.now() + Math.random(), type: 'buff' as const, name: ability.name, target: 'weapon_imbue', value: imbValue, duration: 999, isPercent: false },
    ],
  }));
  const detail = ability.id === 'flametongue_weapon'
    ? 'tus ataques basicos +' + imbValue + ' danyo de fuego'
    : 'tus ataques basicos: ' + imbValue + '% Windfury';
  svc.showToast('🗡️ ' + ability.name + ' R' + ability.currentRank + ': ' + detail + ' (solo un imbuíto de arma)');
}

function castAscendance(ability: any, { svc }: ClassHooksContext) {
  const duration = 3;
  svc.character.update(c => ({
    ...c,
    activeEffects: [
      ...(c.activeEffects || []).filter(e => e.target !== 'ascendance'),
      { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Ascendance', target: 'ascendance', value: 1, duration },
    ],
  }));
  const bolt = svc.unlockedAbilities().find((a: any) => a.id === 'lightning_bolt');
  let boltText = '';
  if (bolt) {
    const min = (bolt as any).currentMin || 0;
    const max = (bolt as any).currentMax || 0;
    let roll = min + Math.floor(Math.random() * (max - min + 1));
    const critChance = parseFloat(svc.spellCrit()) + svc.talentRank('thundering_strikes') * 5 + 5;
    const isCrit = Math.random() * 100 < critChance;
    if (isCrit) {
      const critMult = (1.5 + svc.talentRank('elemental_fury') * 0.05) * 1.25;
      roll = Math.round(roll * critMult);
    }
    svc.turnDamage.update(d => d + roll);
    svc.sendDamageEvent({ ...bolt, isDot: false, aoe: false }, roll, 1, 1);
    boltText = ' · ⚡ Rayo gratuito: ' + roll + ' danyo' + (isCrit ? ' ¡CRITICO!' : '');
  }
  svc.showToast('🔥 Ascendance activa · 3 turnos: +30% Spell Power, +5% crit y +25% danyo critico (Rayo, Cadena, Choque de Llamas y de Tierra)' + boltText);
}

function castBloodlust(ability: any, { svc }: ClassHooksContext) {
  const duration = 3;
  svc.character.update(c => ({
    ...c,
    activeEffects: [
      ...(c.activeEffects || []).filter(e => e.target !== 'bloodlust'),
      { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Bloodlust', target: 'bloodlust', value: 20, duration },
    ],
    comboPoints: Math.min(svc.getMaelstromMax(), (c.comboPoints || 0) + 2),
  }));
  svc.sendBuffEvent(ability);
  svc.showToast('🩸 Bloodlust · party +20% Attack Power y Spell Power (3 turnos) · +2 Cargas de Maelstorm — enviado al Master (AOE)');
}

function castSpiritLink(ability: any, { svc }: ClassHooksContext) {
  const duration = 3;
  svc.character.update(c => ({
    ...c,
    activeEffects: [
      ...(c.activeEffects || []).filter(e => e.target !== 'spirit_link'),
      { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Spirit Link Totem', target: 'spirit_link', value: 1, duration },
    ],
  }));
  svc.showToast('🕸️ Totem de Vinculo Espiritual (3 turnos) · Ola de Sanacion replica 30% a la party · Cadena de Sanacion +20%');
}
