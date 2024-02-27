import {AnyFunction} from './utils.js';

/**
 * Dapi function type. It is a function that receives the dependencies as the first argument.
 */
export type DapiFn<F extends CallableFunction, DEPS> = F extends (
  this: infer THIS,
  arg0: DEPS,
  ...args: infer ARGS
) => infer R
  ? (this: THIS, arg0: DEPS, ...args: ARGS) => R
  : never;

export type DapiFns<DEPS> = Record<string, DapiFn<AnyFunction, DEPS>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DecoratorFn<F extends AnyFunction, THIS, SELF = any> = (
  this: SELF extends THIS ? SELF : never,
  fn: F,
  ...args: Parameters<F>
) => ReturnType<F>;

export type HookFn<F extends AnyFunction, THIS> = (this: THIS, ...args: Parameters<F>) => void;
