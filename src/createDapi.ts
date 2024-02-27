import {DapiMixin, DapiDefinition} from './DapiMixin.js';
import type {DapiFns} from './types/index.js';
import {Constructor} from './types/utils.js';

/**
 * Creates an Dapi facade.
 * @public
 * @param definition - The Dapi definition.
 * @param SuperClass - The super class.
 * @returns An instance of the created DapiWrapper facade class.
 */
export const createDapi = <DEPENDENCIES, API extends DapiFns<DEPENDENCIES>, T extends Constructor<{}>>(
  definition: DapiDefinition<DEPENDENCIES, API>,
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  SuperClass: T = class {} as T
) => new (DapiMixin(definition, SuperClass))();
