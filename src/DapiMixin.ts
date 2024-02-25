import {Constructor, ExtractFirstParam} from './types/utils';
import {DapiFns, DecoratorFn, HookFn} from './types';

/**
 * Represents an DAPI definition with dependencies and pure functions.
 * @template DEPENDENCIES The type of dependencies required by the DAPI functions dictionary.
 * @template DAPI Dictionary of pure functions. All functions must accepts as their first argument a DEPENDENCIES obj.
 */
export interface DapiDefinition<DEPENDENCIES, DAPI extends DapiFns<DEPENDENCIES>> {
  dependencies: DEPENDENCIES;
  fns: DAPI;
  type: string;
  name?: string;
}

/**
 * Mixin function that enhances a crates a DapiWrapper class with the passed definition that inherits from the passed class.
 *
 * @template DEPENDENCIES The type of dependencies required by the DAPI.
 * @template DAPI Dictionary of pure functions. All functions must accepts as their first argument a DEPENDENCIES obj.
 * @template T The constructor type of the class being enhanced.
 * @param definition The definition of the API.
 * @param SuperClass The superclass to be extended.
 * @returns The enhanced class with DAPI functionality.
 */
export function DapiMixin<DEPENDENCIES, DAPI extends DapiFns<DEPENDENCIES>, T extends Constructor<{}>>(
  definition: DapiDefinition<DEPENDENCIES, DAPI>,
  SuperClass: T
) {
  const {dependencies, fns, type, name} = definition;

  if (!type) {
    throw new TypeError(`Definition must have a type`, {cause: {type}});
  }

  if (!fns) {
    throw new TypeError(`Definition must have a dictionary (\`fns\`) of Dapi functions`, {cause: {fns}});
  }

  if (!dependencies) {
    throw new TypeError(`Definition must have dependencies`, {cause: {dependencies}});
  }

  type DecorableKeys = keyof DAPI;
  type Decorators = {
    [key in DecorableKeys]?: DecoratorFn<DAPI[key], DapiWrapper>[];
  };
  type Hooks = {
    [key in DecorableKeys]: {
      pre: HookFn<DAPI[key], DapiWrapper>[];
      post: HookFn<DAPI[key], DapiWrapper>[];
    };
  };
  type Facade = {
    [key in keyof DAPI]: (...args: ExtractFirstParam<DAPI[key]>) => ReturnType<DAPI[key]>;
  };

  /**
   * @class DapiWrapper<DEPENDENCIES, DAPI, T>
   * @classdesc Represents a class enhanced with DAPI functionality. i.e. a class that creates a facade over the Dapi functions passed within definition's `fns` dictionary. The Dapi instance methods will omit the first argument of the associated Dapi function which will be injected on runtime. The class also allows to decorate the Dapi functions with decorators and hooks.
   * @template DEPENDENCIES The type of dependencies required by the API.
   * @template DAPI Object of pure functions. All functions must accepts as their first argument a DEPENDENCIES obj.
   * @template T The constructor type of the class being enhanced.
   * @param args The arguments to be passed to the superclass.
   * @extends T
   */
  class DapiWrapper extends SuperClass {
    // Cannot use private because TS does not allow private or protected properties or methods on exported classes if you want to generate declaration files.
    // See issue discussion here: https://github.com/microsoft/TypeScript/issues/30355
    readonly __definition = definition;
    __deps: DEPENDENCIES;
    readonly __decoratedFns: DecorableKeys[];
    readonly __facade: Facade;
    readonly decorators: Decorators;
    readonly hooks: Hooks;
    readonly type = type;
    readonly name = name;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      this.decorators = {} as this['decorators'];
      this.hooks = {} as this['hooks'];
      this.__deps = {
        ...dependencies
      };
      this.__decoratedFns = [];
      this.__facade = this.__makeFacade();

      for (const key of Object.keys(fns)) {
        // @ts-expect-error - tried to define an index signature but it didn't work
        this[key] = (...params: ExtractFirstParam<DAPI[typeof key], [DEPENDENCIES]>) => {
          return this.__facade[key](...params);
        };
      }
    }

    __makeFacade() {
      const facade = {} as Facade;

      for (const entry of Object.entries(fns)) {
        const [key, command] = entry as [keyof DAPI, (typeof fns)[keyof DAPI]];

        facade[key] = (...params: ExtractFirstParam<DAPI[typeof key]>) => {
          return command.call(this, this.__deps, ...params);
        };
      }

      return facade;
    }

    __makeDecorable<KEY extends DecorableKeys>(key: KEY) {
      if (this.__decoratedFns.includes(key) || !Object.hasOwn(this.__definition.fns, key)) {
        return;
      }

      const command = this.__definition.fns[key];

      this.__facade[key] = (...params: ExtractFirstParam<DAPI[typeof key]>) => {
        const decoratorFns = this.decorators[key];
        const decorators = [...(decoratorFns ?? [])];
        const hookDecorator = this.__hookDecorator(key);

        if (hookDecorator) {
          decorators.unshift(hookDecorator);
        }

        if (!decorators.length) {
          return command.call(this, this.__deps, ...params);
        }

        return decorators
          .reduce<typeof command>(
            (decoratedMethod, decorator) => decorator.bind(this, decoratedMethod) as typeof command,
            command.bind(this) as typeof command
          )
          .apply(this, [this.__deps, ...params]);
      };

      this.__decoratedFns.push(key);
    }

    unmakeDecorable<KEY extends DecorableKeys>(key: KEY) {
      if (
        !this.__decoratedFns.includes(key) ||
        // still has associated decorators or hooks
        Object.hasOwn(this.decorators, key) ||
        Object.hasOwn(this.hooks, key)
      ) {
        return;
      }

      const command = this.__definition.fns[key];

      this.__facade[key] = (...params: ExtractFirstParam<DAPI[typeof key]>) => {
        return command.call(this, this.__deps, ...params);
      };

      this.__decoratedFns.splice(this.__decoratedFns.indexOf(key), 1);
    }

    /**
     * Dependencies getter.
     */
    getDependencies() {
      return this.__deps;
    }

    /**
     * Partially updates the dependencies of the `DapiWrapper` instance.
     * @param newDeps a partial of the dependencies to be updated.
     * @throws {TypeError} If the new dependencies are not defined or falsy.
     */
    updateDependencies(newDeps: Partial<DEPENDENCIES>) {
      if (!newDeps) {
        throw new TypeError(`Dependencies must be defined`, {cause: {dependencies: newDeps}});
      }

      this.setDependencies({
        ...this.__deps,
        ...newDeps
      });
    }

    /**
     * Dependencies setter.
     * @param newDeps The new dependencies to be set.
     * @throws {TypeError} If the new dependencies are not defined or falsy.
     */
    setDependencies(newDeps: DEPENDENCIES) {
      if (!newDeps) {
        throw new TypeError(`Dependencies must be defined`, {cause: {dependencies: newDeps}});
      }

      this.__deps = newDeps;
      this.__definition.dependencies = newDeps;
    }

    /**
     * DapiDefinition getter.
     *
     * @returns DapiDefinition
     */
    getDefinition() {
      return this.__definition;
    }

    /**
     * Returns a JSON representation of the `DapiWrapper` instance.
     * @param replacer An array of strings and numbers that acts as an approved list for selecting the object properties that will be stringified.
     * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
     */
    toJSON(...args: ExtractFirstParam<JSON['stringify']>) {
      return JSON.stringify(this.__definition, ...args);
    }

    /**
     * Returns the `DapiWrapper` definition stringified for reading.
     */
    toString() {
      return `${this.type}\n${this.toJSON(null, 2)})}}`;
    }

    /**
     * Adds a decorator to a Dapi function of the `DapiWrapper`'s Dapi functions dictionary.
     * @param key The key of the Dapi function to decorate. Must be a key of the `DapiDefinition.fns` dictionary.
     * @param decorator The decorator function. The decorator function receives the decorated function as its first argument and the rest of the arguments are the arguments of the decorated function.
     * @returns A function to remove the added decorator.
     * @throws {TypeError} If the key is not a property of the Dapi functions dictionary. i.e. Not a key of the `DapiDefinition.fns` dictionary.
     */
    addDecorator<KEY extends DecorableKeys>(key: KEY, decorator: DecoratorFn<DAPI[KEY], DapiWrapper>): () => void {
      if (typeof this[key as keyof this] !== 'function') {
        throw new TypeError(`Cannot decorate non-function property`, {cause: {key}});
      }

      if (!Object.hasOwn(this.__definition.fns, key) || typeof this.__definition.fns[key] !== 'function') {
        throw new TypeError(`Cannot decorate non-Dapi function property`, {cause: {key}});
      }

      if (!this.decorators[key]) {
        this.decorators[key] = [];
      }

      this.decorators[key]?.push(decorator);
      this.__makeDecorable(key);

      return () => {
        this.removeDecorator(key, decorator);
      };
    }

    /**
     * Decorates all the Dapi functions of the `DapiWrapper`'s Dapi functions dictionary.
     * @param decorator The decorator function. The decorator function receives the decorated function as its first argument and the rest of the arguments are the arguments of the decorated function.
     * @returns A function to remove all the added decorators.
     */
    decorateAll(decorator: DecoratorFn<DAPI[keyof DAPI], DapiWrapper>) {
      const removeDecorators: (() => void)[] = [];

      for (const key of Object.keys(this.__definition.fns)) {
        removeDecorators.push(this.addDecorator(key as keyof DAPI, decorator));
      }

      return () => {
        for (const removeDecorator of removeDecorators) {
          removeDecorator();
        }
      };
    }

    /**
     * Removes a decorator from the DapiWrapper instance.
     * @param key The key of the function to remove the decorator from. Must be a key of the `DapiDefinition.fns` dictionary.
     * @param decorator The decorator function to remove.
     */
    removeDecorator<KEY extends DecorableKeys>(key: KEY, decorator: DecoratorFn<DAPI[KEY], DapiWrapper>) {
      const index = this.decorators[key]?.indexOf(decorator);

      if (index !== undefined && index !== -1) {
        this.decorators[key]?.splice(index, 1);
      }

      if (this.decorators[key] && !this.decorators[key]?.length) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.decorators[key];
      }

      this.unmakeDecorable(key);
    }

    /**
     * Adds a hook to a Dapi function of the `DapiWrapper` instance.
     * @param hookType The type of hook to add it should be 'pre' or 'post'.
     * @param key The key of the function to decorate. Must be a key of the `DapiDefinition.fns` dictionary.
     * @param hook The hook function to add. The hook function receives the same arguments of the hooked function.
     * @returns A function to remove the added decorator.
     * @throws {TypeError} If the key is not a property of the Dapi functions dictionary. i.e. Not a key of the `DapiDefinition.fns` dictionary.
     */
    addHook<KEY extends DecorableKeys>(
      hookType: 'pre' | 'post',
      key: KEY,
      hook: HookFn<DAPI[KEY], DapiWrapper>
    ): () => void {
      if (!Object.keys(this.__definition.fns).includes(key as string)) {
        throw new TypeError(`Cannot hook to non-function property`, {cause: {key}});
      }

      if (!Object.hasOwn(this.hooks, key)) {
        this.hooks[key] = {
          post: [],
          pre: []
        };
      }

      this.hooks[key][hookType].push(hook);
      this.__makeDecorable(key);

      return () => {
        this.removeHook(hookType, key, hook);
      };
    }

    /**
     * Removes a hook from a Dapi function of the DapiWrapper instance.
     * @param hookType The type of hook to remove it should be 'pre' or 'post'.
     * @param key The key of the command to remove the hook from. Must be a key of the `DapiDefinition.fns` dictionary.
     * @param hook The hook function to remove.
     */
    removeHook<KEY extends DecorableKeys>(
      hookType: 'pre' | 'post',
      key: KEY,
      hook: HookFn<DAPI[KEY], DapiWrapper>
    ): void {
      const index = this.hooks[key][hookType].indexOf(hook);

      if (index !== undefined && index !== -1) {
        this.hooks[key][hookType].splice(index, 1);
      }

      if (Object.hasOwn(this.hooks, key) && !this.hooks[key].pre.length && !this.hooks[key].post.length) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.hooks[key];
      }

      this.unmakeDecorable(key);
    }

    /**
     * Adds a pre-hook to a Dapi function of the DapiWrapper instance.
     * @param key The key of the api function to hook to. Must be a key of the `DapiDefinition.fns` dictionary.
     * @param hook The hook function to add. The hook function receives the same arguments of the hooked function.
     * @returns A function to remove the added hook.
     * @throws {TypeError} If the key is not a property of the Dapi functions dictionary. i.e. Not a key of the `DapiDefinition.fns` dictionary.
     */
    addPreHook<KEY extends DecorableKeys>(key: KEY, hook: HookFn<DAPI[KEY], DapiWrapper>): () => void {
      return this.addHook('pre', key, hook);
    }

    /**
     * Adds a post-hook to a Dapi function of the DapiWrapper instance.
     * @param key The key of the api function to hook to. Must be a key of the `DapiDefinition.fns` dictionary.
     * @param hook The hook function to add. The hook function receives the same arguments of the hooked function.
     * @returns A function to remove the added hook.
     * @throws {TypeError} If the key is not a property of the Dapi functions dictionary. i.e. Not a key of the `DapiDefinition.fns` dictionary.
     */
    addPostHook<KEY extends DecorableKeys>(key: KEY, hook: HookFn<DAPI[KEY], DapiWrapper>): () => void {
      return this.addHook('post', key, hook);
    }

    /**
     * Removes a pre-hook from a Dapi function of the DapiWrapper instance..
     * @param key The key of the api function to hook to. Must be a key of the `DapiDefinition.fns` dictionary.
     * @param hook The hook function to remove.
     */
    removePreHook<KEY extends DecorableKeys>(key: KEY, hook: HookFn<DAPI[KEY], DapiWrapper>) {
      this.removeHook('pre', key, hook);
    }

    /**
     * Removes a post-hook from a Dapi function of the DapiWrapper instance..
     * @param key The key of the api function to hook to. Must be a key of the `DapiDefinition.fns` dictionary.
     * @param hook The hook function to remove.
     */
    removePostHook<KEY extends DecorableKeys>(key: KEY, hook: HookFn<DAPI[KEY], DapiWrapper>) {
      this.removeHook('post', key, hook);
    }

    __hookDecorator<KEY extends DecorableKeys>(key: KEY): DecoratorFn<DAPI[KEY], DapiWrapper> | undefined {
      if (!Object.hasOwn(this.hooks, key)) {
        return undefined;
      }

      return (method, ...args) => {
        const preHooks = this.hooks[key]?.pre;
        const postHooks = this.hooks[key]?.post;

        if (preHooks) {
          for (const preHook of preHooks) {
            preHook.call(this, ...args);
          }
        }

        const result = method.apply(this, args) as ReturnType<typeof method>;

        if (postHooks) {
          if ((result as unknown) instanceof Promise) {
            (result as Promise<unknown>).then(() => {
              for (const postHook of postHooks) {
                postHook.call(this, ...args);
              }
            });
          } else {
            for (const postHook of postHooks) {
              postHook.call(this, ...args);
            }
          }
        }

        return result;
      };
    }
  }

  /**
   * Represents the facade of the enhanced class with API functionality and facade bound pure functions.
   */
  type DapiFacade = Facade & ThisType<InstanceType<typeof DapiWrapper>>;

  return DapiWrapper as unknown as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (...args: any[]): InstanceType<typeof DapiWrapper> & DapiFacade;
    prototype: DapiWrapper;
  } & typeof DapiWrapper;
}

export type DapiWrapper<DEPENDENCIES, API extends DapiFns<DEPENDENCIES>, T extends Constructor<{}>> = ReturnType<
  typeof DapiMixin<DEPENDENCIES, API, T>
>;
