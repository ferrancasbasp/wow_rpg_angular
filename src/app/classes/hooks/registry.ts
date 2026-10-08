import type { ClassAbilityHooks } from './class-hooks';
import { warlockAbilityHooks } from './warlock.hooks';
import { warriorAbilityHooks } from './warrior.hooks';
import { mageAbilityHooks } from './mage.hooks';

export const classAbilityHooks: ClassAbilityHooks[] = [warlockAbilityHooks, warriorAbilityHooks, mageAbilityHooks];
