export type Modify<T, R extends { [K in keyof T]?: any }> = Omit<T, keyof R> & R;

export type NonNull<T, K extends keyof T = keyof T> = Omit<T, K> & {
  [P in K]: NonNullable<T[P]>;
};
