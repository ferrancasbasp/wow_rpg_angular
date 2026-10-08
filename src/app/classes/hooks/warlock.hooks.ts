import type { ClassAbilityHooks, ClassHooksContext } from './class-hooks';

export const warlockAbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {
    const { svc, player, t } = ctx;
    switch (ability.id) {
      case 'summon_infernal':
        castSummonInfernal(ability, ctx);
        return true;
      case 'seed_of_corruption':
        castSeedOfCorruption(ability, ctx);
        return true;
      case 'demonic_sacrifice':
        castDemonicSacrifice(ability, ctx);
        return true;
      case 'dark_star':
        castDarkStar(ability, ctx);
        return true;
      case 'life_tap':
        castLifeTap(ability, ctx);
        return true;
      default:
        return false;
    }
  },
  spell: {
    modifyCritChance(ability, ctx) {
      if (ability.id === 'chaos_bolt' || ability.id === 'rain_of_fire') {
        ctx.critChance += ctx.svc.talentRank('destruction_specialization') * 5;
      }
    },
    critMultEarly(ability, ctx) {
      if (ability.id === 'chaos_bolt' || ability.id === 'rain_of_fire') {
        ctx.critMult = 1.5 + ctx.svc.talentRank('destruction_specialization') * 0.10;
      }
    },
  },
};

function castSummonInfernal(ability: any, { svc, t }: ClassHooksContext) {
  const shardCost = ability.shardCost || 2;
  svc.spendShards(shardCost);

  const sp = svc.spellPower();
  const ratio = ability.spellPowerRatio || 0.8;
  const dr = ability.damageRanges?.[0] || { min: 70, max: 110 };
  const minD = Math.round(dr.min + sp * ratio);
  const maxD = Math.round(dr.max + sp * ratio);
  let dmg = minD + Math.floor(Math.random() * (maxD - minD + 1));
  if (Math.random() * 100 < parseFloat(svc.spellCrit())) {
    let critMult = 1.5;
    if (svc.hasEffect('demonic_form')) critMult = critMult * 1.25;
    dmg = Math.round(dmg * critMult);
  }

  const landingAbility = {
    ...ability,
    currentRank: 1,
    isDot: false,
    inflictsEffects: [{ type: 'debuff', name: t('infernal_stun'), target: 'stunned', value: 0, duration: ability.stunDuration || 1 }],
  };
  svc.sendDamageEvent(landingAbility, dmg);

  const turns = ability.infernalTurns || 4;
  svc.summonInfernal(turns);
  svc.showToast('🔥 Infernal aterriza! ' + dmg + ' danyo de Fuego a todos · stun 1 turno · lucha ' + turns + ' turnos');
}

function castDemonicSacrifice(ability: any, { svc, t }: ClassHooksContext) {
  const shardCost = ability.shardCost || 2;
  if (!svc.spendShards(shardCost)) {
    svc.showToast(t('need_shards') + ' ' + shardCost + ' ' + t('soul_shards_plural'));
    return;
  }
  const pet = svc.activePetData();
  if (!pet) {
    svc.addShard(shardCost);
    svc.showToast('No tienes un demonio invocado para sacrificar');
    return;
  }
  const now = Date.now() + Math.random();
  const maxHp = svc.maxHP();
  if (pet.id === 'imp') {
    svc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.name !== 'Burning Soul'),
        { id: now, type: 'buff' as const, name: 'Burning Soul', target: 'spellPower', value: 20, duration: 999, isPercent: true },
      ],
    }));
    svc.showToast('💀 Sacrificaste al Imp · Burning Soul: +20% Spell Power (toda la batalla)');
  } else if (pet.id === 'voidwalker') {
    const shieldAmt = Math.round(maxHp * 0.25);
    svc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.name !== 'Void Fortitude' && e.target !== 'shield'),
        { id: now, type: 'buff' as const, name: 'Void Fortitude', target: 'maxHP', value: 25, duration: 999, isPercent: true },
        { id: now + 1, type: 'buff' as const, name: 'Void Fortitude', target: 'shield', value: shieldAmt, duration: 999 },
      ],
    }));
    svc.showToast('💀 Sacrificaste al Voidwalker · Void Fortitude: +25% vida maxima y escudo de ' + shieldAmt + ' HP');
  } else {
    svc.addShard(shardCost);
    svc.showToast('Ese demonio no puede ser sacrificado (aun)');
    return;
  }
  svc.dismissPet();
}

function castDarkStar(ability: any, { svc, player }: ClassHooksContext) {
  const mb = svc.computedAbilities().find(a => a.id === 'mind_blast');
  let dmg = 0;
  if (mb && ((mb as any).currentMin || (mb as any).currentMax)) {
    const minD = (mb as any).currentMin || 0;
    const maxD = (mb as any).currentMax || 0;
    dmg = Math.round(minD + Math.random() * (maxD - minD));
  } else {
    const sp = svc.spellPower();
    dmg = Math.round(40 + Math.random() * 15 + sp * 0.429);
  }
  const dm = svc.computedAbilities().find(a => a.id === 'dark_mending');
  let heal = 0;
  if (dm && ((dm as any).currentMin || (dm as any).currentMax)) {
    const minH = (dm as any).currentMin || 0;
    const maxH = (dm as any).currentMax || 0;
    heal = Math.round(minH + Math.random() * (maxH - minH));
  } else {
    const sp = svc.spellPower();
    heal = Math.round(135 + sp * 0.7);
  }
  const isCrit = Math.random() * 100 < parseFloat(svc.spellCrit());
  if (isCrit) {
    dmg = Math.round(dmg * 1.5);
    heal = Math.round(heal * 1.5);
  }
  const lowHp = (svc.character().currentHP ?? svc.maxHP()) / svc.maxHP() < 0.5;
  if (lowHp) heal = Math.round(heal * 2);
  const myName = svc.character().name || 'Jugador';
  player.sendDamagePayload({
    player: myName,
    ability: ability.name,
    rank: ability.currentRank || 1,
    damage: dmg,
    damageType: 'magical',
    aoe: true,
    effects: null,
    turn: svc.turnNumber(),
    timestamp: Date.now(),
    assigned: false,
  });
  const healMult = svc.healingReceivedMult();
  const appliedHeal = healMult < 1 ? Math.round(heal * healMult) : heal;
  svc.adjustHP(appliedHeal);
  const healReduced = healMult < 1 ? ' (cura reducida −' + Math.round((1 - healMult) * 100) + '%)' : '';
  svc.showToast(ability.name + ': ' + dmg + ' danyo de sombra a todos (AOE)' + (isCrit ? ' ¡CRITICO!' : '') + ' · te curas ' + appliedHeal + healReduced + (lowHp ? ' (x2 low HP)' : ''));
}

function castSeedOfCorruption(ability: any, { svc, player, t }: ClassHooksContext) {
  const shardCost = ability.shardCost || 1;
  if (!svc.spendShards(shardCost)) {
    svc.showToast(t('need_shards') + ' 1 ' + t('soul_shard'));
    return;
  }
  const corr = svc.computedAbilities().find(a => a.id === 'corruption');
  let dotTick = 10;
  if (corr && ((corr as any).dotTick || (corr as any).currentDotValue)) {
    dotTick = (corr as any).dotTick || (corr as any).currentDotValue || 10;
  } else {
    const rank = svc.maxAvailableRank(svc.classConfig().abilities.find(a => a.id === 'corruption')!);
    const dr = (svc.classConfig().abilities.find(a => a.id === 'corruption')?.dotRanges || []).find(d => d.rank === rank);
    if (dr) {
      dotTick = dr.value;
    }
  }
  const boosted = Math.round(dotTick * 1.10);
  player.sendDamagePayload({
    player: svc.character().name || 'Jugador',
    ability: ability.name,
    rank: ability.currentRank || 1,
    damage: 0,
    damageType: 'magical',
    aoe: true,
    effects: [{ type: 'dot', name: 'Seed of Corruption', value: boosted, duration: 5, debuffType: 'shadow' }],
    seedShards: true,
    turn: svc.turnNumber(),
    timestamp: Date.now(),
    assigned: false,
  });
  svc.showToast(ability.name + ': DoT potenciado (+10%) a todos los enemigos · -35% mana · el Master devuelve 1 Soul Shard por enemigo (max 5)');
}

function castLifeTap(ability: any, { svc }: ClassHooksContext) {
  const manaGained = ability.currentBuffValue;
  const healthLost = manaGained;
  svc.character.update(c => ({
    ...c,
    currentHP: Math.max(1, svc.hpActual() - healthLost),
    currentMana: Math.min(svc.maxMana(), (c.currentMana ?? svc.maxMana()) + manaGained),
  }));
  svc.syncPlayerStatus();
  svc.showToast(ability.name + ' R' + ability.currentRank + ': -' + healthLost + ' vida · +' + manaGained + ' mana');
}
