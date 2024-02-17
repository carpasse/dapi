/* eslint-disable max-classes-per-file, no-invalid-this, class-methods-use-this */
import {describe, it, mock, beforeEach, Mock} from 'node:test';
import assert from 'node:assert/strict';
import {DapiMixin, type DapiDefinition} from '../DapiMixin';
import {assertType} from '../types/assertType';

class BaseTestClass {
  static baseStaticMethod() {
    return 'baseStatic';
  }

  static baseStaticProperty = 'baseStaticProperty';

  baseProperty = 'baseProperty';

  baseMethod() {
    return 'base';
  }
}

describe('DapiMixin', () => {
  type Deps = {
    foo: string;
    opts?: {
      [key: string]: string;
    };
  };
  type DapiFnsDict = {
    command1: (deps: Deps, a1: string, a2: string) => [typeof a1, typeof a2];
    command2: (deps: Deps) => void;
    command3: (deps: Deps, a1: string, a2: string) => Promise<[typeof a1, typeof a2]>;
  };
  let deps: Deps;
  let fns: DapiFnsDict;
  let command1: Mock<(deps: Deps, a1: string, a2: string) => [typeof a1, typeof a2]>;
  let command2: Mock<(deps: Deps) => void>;
  let command3: Mock<(deps: Deps, a1: string, a2: string) => Promise<[typeof a1, typeof a2]>>;
  let definition: DapiDefinition<Deps, DapiFnsDict>;

  beforeEach(() => {
    deps = {foo: 'bar', opts: {extra: 'extra'}};
    command1 = mock.fn((_deps, a1, a2) => [a1, a2]);
    command2 = mock.fn();
    command3 = mock.fn(async (_deps, a1, a2) => [a1, a2]);
    fns = {
      command1,
      command2,
      command3
    };
    definition = {dependencies: deps, fns, type: 'test'};
  });

  it('should throw if the passed definition does not have a type', () => {
    assert.throws(
      () => {
        // @ts-expect-error
        DapiMixin({dependencies: deps, fns}, BaseTestClass);
      },
      {
        cause: {
          type: undefined
        },
        message: 'Definition must have a type',
        name: 'TypeError'
      }
    );
  });

  it('should throw if the passed definition does not have Dapi functions dictionary', () => {
    assert.throws(
      () => {
        // @ts-expect-error
        DapiMixin({dependencies: deps, type: 'test'}, BaseTestClass);
      },
      {
        cause: {
          fns: undefined
        },
        message: 'Definition must have a dictionary (`fns`) of Dapi functions',
        name: 'TypeError'
      }
    );
  });

  it('should throw if the passed definition does not have dependencies', () => {
    assert.throws(
      () => {
        // @ts-expect-error
        DapiMixin({fns, type: 'test'}, BaseTestClass);
      },
      {
        cause: {
          dependencies: undefined
        },
        message: 'Definition must have dependencies',
        name: 'TypeError'
      }
    );
  });

  describe('class instance', () => {
    it('should expose a dependencies getter', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();

      assert.deepStrictEqual(instance.getDependencies(), deps);
    });

    it('should expose a dependencies setter', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);

      const testClass = new TestClass();
      const newDependencies: Deps = {foo: 'baz'};

      testClass.setDependencies(newDependencies);

      assert.deepStrictEqual(testClass.getDependencies(), newDependencies);
    });

    it('should expose a definition getter', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();

      assert.deepStrictEqual(instance.getDefinition(), definition);
    });

    it('should throw if you try to set the dependencies to a falsy value', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();

      // @ts-expect-error
      assert.throws(() => instance.setDependencies(), {
        cause: {
          dependencies: undefined
        },
        message: 'Dependencies must be defined',
        name: 'TypeError'
      });

      // @ts-expect-error
      assert.throws(() => instance.setDependencies(null), {
        cause: {
          dependencies: null
        },
        message: 'Dependencies must be defined',
        name: 'TypeError'
      });
    });

    it('should expose a method to partially update the dependencies', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();

      instance.updateDependencies({opts: {extra: 'test'}});

      assert.deepEqual(instance.getDependencies(), {foo: 'bar', opts: {extra: 'test'}});
    });

    it('should throw if we try to update the dependencies with a falsy value', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();

      // @ts-expect-error
      assert.throws(() => instance.updateDependencies(), {
        cause: {
          dependencies: undefined
        },
        message: 'Dependencies must be defined',
        name: 'TypeError'
      });

      // @ts-expect-error
      assert.throws(() => instance.updateDependencies(null), {
        cause: {
          dependencies: null
        },
        message: 'Dependencies must be defined',
        name: 'TypeError'
      });
    });

    it('should expose the type', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();

      assert.deepStrictEqual(instance.type, definition.type);
    });

    it('should be possible to pass a name in the definition', () => {
      const TestClass = DapiMixin({...definition, name: 'test'}, BaseTestClass);
      const instance = new TestClass();

      assert.deepStrictEqual(instance.name, 'test');
    });

    it('should expose toJSON method', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();

      assert.deepStrictEqual(instance.toJSON(), JSON.stringify(definition));
    });

    it('should print the definition on toPrimitive', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();

      assert.equal(`${instance}`, instance.toString());
    });

    it('should expose toString method', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();

      assert(instance.toString instanceof Function);
      assert.strictEqual(instance.toString(), `${instance.type}\n${JSON.stringify(definition, null, 2)})}}`);
    });

    it('should create a facade with the commands', async () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();

      for (const key of Object.keys(fns)) {
        const facadeCmd = instance[key];

        assert(facadeCmd instanceof Function);
      }

      assertType<Parameters<typeof instance.command1>>(['', '']);
      assertType<Parameters<typeof instance.command2>>([]);
      assertType<Parameters<typeof instance.command3>>(['', '']);

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(instance.command2(), undefined);
      assert.deepStrictEqual(await instance.command3('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command2.mock.calls[0].arguments, [deps]);
      assert.deepStrictEqual(command3.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.deepStrictEqual(command2.mock.calls[0].this, instance);
      assert.deepStrictEqual(command3.mock.calls[0].this, instance);
    });

    it('facade methods should call commands with the dependencies', () => {
      class TestClass extends DapiMixin(definition, BaseTestClass) {}
      const instance = new TestClass();

      instance.command1('a1', 'a2');
      instance.command2();
      instance.command3('a1', 'a2');

      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command2.mock.calls[0].arguments, [deps]);
      assert.deepStrictEqual(command3.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert(command1.mock.calls[0].this === instance);
      assert(command2.mock.calls[0].this === instance);
      assert(command3.mock.calls[0].this === instance);
    });

    it('facade methods should work even if we deconstruct them', () => {
      class TestClass extends DapiMixin(definition, BaseTestClass) {}
      const instance = new TestClass();
      const {command1: cmd1, command2: cmd2, command3: cmd3} = instance;

      cmd1('a1', 'a2');
      cmd2();
      cmd3('a1', 'a2');

      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command2.mock.calls[0].arguments, [deps]);
      assert.deepStrictEqual(command3.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert(command1.mock.calls[0].this === instance);
      assert(command2.mock.calls[0].this === instance);
      assert(command3.mock.calls[0].this === instance);
    });

    it('should return the result of the command', async () => {
      class TestClass extends DapiMixin(definition, BaseTestClass) {}
      const instance = new TestClass();

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(await instance.command3('a1', 'a2'), ['a1', 'a2']);
    });

    it('should throw if the command throws', async () => {
      class TestClass extends DapiMixin(definition, BaseTestClass) {}
      const instance = new TestClass();

      command1.mock.mockImplementation(() => {
        throw new Error('test');
      });

      await assert.rejects(async () => instance.command1('a1', 'a2'), {
        message: 'test'
      });
    });

    it('should throw if the command throws asynchronously', async () => {
      class TestClass extends DapiMixin(definition, BaseTestClass) {}
      const instance = new TestClass();

      command3.mock.mockImplementation(async () => {
        throw new Error('test');
      });

      await assert.rejects(async () => instance.command3('a1', 'a2'), {
        message: 'test'
      });
    });

    it('should throw if the command does not exist', () => {
      class TestClass extends DapiMixin(definition, BaseTestClass) {}
      const instance = new TestClass();

      // @ts-expect-error
      assert.throws(() => instance.command4());
    });

    it('should be possible to decorate the dapi fns', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const decorator = mock.fn(function (method, ...args) {
        return method(...args);
      });

      instance.addDecorator('command1', decorator);

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.deepStrictEqual(decorator.mock.calls[0].this, instance);
      assert.equal(decorator.mock.calls[0].arguments.length, 4);
      assert(decorator.mock.calls[0].arguments[0] instanceof Function);
      assert.deepStrictEqual(decorator.mock.calls[0].arguments[1], instance.getDependencies());
      assert.deepStrictEqual(decorator.mock.calls[0].arguments[2], 'a1');
      assert.deepStrictEqual(decorator.mock.calls[0].arguments[3], 'a2');
    });

    it('should be possible to decorate async commands', async () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const decorator = mock.fn(async function (method, ...args) {
        return method(...args);
      });

      instance.addDecorator('command3', decorator);

      assert.deepStrictEqual(await instance.command3('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command3.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command3.mock.calls[0].this, instance);
      assert.deepStrictEqual(decorator.mock.calls[0].this, instance);
      assert.equal(decorator.mock.calls[0].arguments.length, 4);
      assert(decorator.mock.calls[0].arguments[0] instanceof Function);
      assert.deepStrictEqual(decorator.mock.calls[0].arguments[1], instance.getDependencies());
      assert.deepStrictEqual(decorator.mock.calls[0].arguments[2], 'a1');
      assert.deepStrictEqual(decorator.mock.calls[0].arguments[3], 'a2');
    });

    it('should not be possible to decorate non existing commands', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const decorator = mock.fn(function (method, ...args) {
        return method(...args);
      });

      // @ts-expect-error - command4 does not exist
      assert.throws(() => instance.addDecorator('command4', decorator), {
        cause: {
          key: 'command4'
        },
        message: 'Cannot decorate non-function property',
        name: 'TypeError'
      });
    });

    it('should not be possible to decorate non api functions', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const decorator = mock.fn(function (method, ...args) {
        return method(...args);
      });

      // @ts-expect-error - toString is not a command
      assert.throws(() => instance.addDecorator('toString', decorator), {
        cause: {
          key: 'toString'
        },
        message: 'Cannot decorate non-Dapi function property',
        name: 'TypeError'
      });
    });

    it('should be possible to decorate the api functions with multiple decorators', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const decorator1 = mock.fn(function (method, ...args) {
        return method(...args);
      });
      const decorator2 = mock.fn(function (method, ...args) {
        return method(...args);
      });

      instance.addDecorator('command1', decorator1);
      instance.addDecorator('command1', decorator2);

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.deepStrictEqual(decorator1.mock.calls[0].this, instance);
      assert.deepStrictEqual(decorator2.mock.calls[0].this, instance);
      assert.equal(decorator1.mock.calls[0].arguments.length, 4);
      assert(decorator1.mock.calls[0].arguments[0] instanceof Function);
      assert.deepStrictEqual(decorator1.mock.calls[0].arguments[1], instance.getDependencies());
      assert.deepStrictEqual(decorator1.mock.calls[0].arguments[2], 'a1');
      assert.deepStrictEqual(decorator1.mock.calls[0].arguments[3], 'a2');
      assert.equal(decorator2.mock.calls[0].arguments.length, 4);
      assert(decorator2.mock.calls[0].arguments[0] instanceof Function);
      assert.deepStrictEqual(decorator2.mock.calls[0].arguments[1], instance.getDependencies());
      assert.deepStrictEqual(decorator2.mock.calls[0].arguments[2], 'a1');
      assert.deepStrictEqual(decorator2.mock.calls[0].arguments[3], 'a2');
    });

    it('should decorate deconstructed methods', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const {command1: deconstructedCommand1} = instance;
      const decorator1 = mock.fn(function (method, ...args) {
        return method(...args);
      });
      const decorator2 = mock.fn(function (method, ...args) {
        return method(...args);
      });

      instance.addDecorator('command1', decorator1);
      instance.addDecorator('command1', decorator2);

      assert.deepStrictEqual(deconstructedCommand1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.deepStrictEqual(decorator1.mock.calls[0].this, instance);
      assert.deepStrictEqual(decorator2.mock.calls[0].this, instance);
      assert.equal(decorator1.mock.calls[0].arguments.length, 4);
      assert(decorator1.mock.calls[0].arguments[0] instanceof Function);
      assert.deepStrictEqual(decorator1.mock.calls[0].arguments[1], instance.getDependencies());
      assert.deepStrictEqual(decorator1.mock.calls[0].arguments[2], 'a1');
      assert.deepStrictEqual(decorator1.mock.calls[0].arguments[3], 'a2');
      assert.equal(decorator2.mock.calls[0].arguments.length, 4);
      assert(decorator2.mock.calls[0].arguments[0] instanceof Function);
      assert.deepStrictEqual(decorator2.mock.calls[0].arguments[1], instance.getDependencies());
      assert.deepStrictEqual(decorator2.mock.calls[0].arguments[2], 'a1');
      assert.deepStrictEqual(decorator2.mock.calls[0].arguments[3], 'a2');
    });

    it('should be possible to remove a decorator with the returned function', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const decorator1 = mock.fn(function (method, ...args) {
        return method(...args);
      });
      const decorator2 = mock.fn(function (method, ...args) {
        return method(...args);
      });

      const removeDecorator1 = instance.addDecorator('command1', decorator1);

      instance.addDecorator('command1', decorator2);
      removeDecorator1();

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.equal(decorator1.mock.callCount(), 0);
      assert.equal(decorator2.mock.calls[0].arguments.length, 4);
      assert(decorator2.mock.calls[0].arguments[0] instanceof Function);
      assert.deepStrictEqual(decorator2.mock.calls[0].arguments[1], instance.getDependencies());
      assert.deepStrictEqual(decorator2.mock.calls[0].arguments[2], 'a1');
      assert.deepStrictEqual(decorator2.mock.calls[0].arguments[3], 'a2');
    });

    it('should be possible to remove a decorator using removeDecorator method', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const decorator1 = mock.fn(function (method, ...args) {
        return method(...args);
      });
      const decorator2 = mock.fn(function (method, ...args) {
        return method(...args);
      });

      instance.addDecorator('command1', decorator1);
      instance.addDecorator('command1', decorator2);
      instance.removeDecorator('command1', decorator1);

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.equal(decorator1.mock.callCount(), 0);
      assert.equal(decorator2.mock.calls[0].arguments.length, 4);
      assert(decorator2.mock.calls[0].arguments[0] instanceof Function);
      assert.deepStrictEqual(decorator2.mock.calls[0].arguments[1], instance.getDependencies());
      assert.deepStrictEqual(decorator2.mock.calls[0].arguments[2], 'a1');
      assert.deepStrictEqual(decorator2.mock.calls[0].arguments[3], 'a2');
    });

    it('should not do anything if you try to remove a decorator that does not exist', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const decorator1 = mock.fn(function (method, ...args) {
        return method(...args);
      });
      const decorator2 = mock.fn(function (method, ...args) {
        return method(...args);
      });

      instance.addDecorator('command1', decorator1);
      instance.addDecorator('command1', decorator2);
      // @ts-expect-error -- invalid decorator
      instance.removeDecorator('command1', () => {});

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.equal(decorator1.mock.callCount(), 1);
      assert.equal(decorator2.mock.callCount(), 1);
    });

    it('should be possible to hook to a command before it executes', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const preCmd1Hook = mock.fn(function () {
        assert.equal(command1.mock.calls.length, 0);
      });

      instance.addPreHook('command1', preCmd1Hook);

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.equal(preCmd1Hook.mock.callCount(), 1);
      assert.deepStrictEqual(preCmd1Hook.mock.calls[0].this, instance);
      assert.deepStrictEqual(preCmd1Hook.mock.calls[0].arguments, [instance.getDependencies(), 'a1', 'a2']);
    });

    it('should be possible to hook to a command after it executes', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const postCmd1Hook = mock.fn(function () {
        assert.equal(command1.mock.calls.length, 1);
      });

      instance.addPostHook('command1', postCmd1Hook);

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.equal(postCmd1Hook.mock.callCount(), 1);
      assert.deepStrictEqual(postCmd1Hook.mock.calls[0].this, instance);
      assert.deepStrictEqual(postCmd1Hook.mock.calls[0].arguments, [instance.getDependencies(), 'a1', 'a2']);
    });

    it('should be possible to hook to an async command before and after it executes', async () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const preCmd3Hook = mock.fn(function () {
        assert(command3.mock.calls.length === 0);
      });
      const postCmd3Hook = mock.fn(function () {
        assert(command3.mock.calls.length === 1);
      });

      instance.addPreHook('command3', preCmd3Hook);
      instance.addPostHook('command3', postCmd3Hook);

      assert.deepStrictEqual(await instance.command3('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command3.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command3.mock.calls[0].this, instance);
      assert.equal(preCmd3Hook.mock.callCount(), 1);
      assert.deepStrictEqual(preCmd3Hook.mock.calls[0].this, instance);
      assert.deepStrictEqual(preCmd3Hook.mock.calls[0].arguments, [instance.getDependencies(), 'a1', 'a2']);
      assert.equal(postCmd3Hook.mock.callCount(), 1);
      assert.deepStrictEqual(postCmd3Hook.mock.calls[0].this, instance);
      assert.deepStrictEqual(postCmd3Hook.mock.calls[0].arguments, [instance.getDependencies(), 'a1', 'a2']);
    });

    it('should be possible to remove a hook with the returned function', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const preCmd1Hook = mock.fn(function () {
        assert.equal(command1.mock.calls.length, 0);
      });
      const postCmd1Hook = mock.fn(function () {
        assert.equal(command1.mock.calls.length, 1);
      });

      const removePreCmd1Hook = instance.addPreHook('command1', preCmd1Hook);
      const removePostCmd1Hook = instance.addPostHook('command2', postCmd1Hook);

      removePreCmd1Hook();
      removePostCmd1Hook();

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.equal(preCmd1Hook.mock.callCount(), 0);
      assert.equal(postCmd1Hook.mock.callCount(), 0);
    });

    it('should be possible to remove a hook using removeHook method', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const preCmd1Hook = mock.fn(function () {
        assert.equal(command1.mock.calls.length, 0);
      });
      const postCmd1Hook = mock.fn(function () {
        assert.equal(command1.mock.calls.length, 1);
      });

      instance.addPreHook('command1', preCmd1Hook);
      instance.addPostHook('command1', postCmd1Hook);

      instance.removePreHook('command1', preCmd1Hook);
      instance.removePostHook('command1', postCmd1Hook);

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.equal(preCmd1Hook.mock.callCount(), 0);
      assert.equal(postCmd1Hook.mock.callCount(), 0);
    });

    it('should not do anything if you try to remove a hook that does not exist', () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const preCmd1Hook = mock.fn(function () {
        assert.equal(command1.mock.calls.length, 0);
      });
      const postCmd1Hook = mock.fn(function () {
        assert.equal(command1.mock.calls.length, 1);
      });

      instance.addPreHook('command1', preCmd1Hook);
      instance.addPostHook('command1', postCmd1Hook);

      instance.removePreHook('command1', () => {});
      instance.removePostHook('command1', () => {});

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.equal(preCmd1Hook.mock.callCount(), 1);
      assert.equal(postCmd1Hook.mock.callCount(), 1);
    });

    it('should expose inherited methods', () => {
      class TestClass extends DapiMixin(definition, BaseTestClass) {
        testMethod() {
          return 'test';
        }
      }
      const instance = new TestClass();

      assert.strictEqual(instance.testMethod(), 'test');
      assert.strictEqual(instance.baseMethod(), 'base');
    });

    it('should expose inherited properties', () => {
      class TestClass extends DapiMixin(definition, BaseTestClass) {
        testClassProperty = 'testClassProperty';
      }
      const instance = new TestClass();

      assert.strictEqual(instance.testClassProperty, 'testClassProperty');
      assert.strictEqual(instance.type, 'test');
      assert.strictEqual(instance.baseProperty, 'baseProperty');
    });

    it('should expose inherited static methods', () => {
      class TestClass extends DapiMixin(definition, BaseTestClass) {
        static testStaticMethod() {
          return 'testStatic';
        }
      }

      assert.strictEqual(TestClass.testStaticMethod(), 'testStatic');
      assert.strictEqual(TestClass.baseStaticMethod(), 'baseStatic');
    });

    it('should expose inherited static properties', () => {
      class TestClass extends DapiMixin(definition, BaseTestClass) {
        static testProperty = 'test';
      }

      assert.strictEqual(TestClass.testProperty, 'test');
      assert.strictEqual(TestClass.baseStaticProperty, 'baseStaticProperty');
    });

    it('should be possible to decorate all dapi functions at once', async () => {
      const TestClass = DapiMixin(definition, BaseTestClass);
      const instance = new TestClass();
      const decorator = mock.fn(function (method, ...args) {
        return method(...args);
      });

      const removeAllDecorators = instance.decorateAll(decorator);

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command1.mock.calls[0].this, instance);
      assert.equal(decorator.mock.callCount(), 1);

      assert.deepStrictEqual(instance.command2(), undefined);
      assert.deepStrictEqual(command2.mock.calls[0].arguments, [deps]);
      assert.deepStrictEqual(command2.mock.calls[0].this, instance);
      assert.equal(decorator.mock.callCount(), 2);

      assert.deepStrictEqual(await instance.command3('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(command3.mock.calls[0].arguments, [deps, 'a1', 'a2']);
      assert.deepStrictEqual(command3.mock.calls[0].this, instance);
      assert.equal(decorator.mock.callCount(), 3);

      removeAllDecorators();

      assert.deepStrictEqual(instance.command1('a1', 'a2'), ['a1', 'a2']);
      assert.deepStrictEqual(instance.command2(), undefined);
      assert.deepStrictEqual(await instance.command3('a1', 'a2'), ['a1', 'a2']);

      assert.equal(decorator.mock.callCount(), 3);
    });
  });
});
