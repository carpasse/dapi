/* eslint-disable id-length, max-classes-per-file */
import {describe, it} from 'node:test';
import {
  AnyFunction,
  KeysWithValuesOfType,
  Constructor,
  AnyArgs,
  ExtractKeys,
  SubSet,
  PartialPick,
  TupleExtract,
  ParamsExtract,
  RemoveNever
} from '../types/utils';
import {assertType} from '../types/assertType';

describe('utils', () => {
  describe('ExtractKeys', () => {
    it('should extract the keys of an object that match the keys of another object', () => {
      const obj = {
        a: 1,
        b: '2',
        c: 3,
        d: () => {},
        e: '4',
        f: {},
        g: () => {}
      };

      assertType<ExtractKeys<typeof obj, {a: number; b: string; m: string}>>('a');
      assertType<ExtractKeys<typeof obj, {a: number; b: string; c: number}>>('b');
      // @ts-expect-error - 'm' is not a key of obj
      assertType<ExtractKeys<typeof obj, {a: number; b: string; c: number}>>('m');
    });
  });

  describe('SubSet', () => {
    it('should return a subset of the passed object', () => {
      const obj = {
        a: 1,
        b: '2',
        c: 3,
        d: () => {},
        e: '4',
        f: {},
        g: () => {}
      };

      assertType<SubSet<typeof obj, {a: number; b: string; m: string}>>({a: 1, b: '2'});
      assertType<SubSet<typeof obj, {a: number; b: string; c: number}>>({a: 1, b: '2', c: 3});
      // @ts-expect-error - 'm' is not a key of obj
      assertType<SubSet<typeof obj, {a: number; b: string; c: number}>>({a: 1, b: '2', m: '3'});
    });

    it('should work with complex objects', () => {
      const obj = {
        a: {
          b: 1,
          c: '2',
          d: {
            e: 1,
            f: '2'
          }
        }
      };

      type match = {
        a: {
          b: number;
          d: {
            e: number;
          };
        };
        h: string;
      };

      assertType<SubSet<typeof obj, match>>({
        a: {b: 1, d: {e: 1}}
      });
      assertType<SubSet<{h: string}, match>>({
        h: '1'
      });

      // @ts-expect-error - 'm' is not a key of obj
      assertType<SubSet<typeof obj, match>>({a: {b: 1, d: {e: 1}}, m: '2'});

      // @ts-expect-error - 'm' is not a key of obj
      assertType<SubSet<typeof obj, match>>({a: {b: 1, d: {e: 1, m: '2'}}});
    });

    it('should work with index signatures', () => {
      const obj = {
        a: 1,
        b: '2'
      };

      type match = {
        [key: string]: number;
      };

      assertType<SubSet<typeof obj, match>>({a: 1});
      // @ts-expect-error - 'm' is not a key of obj
      assertType<SubSet<typeof obj, match>>({a: 1, m: 3});
    });
  });

  describe('Constructor', () => {
    it('should match any constructor', () => {
      class TestClass {
        a: number;
        b: string;

        constructor(a: number, b: string) {
          this.a = a;
          this.b = b;
        }
      }

      assertType<Constructor<TestClass>>(TestClass);
      assertType<Constructor<{}>>(TestClass);
    });
  });

  describe('AnyFunction', () => {
    it('should match any function', () => {
      assertType<AnyFunction>(() => {});
      assertType<AnyFunction>(function () {});
      assertType<AnyFunction>(function named() {});
      assertType<AnyFunction>(async () => {});
      assertType<AnyFunction>(async function () {});
      assertType<AnyFunction>(async function named() {});
      assertType<AnyFunction>(function* () {});
      assertType<AnyFunction>(function* named() {});
    });
  });

  describe('AnyArgs', () => {
    it('should match any array', () => {
      assertType<AnyArgs>([]);
      assertType<AnyArgs>([1, '2', {}]);
    });
  });

  describe('KeysWithValuesOfType', () => {
    it('should return the keys of an object with values of the specified type', () => {
      const obj = {
        a: 1,
        b: '2',
        c: 3,
        d: () => {},
        e: '4',
        f: {},
        g: () => {}
      };

      assertType<KeysWithValuesOfType<typeof obj, string>[]>(['b', 'e']);
      assertType<KeysWithValuesOfType<typeof obj, number>[]>(['a', 'c']);
      assertType<KeysWithValuesOfType<typeof obj, Function>[]>(['d', 'g']);
      assertType<KeysWithValuesOfType<typeof obj, AnyFunction>[]>(['d', 'g']);
      assertType<KeysWithValuesOfType<typeof obj, object>[]>(['f']);
      // @ts-expect-error - 'm' is not a key of obj
      assertType<KeysWithValuesOfType<typeof obj, string>[]>(['b', 'e', 'm']);
    });

    it('should also work with generic classes', () => {
      class TestClass {
        a: number;
        b: string;
        c: number;
        d: AnyFunction;
        e: string;
        f: object;
        g: AnyFunction;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor() {
          this.a = 1;
          this.b = '2';
          this.c = 3;
          this.d = () => {};
          this.e = '4';
          this.f = {};
          this.g = () => {};
        }
      }

      const instance = new TestClass();

      assertType<KeysWithValuesOfType<typeof instance, string>[]>(['b', 'e']);
      assertType<KeysWithValuesOfType<typeof instance, number>[]>(['a', 'c']);
      assertType<KeysWithValuesOfType<typeof instance, Function>[]>(['d', 'g']);
      assertType<KeysWithValuesOfType<typeof instance, AnyFunction>[]>(['d', 'g']);
      assertType<KeysWithValuesOfType<typeof instance, object>[]>(['f']);
    });
  });

  describe('PartialPick', () => {
    it('should return a new Type where all the keys of T are partial except the specified keys K union type', () => {
      const obj = {
        a: 1,
        b: '2',
        c: 3
      };

      assertType<PartialPick<typeof obj, 'a' | 'b'>>({a: 1, b: '2'});
      assertType<PartialPick<typeof obj, 'a' | 'b'>>({a: 1, b: '2', c: 3});
      // @ts-expect-error - 'a' and 'b' are not partial
      assertType<PartialPick<typeof obj, 'a' | 'c'>>({c: 3});
    });
  });

  describe('TupleExtract', () => {
    it('should return a new Type that extracts from the beginning of a Tuple of type TUPLE all the elements that match the specified type EXTRACTED in the beginning', () => {
      assertType<TupleExtract<[1, 2, 3, 4], [1, 2]>>([3, 4]);
      assertType<TupleExtract<[1, 2, 3, 4], [1, 2, 3]>>([4]);
      assertType<TupleExtract<[1, 2, 3, 4], [1, 2, 3, 4]>>([]);
      // @ts-expect-error - match tuple can not be extracted from the beginning of the first tuple
      assertType<TupleExtract<[1, 2, 3, 4], [1, 2, 3, 4, 5]>>([]);
      assertType<TupleExtract<[1], [1]>>([]);
    });
  });

  describe('ParamsExtract', () => {
    it('should return a new Type that returns the params from the passed function F extracting from the params tuple those that match EXTRACTED in the beginning', () => {
      const fn = (a: number, b: string, c: boolean) => {};

      type fnType = typeof fn;

      assertType<ParamsExtract<fnType, [number]>>(['b', true]);
      // @ts-expect-error - 'c' is not a boolean not a number
      assertType<ParamsExtract<fnType, [number, string]>>([1]);
      // @ts-expect-error - match tuple can not be extracted from the beginning of the params tuple
      assertType<ParamsExtract<fnType, [number, string, boolean, number, string, boolean]>>([]);
      // @ts-expect-error - first param is not a boolean
      assertType<ParamsExtract<fnType, [boolean]>>([1, '2']);
    });

    it('should work with functions of only one param', () => {
      const fn = (a: number) => {};

      type fnType = typeof fn;

      assertType<ParamsExtract<fnType, [number]>>([]);
    });
  });

  describe('RemoveNever', () => {
    it('should remove never values from an object signature', () => {
      type obj = {
        a: 1;
        b: 2;
        c: never;
        d: never;
      };
      assertType<RemoveNever<obj>>({a: 1, b: 2});
      // @ts-expect-error - 'c' is not a key of the object after removing never values
      assertType<RemoveNever<obj>>({a: 1, b: 2, c: 3});
    });
  });
});
