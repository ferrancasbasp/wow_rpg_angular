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
