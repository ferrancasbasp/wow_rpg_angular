import type { ClassAbilityHooks } from './class-hooks';
import { warlockAbilityHooks } from './warlock.hooks';
import { warriorAbilityHooks } from './warrior.hooks';

export const classAbilityHooks: ClassAbilityHooks[] = [warlockAbilityHooks, warriorAbilityHooks];
