import type { ClassAbilityHooks, ClassHooksContext } from './class-hooks';

export const hunterAbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {
    switch (ability.id) {
      case 'explosive_shot':
        castExplosiveShot(ability, ctx);
        return true;
      case 'kill_command':
        castKillCommand(ability, ctx);
        return true;
      case 'disengage':
        castDisengage(ability, ctx);
        return true;
      case 'aspect_of_the_hawk':
      case 'aspect_of_the_monkey':
        castAspect(ability, ctx);
        return true;
      default:
        return false;
    }
  },
  spell: {
    modifyCritChance(ability, ctx) {
      const svc = ctx.svc;
      if (svc.character().classKey === 'hunter' && ['auto_shot', 'arcanic_shot', 'aimed_shot', 'multi_shot'].includes(ability.id)) {
        const hawkActive = (svc.character().activeEffects || []).some(e => e.type === 'buff' && e.name === 'Aspect of the Hawk');
        if (hawkActive) ctx.critChance += svc.talentRank('improved_aspect_of_the_hawk') * 4;
      }
    },
    critMultLate(ability, ctx) {
      const svc = ctx.svc;
      if (svc.character().classKey === 'hunter' && ['auto_shot', 'arcanic_shot', 'aimed_shot', 'multi_shot'].includes(ability.id)) {
        ctx.critMult = ctx.critMult * (1 + svc.talentRank('mortal_shots') * 0.05);
      }
    },
  },
};

function castExplosiveShot(ability: any, { svc, player }: ClassHooksContext) {
  const level = svc.character().level;
  const ranks = ability.damageRanges || [];
  const rnk = [...ranks].reverse().find((d: any) => d.level <= level) || ranks[0];
  const totalMin = rnk ? rnk.min : 54;
  const totalMax = rnk ? rnk.max : 84;
  const total = totalMin + Math.floor(Math.random() * (totalMax - totalMin + 1));
  const tick = Math.max(1, Math.round(total / 3));
  svc.addTurnDamage(total);
  player.sendDamagePayload({
    player: svc.character().name || 'Jugador',
    ability: ability.name,
    rank: rnk ? rnk.rank : 1,
    damage: total,
    damageType: 'magical',
    aoe: true,
    effects: [{ type: 'dot', name: 'Explosive Shot', value: tick, duration: 3, debuffType: 'fire', stackable: false }],
    turn: svc.turnNumber(),
    timestamp: Date.now(),
    assigned: false,
  });
  svc.showToast(ability.name + ' R' + (rnk ? rnk.rank : 1) + ': 🔥 ' + total + ' Fuego (' + tick + '/t · 3t) a todos los enemigos — enviado al Master');
}

function castKillCommand(ability: any, { svc, player }: ClassHooksContext) {
  const pet = svc.activePetData();
  if (!pet) {
    svc.showToast('No tienes mascota activa');
    return;
  }
  const effects = svc.character().activeEffects || [];
  const hawkEff = effects.find(e => e.type === 'buff' && e.name === 'Aspect of the Hawk');
  const howlEff = effects.find(e => e.type === 'buff' && e.name === 'Furious Howl');
  let dmg = Math.round(pet.attackMin + Math.random() * (pet.attackMax - pet.attackMin));
  if (hawkEff) dmg = Math.round(dmg * (1 + (hawkEff.value || 0) / 100));
  if (howlEff) dmg = Math.round(dmg * (1 + (howlEff.value || 0) / 100));
  const playerName = (svc.character().name || '').trim();
  const petPlayerName = playerName ? playerName + ' — ' + pet.name : '';
  svc.addTurnDamage(dmg);
  player.sendDamagePayload({
    player: petPlayerName,
    ability: ability.name,
    rank: ability.currentRank || 1,
    damage: dmg,
    damageType: 'physical',
    aoe: false,
    effects: null,
    turn: svc.turnNumber(),
    timestamp: Date.now(),
    assigned: false,
  });
  const focusMax = svc.resourceMax();
  svc.character.update(c => ({
    ...c,
    currentFocus: Math.min(focusMax, (c.currentFocus ?? 0) + 10),
  }));
  svc.showToast(ability.name + ': ' + pet.name + ' hace un golpe extra: ' + dmg + ' danyo · +10 Focus · Focus ' + svc.resourceActual() + '/' + focusMax);
}

function castDisengage(ability: any, { svc }: ClassHooksContext) {
  svc.character.update(c => ({
    ...c,
    activeEffects: [...(c.activeEffects || []), {
      id: Date.now() + Math.random(),
      type: 'buff' as const,
      name: 'Disengage',
      target: 'evasion',
      value: 20,
      duration: 1,
    }],
  }));
  svc.showToast(ability.name + ': +5 Focus · +20% esquivar 1 turno (no gasta accion)');
}

function castAspect(ability: any, { svc }: ClassHooksContext) {
  const rank = ability.currentRank || 1;
  const buffRank = ability.buffRanks?.find((br: any) => br.rank === rank);
  const value = buffRank ? buffRank.value : 20;
  const stat = (ability.buff && ability.buff.stat) || 'attackPower';
  const duration = (ability.buff && ability.buff.duration) || 999;
  const otherName = stat === 'attackPower' ? 'Aspect of the Monkey' : 'Aspect of the Hawk';
  svc.character.update(c => {
    const filtered = (c.activeEffects || []).filter(e => e.name !== 'Aspect of the Hawk' && e.name !== 'Aspect of the Monkey');
    return {
      ...c,
      activeEffects: [...filtered, {
        id: Date.now() + Math.random(),
        type: 'buff' as const,
        name: ability.name,
        target: stat,
        value,
        duration,
        isPercent: false,
      }],
    };
  });
  const statLabel = stat === 'attackPower' ? 'Attack Power' : 'Dodge';
  svc.showToast(ability.name + ' R' + rank + ': +' + value + ' ' + statLabel + ' — Aspect activado (solo puedes tener uno) · Focus ' + svc.resourceActual() + '/' + svc.resourceMax());
}
