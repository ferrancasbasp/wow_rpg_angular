import type { ClassAbilityHooks, ClassHooksContext } from './class-hooks';

export const druidAbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {
    if (ability.id === 'rebirth') {
      castRebirth(ability, ctx);
      return true;
    }
    return false;
  },
  spell: {
    onDamage(ability, ctx) {
      const svc = ctx.svc;
      if (ability.id === 'basic_attack' && svc.character().classKey === 'druid') {
        const fotwRank = svc.talentRank('first_of_the_wild');
        if (fotwRank > 0) {
          const hpGain = Math.round(svc.maxHP() * fotwRank * 0.01);
          const manaGain = Math.round(svc.maxMana() * fotwRank * 0.01);
          const resourceMax = svc.resourceMax();
          svc.character.update(c => ({
            ...c,
            currentHP: Math.min(svc.maxHP(), (c.currentHP ?? svc.maxHP()) + hpGain),
            currentMana: Math.min(resourceMax, (c.currentMana ?? resourceMax) + manaGain),
          }));
          svc.syncPlayerStatus();
          ctx.texts['fotw'] = ' · +' + hpGain + ' vida · +' + manaGain + ' maná (First of the Wild)';
        }
      }
    },
    onHeal(_ability, ctx) {
      const svc = ctx.svc;
      const lhRank = svc.talentRank('lunar_healing');
      if (lhRank > 0 && Math.random() * 100 < lhRank * 10) {
        const comboMax = (svc.classConfig().comboConfig?.max) || 5;
        svc.character.update(c => ({
          ...c,
          comboPoints: Math.min(comboMax, (c.comboPoints || 0) + 1),
        }));
        ctx.texts['lunar'] = ' · +1 Moon Shard';
      }
    },
    onHot(_ability, ctx) {
      const svc = ctx.svc;
      const ability = ctx.ability;
      const lhRank = svc.talentRank('lunar_healing');
      if (lhRank > 0 && Math.random() * 100 < lhRank * 10) {
        const comboMax = (svc.classConfig().comboConfig?.max) || 5;
        svc.character.update(c => ({
          ...c,
          comboPoints: Math.min(comboMax, (c.comboPoints || 0) + 1),
        }));
        ctx.texts['lunar'] = ' · +1 Moon Shard';
      }
      if (ability.id === 'rejuvenation' && svc.talentRank('germination') > 0) {
        const germTotal = Math.round(ctx.hotTotal * 0.5);
        const germTick = Math.max(1, Math.round(germTotal / ability.hotDuration));
        svc.sendHealEvent({ ...ability, id: 'germination', name: 'Germination', isHot: true, hotDuration: ability.hotDuration }, germTotal);
        ctx.texts['germ'] = ' · 🌸 Germination ' + germTick + '/turno (' + germTotal + ' total, 50%)';
      }
    },
    modifyComboSpend(_ability, ctx) {
      if (ctx.svc.character().classKey === 'druid') {
        const equinoxRank = ctx.svc.talentRank('equinox');
        const fragPower = 0.30 * (1 + equinoxRank * 0.15);
        const aoeMult = ctx.ability.aoe ? 0.5 : 1.0;
        ctx.roll = Math.round(ctx.roll * (1 + ctx.comboSpent * fragPower * aoeMult));
      }
    },
    modifyCost(ability, ctx) {
      const svc = ctx.svc;
      if (svc.character().classKey === 'druid' && svc.selectedCapstone() === 'nature_guardian' && (ability.id === 'sunfall' || ability.id === 'starsurge')) {
        ctx.cost = 0;
      }
    },
  },
};

function castRebirth(ability: any, { svc, player }: ClassHooksContext) {
  if (svc.simMode()) {
    svc.showToast('Rebirth no esta disponible en la simulacion');
    return;
  }
  const flatHp = ability.currentMin || 200;
  const myName = svc.character().name || 'Jugador';
  player.sendDamagePayload({
    player: myName,
    ability: ability.name + ' (Revive)',
    rank: ability.currentRank || 1,
    damage: flatHp,
    damageType: 'rebirth',
    aoe: false,
    effects: null,
    turn: svc.turnNumber(),
    timestamp: Date.now(),
    assigned: false,
  });
  svc.showToast('🌿 Rebirth R' + (ability.currentRank || 1) + ': avisado al Master (' + flatHp + ' HP) — debe revivirte con el botón 🌿');
}
