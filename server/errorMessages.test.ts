import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { TRPCError } from "@trpc/server";
import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { DEFAULT_ERROR_MESSAGE, getUserErrorMessage } from "../shared/errorMessages";
import type { TrpcContext } from "./_core/context";

describe("user-facing error messages", () => {
  it("keeps Arabic validation and business instructions", () => {
    const message = "لا يمكن حذف القسم لأنه مرتبط بأصول مسجلة. انقل الأصول أولًا.";
    expect(getUserErrorMessage(new Error(message))).toBe(message);
    expect(getUserErrorMessage({ message: "اختر صورة أو PDF حتى 10 ميجابايت" }))
      .toBe("اختر صورة أو PDF حتى 10 ميجابايت");
  });

  it.each([
    "Failed query: select passwordHash from users params: anem2031,1",
    "صف 2: Failed query: insert into assets values (?) params: أصل عربي",
    "فشل الحفظ: ER_DUP_ENTRY بيانات الموظف",
    "تعذر القراءة: C:\\server\\private.ts",
    '[{"message":"اسم المستخدم مطلوب","code":"invalid_type"}]',
    "Cannot read properties of undefined (reading 'id')",
  ])("hides technical details: %s", message => {
    expect(getUserErrorMessage(new Error(message))).toBe(DEFAULT_ERROR_MESSAGE);
  });

  it("explains network failures and permission failures in Arabic", () => {
    expect(getUserErrorMessage(new TypeError("Failed to fetch"))).toContain("تحقق من اتصال الإنترنت");
    expect(getUserErrorMessage({ data: { code: "FORBIDDEN" }, message: "FORBIDDEN" }))
      .toBe("ليس لديك صلاحية لتنفيذ هذه العملية.");
    expect(getUserErrorMessage({ name: "AbortError" })).toContain("استغرقت العملية وقتًا طويلًا");
  });

  it("uses a contextual fallback without exposing an unsafe fallback", () => {
    expect(getUserErrorMessage(new Error("Upload failed"), "تعذر رفع المستند"))
      .toBe("تعذر رفع المستند");
    expect(getUserErrorMessage(undefined, "Internal error"))
      .toBe(DEFAULT_ERROR_MESSAGE);
  });
});

const validationMessage = "الكمية يجب أن تكون أكبر من صفر";
const businessMessage = "لا يمكن حذف السجل لأنه مرتبط بحركة نقل";
const apiRouter = router({
  databaseFailure: publicProcedure.query(() => {
    throw new Error("Failed query: select passwordHash from users params: anem2031,1");
  }),
  businessFailure: publicProcedure.query(() => {
    throw new TRPCError({ code: "CONFLICT", message: businessMessage });
  }),
  missingRecord: publicProcedure.query(() => {
    throw new TRPCError({ code: "NOT_FOUND" });
  }),
  validate: publicProcedure.input(z.object({ quantity: z.number().min(1, validationMessage) }))
    .mutation(() => ({ success: true })),
});

describe("API error responses", () => {
  let server: ReturnType<ReturnType<typeof express>["listen"]>;
  let client: ReturnType<typeof createTRPCProxyClient<typeof apiRouter>>;
  let log: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    log = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = express();
    app.use("/api/trpc", createExpressMiddleware({
      router: apiRouter,
      createContext: ({ req, res }) => ({ user: null, req, res } as TrpcContext),
    }));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address() as { port: number };
    client = createTRPCProxyClient<typeof apiRouter>({ links: [httpBatchLink({
      url: `http://127.0.0.1:${address.port}/api/trpc`, transformer: superjson,
    })] });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    log.mockRestore();
  });

  it("returns an Arabic message without SQL or stack, and logs the underlying error", async () => {
    try {
      await client.databaseFailure.query();
      expect.fail("Expected a database error");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCClientError);
      const response = error as TRPCClientError<typeof apiRouter>;
      expect(response.message).toBe(DEFAULT_ERROR_MESSAGE);
      expect(response.data?.stack).toBeUndefined();
      expect(log).toHaveBeenCalledWith("[API Error]", "databaseFailure", expect.any(TRPCError));
    }
  });

  it("preserves a business restriction and translates an unspecified missing-record error", async () => {
    await expect(client.businessFailure.query()).rejects.toMatchObject({ message: businessMessage });
    await expect(client.missingRecord.query()).rejects.toMatchObject({
      message: "السجل المطلوب غير موجود أو لم يعد متاحًا.",
    });
  });

  it("returns a useful Arabic validation message instead of a Zod JSON dump", async () => {
    await expect(client.validate.mutate({ quantity: 0 })).rejects.toMatchObject({ message: validationMessage });
    await expect(client.validate.mutate({ quantity: "invalid" } as unknown as { quantity: number }))
      .rejects.toMatchObject({ message: getUserErrorMessage({ code: "BAD_REQUEST" }) });
  });
});
