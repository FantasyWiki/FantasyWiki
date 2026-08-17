/**
 * A repository that behaves exactly like `base` except for the methods given.
 * Lets a test force one write to fail — or to lose its race and change nothing —
 * while every other call still reaches the real store.
 *
 * A spread would not do: repository methods live on the prototype, so
 * `{ ...instance }` copies none of them.
 */
export function withOverrides<T extends object>(
  base: T,
  overrides: Partial<T>,
): T {
  return new Proxy(base, {
    get(target, property, receiver) {
      if (property in overrides) {
        return overrides[property as keyof T];
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
