// Ambient types for bun:test — kept hand-rolled to avoid pulling in
// @types/bun (which would expand the typecheck surface to the whole
// runtime). Extend this file when a new helper is needed in tests.

declare module "bun:test" {
  type AnyFn = (...args: any[]) => any;
  type AnyRecord = Record<string, unknown>;

  interface TestHandle {
    (name: string, fn: () => void | Promise<void>): void;
  }

  interface DescribeHandle {
    (name: string, fn: () => void): void;
  }

  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toContainEqual(expected: unknown): void;
    toMatch(expected: string | RegExp): void;
    toMatchObject(expected: AnyRecord): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    not: Matchers;
  }

  interface Expect {
    <T>(actual: T): Matchers;
  }

  export const test: TestHandle;
  export const describe: DescribeHandle;
  export const expect: Expect;
}