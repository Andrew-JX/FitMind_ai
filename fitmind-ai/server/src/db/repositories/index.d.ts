export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export declare function findUserByEmail(email: string): Promise<UserRow | null>;
export declare function findUserById(userId: string): Promise<UserRow | null>;
export declare function createUser(input: {
  email: string;
  passwordHash: string;
  displayName?: string | null | undefined;
}): Promise<UserRow>;
