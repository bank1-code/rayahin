import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";

const mocked = vi.hoisted(() => ({ getDb: vi.fn(), where: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocked.getDb }));
import { localAuthRouter } from "./routers/localAuth";

function context(role: "owner" | "admin" | "accountant"): TrpcContext {
  return {
    user: { id: 1, role },
    req: { headers: {} },
    res: {},
  } as TrpcContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.where.mockResolvedValue([]);
  mocked.getDb.mockResolvedValue({
    select: () => ({ from: () => ({ leftJoin: () => ({ where: mocked.where }) }) }),
  });
});

describe("localAuth.listUsers visibility", () => {
  it("excludes owner accounts in the database query for an admin", async () => {
    await localAuthRouter.createCaller(context("admin")).listUsers();
    const query = new MySqlDialect().sqlToQuery(mocked.where.mock.calls[0][0] as SQL);
    expect(query.sql).toContain("`users`.`role` <> ?");
    expect(query.params).toEqual(["local", "owner"]);
  });

  it("keeps owner accounts visible to an owner", async () => {
    await localAuthRouter.createCaller(context("owner")).listUsers();
    const query = new MySqlDialect().sqlToQuery(mocked.where.mock.calls[0][0] as SQL);
    expect(query.sql).not.toContain("`users`.`role`");
    expect(query.params).toEqual(["local"]);
  });

  it("rejects a role without user-management permission before reading the database", async () => {
    await expect(localAuthRouter.createCaller(context("accountant")).listUsers())
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocked.getDb).not.toHaveBeenCalled();
  });
});
