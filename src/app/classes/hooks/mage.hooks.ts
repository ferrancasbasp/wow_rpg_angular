import type { ClassAbilityHooks, ClassHooksContext } from './class-hooks';

export const mageAbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {
    switch (ability.id) {
      case 'combustion':
        castCombustion(ability, ctx);
        return true;
      case 'icy_veins':
        castIcyVeins(ability, ctx);
        return true;
      case 'arcane_power':
        castArcanePower(ability, ctx);
        return true;
      default:
        return false;
    }
  },
  spell: {
    modifyRoll(ability, ctx) {
      if (ability.id === 'cone_of_cold' && ctx.svc.character().classKey === 'mage') {
        const iccRank = ctx.svc.talentRank('improved_cone_of_cold');
        if (iccRank > 0) ctx.roll = Math.round(ctx.roll * (1 + iccRank * 0.15));
      }
    },
    modifyCritChance(ability, ctx) {
      const svc = ctx.svc;
      if (ability.castType === 'instant' && svc.character().classKey === 'mage') {
        ctx.critChance += svc.talentRank('magic_resistance') * 2;
      }
      if (ability.id === 'fire_blast' && svc.character().classKey === 'mage') {
        ctx.critChance += svc.talentRank('improved_fire_blast') * 10;
      }
      if (ability.school === 'Escarcha' && svc.character().classKey === 'mage') {
        ctx.critChance += svc.talentRank('frost_power') * 2;
      }
    },
    critMultLate(ability, ctx) {
      const svc = ctx.svc;
      if (ability.school === 'Escarcha' && svc.character().classKey === 'mage') {
        ctx.critMult += svc.talentRank('frost_power') * 0.10;
      }
      if (svc.character().classKey === 'mage') {
        const fireOrbCritMult = svc.hasEffect('combustion') ? 0.10 : 0.05;
        ctx.critMult += svc.countElementalOrbs('fire') * fireOrbCritMult;
      }
    },
  },
};

function castCombustion(ability: any, { svc }: ClassHooksContext) {
  const duration = 3;
  svc.character.update(c => ({
    ...c,
    activeEffects: [
      ...(c.activeEffects || []).filter(e => e.target !== 'combustion'),
      { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Combustion', target: 'combustion', value: 50, duration },
    ],
  }));
  svc.showToast('🔥 Combustion activa · +50% critico de Fuego · Orbes de Fuego x2 (+10% danyo critico por orbe) · ' + duration + ' turnos');
}

function castIcyVeins(ability: any, { svc }: ClassHooksContext) {
  const duration = 2;
  svc.character.update(c => ({
    ...c,
    activeEffects: [
      ...(c.activeEffects || []).filter(e => e.target !== 'icy_veins'),
      { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Icy Veins', target: 'icy_veins', value: 1, duration },
    ],
  }));
  svc.showToast('🧊 Icy Veins activa · tus hechizos de Escarcha son instantaneos (' + duration + ' turno(s))');
}

function castArcanePower(ability: any, { svc }: ClassHooksContext) {
  const duration = 2;
  svc.character.update(c => ({
    ...c,
    activeEffects: [
      ...(c.activeEffects || []).filter(e => e.target !== 'arcane_power'),
      { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Arcane Power', target: 'arcane_power', value: 20, duration },
    ],
  }));
  svc.showToast('⚡ Arcane Power activa · 2 turnos: coste de mana -50% · +20% Spell Power · +25% danyo critico');
}
