// From https://github.com/vitest-dev/vitest/blob/a73c1c2ca3a3ca93b317657b9328889434c36344/packages/vitest/src/typecheck/assertType.ts#L3
export interface AssertType {
  <T>(value: T): void;
}

export const assertType: AssertType = () => {};
