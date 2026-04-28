import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/repositories/index.js", () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
}));

vi.mock("./password.js", () => ({
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("./jwt.js", () => ({
  signJwt: vi.fn(),
}));

import {
  createUser,
  findUserByEmail,
  findUserById,
} from "../../db/repositories/index.js";
import { getCurrentUser, login, register } from "./auth-service.js";
import { signJwt } from "./jwt.js";
import { comparePassword, hashPassword } from "./password.js";

const mockedCreateUser = vi.mocked(createUser);
const mockedFindUserByEmail = vi.mocked(findUserByEmail);
const mockedFindUserById = vi.mocked(findUserById);
const mockedHashPassword = vi.mocked(hashPassword);
const mockedComparePassword = vi.mocked(comparePassword);
const mockedSignJwt = vi.mocked(signJwt);

const userRow = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "user@example.com",
  passwordHash: "stored-hash",
  displayName: "Andrew",
  createdAt: "2026-04-28T00:00:00.000Z",
  updatedAt: "2026-04-28T00:00:00.000Z",
};

describe("auth-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a user and returns a signed token", async () => {
    mockedFindUserByEmail.mockResolvedValueOnce(null);
    mockedHashPassword.mockResolvedValueOnce("hashed-password");
    mockedCreateUser.mockResolvedValueOnce(userRow);
    mockedSignJwt.mockResolvedValueOnce("signed-token");

    const result = await register({
      email: "user@example.com",
      password: "password123",
      display_name: "Andrew",
    });

    expect(result).toEqual({
      user: {
        id: userRow.id,
        email: userRow.email,
        display_name: "Andrew",
      },
      token: "signed-token",
    });
  });

  it("rejects duplicate registration emails", async () => {
    mockedFindUserByEmail.mockResolvedValueOnce(userRow);

    await expect(
      register({
        email: "user@example.com",
        password: "password123",
        display_name: "Andrew",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects login when the password is invalid", async () => {
    mockedFindUserByEmail.mockResolvedValueOnce(userRow);
    mockedComparePassword.mockResolvedValueOnce(false);

    await expect(
      login({
        email: "user@example.com",
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("rejects current-user lookup when the user no longer exists", async () => {
    mockedFindUserById.mockResolvedValueOnce(null);

    await expect(
      getCurrentUser("11111111-1111-4111-8111-111111111111"),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });
});
