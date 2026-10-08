import type { ClassAbilityHooks, ClassHooksContext } from './class-hooks';

export const valkyrieAbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {
    switch (ability.id) {
      case 'valkyries_call':
        castValkyriesCall(ability, ctx);
        return true;
      case 'valk_call_from_valhalla':
        castCallFromValhalla(ability, ctx);
        return true;
      default:
        return false;
    }
  },
  spell: {
    castSpell(ability, ctx) {
      const svc = ctx.svc;
      if (svc.character().classKey !== 'valkyrie') return false;
      const poolName = () => (svc.selectedValkyriePool() === 'shield' ? 'escuido' : 'lanza');

      if (ability.energyCost && !svc.valkyriePoolHas(ability.energyCost)) {
        svc.showToast('No tienes suficiente carga de ' + poolName());
        return true;
      }
      if (ability.energyCost) {
        const spent = svc.spendValkyriePool(ability.energyCost);
        ctx.texts['valkSpend'] = ' · −' + spent + ' carga de ' + poolName();
      }

      if (ability.id === 'valk_mending') {
        const poolActual = svc.valkyriePoolValue();
        if (poolActual <= 0) {
          svc.showToast('No tienes carga de ' + poolName());
          return true;
        }
        const spent = svc.spendValkyriePool(poolActual);
        const tmRank = svc.talentRank('twin_mending');
        const mFlat = Math.round((ability.currentBuffValue || 60) * (1 + tmRank * 0.15));
        const healAmount = spent + mFlat;
        svc.adjustHP(healAmount);
        svc.syncPlayerStatus();
        svc.useAction(ctx.actionCost);
        const effCdM = svc.getEffectiveCooldown(ability);
        if (effCdM > 0) {
          svc.character.update(c => {
            if (!c.currentCooldowns) c.currentCooldowns = {};
            c.currentCooldowns[ability.id] = effCdM;
            return { ...c };
          });
        }
        let twinMendingText = '';
        if (tmRank > 0) {
          const tmHeal = Math.round(healAmount * 0.20 * tmRank);
          if (tmHeal > 0) {
            svc.sendHealEvent({ ...ability, name: 'Twin Mending' }, tmHeal);
            twinMendingText = ' · 🤝 +' + tmHeal + ' a un aliado (Twin Mending)';
          }
        }
        const nowHP = svc.hpActual();
        if (nowHP >= svc.maxHP()) {
          ctx.player.setValkFallen(false);
        }
        svc.showToast(ability.name + ' R' + ability.currentRank + ': +' + healAmount + ' vida (' + spent + ' carga de ' + poolName() + ' + ' + mFlat + ')' + twinMendingText);
        return true;
      }

      if (ability.id === 'valk_dive_strike' || ability.id === 'valk_lightning_bolt') {
        if (!svc.odinsWillActive()) {
          svc.showToast('Necesitas el buffo de Odins Will para usar ' + ability.name);
          return true;
        }
        if (ability.id === 'valk_dive_strike' && !svc.valkyrieFlying()) {
          svc.showToast(ability.name + ' requiere estar en el cielo');
          return true;
        }
      }

      if (ability.id === 'valk_lightning_bolt') {
        const poolActual = svc.valkyriePoolValue();
        if (poolActual <= 0) {
          svc.showToast('No tienes carga de ' + poolName());
          return true;
        }
        const spent = svc.spendValkyriePool(poolActual);
        const flat = (ability.currentMin || 0) + Math.floor(Math.random() * ((ability.currentMax || 0) - (ability.currentMin || 0) + 1));
        const vortexMult = 1 + svc.talentRank('lightning_vortex') * 0.10;
        const flatBoosted = Math.round(flat * vortexMult);
        const ijRank = svc.talentRank('improved_javelin');
        const energyContribution = 0.70 + ijRank * 0.10;
        const energyDmg = Math.round(spent * energyContribution);
        const roll = flatBoosted + energyDmg;
        svc.useAction(ctx.actionCost);
        svc.turnDamage.update(d => d + roll);
        svc.sendDamageEvent({ ...ability, name: ability.name + ' R' + ability.currentRank }, roll, 1, 1);
        svc.showToast(ability.name + ' R' + ability.currentRank + ': ⚡ ' + roll + ' daño mágico (' + flatBoosted + ' plano + ' + energyDmg + ' de ' + spent + ' carga de ' + svc.selectedValkyriePool() + ' (' + Math.round(energyContribution * 100) + '%)' + (ijRank > 0 ? ' · Improved Javelin R' + ijRank : '') + ') — ' + ctx.t('sent_to_master'));
        return true;
      }

      return false;
    },
    onDamage(ability, ctx) {
      const svc = ctx.svc;
      if (svc.character().classKey !== 'valkyrie') return;
      if (ability.id === 'basic_attack' && svc.selectedCapstone() === 'hope_and_grace') {
        const graceHeal = Math.round(ctx.roll * 0.30);
        if (graceHeal > 0) {
          svc.sendHealEvent({ ...ability, id: 'hope_and_grace', name: 'Hope and Grace', description: '' }, graceHeal);
          ctx.texts['hope'] = ' · 🕊️ +' + graceHeal + ' vida (Hope and Grace) — ' + ctx.t('sent_to_master');
        }
      }
      const critEnergyMult = ctx.isCrit ? 1 + svc.talentRank('critical_energy') * 0.33 : 1;
      const lvEnergyMult = svc.talentRank('lightning_vortex') > 0 ? 1.10 : 1;
      ctx.extraHitCritMult = 1.5 + svc.talentRank('hurtfull_lightning') * 0.05;
      if (ability.id === 'empalar') {
        const gained = Math.round(ctx.roll * 0.5 * lvEnergyMult * svc.valkyrieChargeGainMult() * critEnergyMult);
        svc.addSpearCharge(gained);
        ctx.texts['valkCharge'] = ' · ⚔️ Lanza +' + gained;
      } else if (ability.id === 'shield_bash') {
        const gained = Math.round(ctx.roll * 1.0 * lvEnergyMult * svc.valkyrieChargeGainMult());
        svc.addShieldCharge(gained);
        const myName = (svc.character().name || '').trim() || 'Jugador';
        const effects = ctx.sendAbility.inflictsEffects ? [...ctx.sendAbility.inflictsEffects] : [];
        effects.push({ type: 'debuff' as const, name: 'Provocar', target: 'taunt' as const, value: myName, duration: 2, debuffType: 'none' as const, stackable: false });
        ctx.sendAbility = { ...ctx.sendAbility, inflictsEffects: effects };
        ctx.texts['valkCharge'] = ' · 🛡️ Escudo +' + gained;
        ctx.texts['valkTaunt'] = ' · 🗯️ Provocas al enemigo';
      } else if (ability.id === 'valk_cleave') {
        const gained = Math.round(ctx.roll * 0.3 * svc.valkyrieChargeGainMult() * critEnergyMult);
        svc.addSpearCharge(gained);
        ctx.texts['valkCharge'] = ' · ⚔️ Lanza +' + gained;
      } else if (ability.id === 'valk_dive_strike') {
        const gained = Math.round(ctx.roll * 0.4 * lvEnergyMult * svc.valkyrieChargeGainMult() * critEnergyMult);
        svc.addSpearCharge(gained);
        ctx.texts['valkCharge'] = ' · ⚔️ Lanza +' + gained;
        svc.character.update(c => ({
          ...c,
          activeEffects: (c.activeEffects || []).filter(e => e.target !== 'flying'),
        }));
        ctx.texts['valkCharge'] += ' · 🕊️ Aterrizas al hacer Plunge';
      }
    },
    modifyRoll(ability, ctx) {
      if (ability.id === 'shield_bash' && ctx.svc.character().classKey === 'valkyrie') {
        const wardedRank = ctx.svc.talentRank('warded');
        if (wardedRank > 0) ctx.roll = Math.round(ctx.roll * (1 + wardedRank * 0.10));
      }
    },
    modifyCritChance(_ability, ctx) {
      const svc = ctx.svc;
      if (svc.character().classKey === 'valkyrie') {
        ctx.critChance += svc.talentRank('endurance') * 2;
        ctx.critChance += svc.talentRank('hurtfull_lightning') * 2;
      }
    },
    critMultEarly(ability, ctx) {
      if (ctx.svc.character().classKey === 'valkyrie' && ability.type === 'damage') {
        ctx.critMult = ctx.critMult + ctx.svc.talentRank('hurtfull_lightning') * 0.05;
      }
    },
  },
};

function castValkyriesCall(ability: any, { svc, player }: ClassHooksContext) {
  const myName = svc.character().name || 'Jugador';
  const turn = svc.turnNumber();
  const now = Date.now();
  const heal = Math.round(svc.maxHP() * 0.15);
  const base = {
    player: myName,
    rank: ability.currentRank || 1,
    aoe: true,
    effects: null,
    turn,
    timestamp: now,
    assigned: false,
  };
  player.sendDamagePayload({
    ...base,
    ability: ability.name + ' (Cura)',
    damage: heal,
    damageType: 'heal',
    isHot: false,
    hotTick: 0,
    hotDuration: 0,
    isShield: false,
  });
  player.sendDamagePayload({
    ...base,
    ability: ability.name + ' (Accion)',
    damage: 0,
    damageType: 'buff',
    buffStat: 'actions_per_turn',
    buffValue: 1,
    buffDuration: 1,
    isPercent: false,
  });
  svc.showToast("Valkyrie's Call: +1 accion a todos los aliados y cura de " + heal + ' HP — 2 eventos AOE al Master');
}

function castCallFromValhalla(ability: any, { svc, player }: ClassHooksContext) {
  if (svc.simMode()) {
    svc.showToast('Call from Valhalla no esta disponible en la simulacion');
    return;
  }
  const myName = svc.character().name || 'Jugador';
  player.sendDamagePayload({
    player: myName,
    ability: ability.name + ' (Revive)',
    rank: ability.currentRank || 1,
    damage: svc.maxHP(),
    damageType: 'rebirth',
    aoe: false,
    effects: null,
    buffAp: 50,
    buffSp: 50,
    buffDuration: 2,
    turn: svc.turnNumber(),
    timestamp: Date.now(),
    assigned: false,
  });
  svc.showToast('⚔️ Call from Valhalla: revivira a un aliado muerto con ' + svc.maxHP() + ' HP y +50 AP/SP (2 turnos) — asigna el objetivo en el Master');
}
