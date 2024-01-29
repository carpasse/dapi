import {describe, it, mock, beforeEach, Mock} from 'node:test';
import assert from 'node:assert/strict';
import EventEmitter from 'node:events';
import {createDapi} from '../createDapi';
import {DapiDefinition} from '../DapiMixin';

describe('createApi', () => {
  type Deps = {
    foo: string;
  };
  type DapiFnsDict = {
    command1: (deps: Deps, a1: string, a2: string) => [typeof a1, typeof a2];
  };
  let deps: Deps;
  let fns: DapiFnsDict;
  let command1: Mock<(deps: Deps, a1: string, a2: string) => [typeof a1, typeof a2]>;
  let definition: DapiDefinition<Deps, DapiFnsDict>;

  beforeEach(() => {
    deps = {foo: 'bar'};
    command1 = mock.fn((_deps, a1, a2) => [a1, a2]);
    fns = {
      command1
    };
    definition = {dependencies: deps, fns, type: 'test'};
  });

  it('should create an api', () => {
    const api = createDapi(definition);

    assert.equal(typeof api.command1, 'function');
  });

  it('should call the command', () => {
    const api = createDapi(definition);

    api.command1('a1', 'a2');

    assert.equal(command1.mock.calls.length, 1);
    assert.deepEqual(command1.mock.calls[0].arguments, [api.getDependencies(), 'a1', 'a2']);
  });

  it('should be possible to pass a super class', () => {
    const api = createDapi(definition, EventEmitter);

    assert(api instanceof EventEmitter);
  });

  it('should be possible to decorate a command', () => {
    const api = createDapi(definition, EventEmitter);
    const spy = mock.fn();

    api.on('command1', spy);
    api.addDecorator('command1', function (this: typeof api, next, ...args) {
      // eslint-disable-next-line no-invalid-this
      this.emit('command1', ...args);

      return next(...args);
    });

    api.command1('a1', 'a2');

    assert.equal(spy.mock.calls.length, 1);
    assert.deepEqual(spy.mock.calls[0].arguments, [api.getDependencies(), 'a1', 'a2']);
    assert.equal(command1.mock.calls.length, 1);
    assert.deepEqual(command1.mock.calls[0].arguments, [api.getDependencies(), 'a1', 'a2']);
  });
});
