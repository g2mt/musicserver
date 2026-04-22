export type KeysOfUnion<T> = T extends T ? keyof T : never;
export type OptionalUnion<T> = T | { [K in KeysOfUnion<T>]?: never };

export function shuffled<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
