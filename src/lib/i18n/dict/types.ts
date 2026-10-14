/** A translation of an English area file: every key present, extra plural forms allowed. */
export type Tr<T> = Record<keyof T, string> & Record<string, string>;
