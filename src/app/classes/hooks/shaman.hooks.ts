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
    onDamage(_ability, ctx) {
      const svc = ctx.svc;
      const ability = ctx.ability;
      if (svc.character().classKey !== 'shaman') return;
      if (ability.id === 'basic_attack' || ability.id === 'storm_strike') {
        const shImbue = (svc.character().activeEffects || []).find(e => e.target === 'weapon_imbue');
        if (shImbue) {
          if (shImbue.name === 'Arma Lengua de Fuego') {
            const iwiRank = svc.talentRank('improved_weapon_imbues');
            const imbDmg = Math.round(shImbue.value * (1 + iwiRank * 0.10));
            ctx.roll += imbDmg;
            ctx.texts['imbue'] = ' · 🔥+' + imbDmg + ' fuego';
          } else {
            const wfDisplay = (shImbue.value || 20) + svc.talentRank('improved_weapon_imbues') * 5;
            ctx.texts['imbue'] = ' · 💨 Windfury (' + wfDisplay + '%)';
          }
        }
      }
      if (ability.id === 'storm_strike') {
        const natureBuffValue = ability.currentBuffValue || 20;
        const natureBuffDur = ability.buff?.duration || 2;
        svc.character.update(c => ({
          ...c,
          activeEffects: [
            ...(c.activeEffects || []).filter(e => e.name !== 'Storm Strike'),
            { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Storm Strike', target: 'nature_boost', value: natureBuffValue, duration: natureBuffDur, isPercent: true },
          ],
        }));
        ctx.texts['storm'] = ' · ⛈️ siguiente hechizo de Naturaleza +' + natureBuffValue + '%';
      }
      if (ability.id === 'earth_shock') {
        const ssRank = svc.talentRank('static_shock');
        if (ssRank > 0 && Math.random() * 100 < ssRank * 25) {
          const ssMax = svc.getMaelstromMax();
          svc.character.update(c => ({ ...c, comboPoints: Math.min(ssMax, (c.comboPoints || 0) + 1) }));
          ctx.texts['staticShock'] = ' · +1 Maelstorm (Static Shock)';
        }
      }
    },
    onHit(_ability, ctx) {
      const svc = ctx.svc;
      const ability = ctx.ability;
      if (svc.character().classKey !== 'shaman') return;
      if (ability.id === 'basic_attack' || ability.id === 'storm_strike') {
        const wfImbue = (svc.character().activeEffects || []).find(e => e.target === 'weapon_imbue' && e.name === 'Arma Viento Furioso');
        const wfChance = wfImbue ? (wfImbue.value || 20) + svc.talentRank('improved_weapon_imbues') * 5 : 0;
        if (wfImbue && Math.random() * 100 < wfChance) {
          svc.turnDamage.update(d => d + ctx.roll);
          svc.sendDamageEvent({ ...ability, name: ability.name + ' (Windfury)' }, ctx.roll, 1, 1);
          let wfComboText = '';
          const wfComboMax = svc.getMaelstromMax();
          const wfComboChance = svc.getEffectiveComboChance(ability);
          if (Math.random() * 100 < wfComboChance && (svc.character().comboPoints || 0) < wfComboMax) {
            svc.character.update(c => ({ ...c, comboPoints: Math.min(wfComboMax, (c.comboPoints || 0) + 1) }));
            wfComboText = ' · +1 Maelstorm';
          }
          svc.showToast('💨 Windfury! Ataque adicional ' + ctx.roll + ' dano' + wfComboText + ' — ' + ctx.t('sent_to_master'));
        }
      }
    },
    onDot(_ability, ctx) {
      const svc = ctx.svc;
      const ability = ctx.ability;
      if (ability.id === 'flame_shock') {
        const min = ability.currentMin || 0;
        const max = ability.currentMax || 0;
        const directRoll = min + Math.floor(Math.random() * (max - min + 1));
        ctx.texts['direct'] = ' +' + directRoll + ' directo';
        svc.turnDamage.update(d => d + directRoll);
        svc.sendDamageEvent({ ...ability, isDot: false }, directRoll, 1, 1);
      }
    },
    onHeal(_ability, ctx) {
      const svc = ctx.svc;
      const ability = ctx.ability;
      if (svc.character().classKey !== 'shaman') return;
      const spiritLinkActive = svc.hasEffect('spirit_link');
      const twRank = svc.talentRank('tidal_waves');
      if (twRank > 0 && ability.id === 'chain_heal') {
        svc.character.update(c => ({
          ...c,
          activeEffects: [
            ...(c.activeEffects || []).filter(e => e.target !== 'tidal_waves'),
            { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Tidal Waves', target: 'tidal_waves', value: 10 * twRank, duration: 3, isPercent: false },
          ],
        }));
        ctx.texts['tidal'] = ' · Tidal Waves: siguiente Healing Wave +' + (10 * twRank) + '%';
      }
      if (ability.id === 'healing_wave' && svc.hasEffect('tidal_waves')) {
        const twBuff = (svc.character().activeEffects || []).find(e => e.target === 'tidal_waves');
        if (twBuff) {
          ctx.healBonus *= (1 + (twBuff.value || 0) / 100);
          ctx.texts['tidal'] = ' · Tidal Waves +' + (twBuff.value || 0) + '%';
          svc.character.update(c => ({
            ...c,
            activeEffects: (c.activeEffects || []).filter(e => e.target !== 'tidal_waves'),
          }));
        }
      }
      if (spiritLinkActive && ability.id === 'chain_heal') {
        ctx.healBonus *= 1.20;
        ctx.texts['spirit'] = ' · 🕸️ Vínculo: +20% curación';
      }
      if (ability.id === 'healing_wave' || ability.id === 'chain_heal') {
        const hgRank = svc.talentRank('healing_grace');
        if (hgRank > 0) {
          ctx.healBonus *= (1 + hgRank * 0.10);
          if (Math.random() * 100 < hgRank * 20) {
            const hgMax = svc.getMaelstromMax();
            svc.character.update(c => ({ ...c, comboPoints: Math.min(hgMax, (c.comboPoints || 0) + 1) }));
            ctx.texts['healGrace'] = ' · +1 Maelstorm';
          }
        }
      }
    },
    onCrit(_ability, ctx) {
      const svc = ctx.svc;
      if (ctx.isCrit && svc.character().classKey === 'shaman' && (ctx.ability.id === 'lightning_bolt' || ctx.ability.id === 'chain_lightning') && svc.talentRank('elemental_focus') > 0) {
        const efMax = svc.getMaelstromMax();
        svc.character.update(c => ({ ...c, comboPoints: Math.min(efMax, (c.comboPoints || 0) + 1) }));
        ctx.texts['efCrit'] = ' · +1 Maelstorm (crit)';
      }
    },
    onSpend(_ability, ctx) {
      const svc = ctx.svc;
      if (ctx.maelstormFree) {
        svc.character.update(c => ({ ...c, comboPoints: 0 }));
        const noGcd = svc.character().classKey === 'shaman' && svc.talentRank('maelstrom_mastery') > 0;
        ctx.texts['maelstorm'] = noGcd
          ? ' · ¡Maelstorm! Lanzamiento sin GCD y (−50% maná)'
          : ' · ¡Maelstorm! Lanzamiento instantáneo (−50% maná)';
      }
    },
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
