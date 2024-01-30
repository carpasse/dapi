/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Extract the intersecting Keys from two Objects.
 * Right Object is the source of truth.
 */
export type ExtractKeys<T, O> = Extract<keyof T, keyof O>;

// From https://stackoverflow.com/questions/71462888/how-to-remove-keys-of-type-never
/*
 * Extracts the keys of an object that are not of type never
 */
type FilteredKeys<T> = {
  [K in keyof T]: T[K] extends never ? never : K;
}[keyof T];

/**
 * Returns a new Type where all the keys of type T are not of type never.
 */
export type RemoveNever<T> = {
  [K in FilteredKeys<T>]: T[K];
};

/**
 * Returns a new Type where Two Objects recursively intersect.
 * Right Object is the source of truth.
 */
export type SubSet<T, Obj> = RemoveNever<
  ExtractKeys<T, Obj> extends never
    ? never
    : {
        [Key in ExtractKeys<T, Obj>]: Obj[Key] extends object
          ? Obj[Key] extends object[]
            ? number extends keyof Obj[Key] & keyof T[Key]
              ? SubSet<T[Key][number], Obj[Key][number]>[]
              : never
            : SubSet<T[Key], Obj[Key]>
          : Obj[Key] | undefined extends T[Key]
          ? Obj[Key] | undefined
          : Obj[Key] extends T[Key]
          ? Obj[Key]
          : never;
      }
>;

// From https://github.com/microsoft/TypeScript/pull/13743
/**
 * Matches any constructor
 */
export type Constructor<T> = new (...args: any[]) => T;

/**
 * Matches any function
 */
export type AnyFunction = (...args: any[]) => any;

/**
 * Matches any array
 */
export type AnyArgs = any[];

/**
 * Returns a new Type where all the keys of T are partial except the specified keys K union type.
 */
export declare type PartialPick<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Returns a new Type that extracts from the beginning of a Tuple of type TUPLE all the elements that match the specified type EXTRACTED in the beginning.
 */
export type TupleExtract<TUPLE extends AnyArgs, EXTRACTED extends AnyArgs = []> = TUPLE extends [
  ...EXTRACTED,
  ...infer REMAINING
]
  ? REMAINING
  : never;

/**
 * Returns a new Type that returns the params from the passed function F extracting from the params tuple those that match EXTRACTED in the beginning.
 */
export type ParamsExtract<F extends AnyFunction, EXTRACTED extends AnyArgs = []> = TupleExtract<
  Parameters<F>,
  EXTRACTED
>;

/**
 * Returns a new Type union with all the keys of type T that have values of type V.
 */
export type KeysWithValuesOfType<T, V> = {[K in keyof T]-?: T[K] extends V ? K : never}[keyof T];

/** Represents a no operation function */
export type NoOp = (...args: unknown[]) => void;
