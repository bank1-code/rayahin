import { z } from "zod";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { logAuditAction, clearBruteForceBlock } from "../security";
import bcrypt from "bcryptjs";

export const localAuthRouter = router({
  // ==========================================
  // تسجيل الدخول بكلمة المرور
  // ==========================================
  login: publicProcedure
    .input(z.object({
      username: z.string().min(1, "اسم المستخدم مطلوب"),
      password: z.string().min(1, "كلمة المرور مطلوبة"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متوفرة");

      // البحث عن المستخدم
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      if (!user || !user.passwordHash) {
        throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
      }

      // التحقق من كلمة المرور
      const isValid = await bcrypt.compare(input.password, user.passwordHash);
      if (!isValid) {
        throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
      }

      // تحديث آخر تسجيل دخول
      await db.update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      // تسجيل خروج من الجلسة القديمة (إن وجدت)
      ctx.res.clearCookie(COOKIE_NAME, getSessionCookieOptions(ctx.req));

      // إنشاء جلسة JWT
      // استخدم username بدلاً من openId للمستخدمين المحليين
      const identifier = user.username || user.openId;
      const token = await sdk.createSessionToken(identifier, {
        name: user.name || user.username || "مستخدم",
      });

      // تعيين الكوكي
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      // مسح حظر القوة الغاشمة عند تسجيل دخول ناجح
      clearBruteForceBlock(ctx.req?.ip || "unknown");

      // تسجيل في سجل التدقيق
      await logAuditAction({
        tableName: "users",
        actionType: "LOGIN",
        actionDescription: `تسجيل دخول: ${user.username}`,
        performedBy: user.id,
        performedByName: user.name || user.username || "مستخدم",
        ipAddress: ctx.req?.ip || "unknown",
      });

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        },
      };
    }),

  // ==========================================
  // إدارة المستخدمين (سوبر أدمن فقط)
  // ==========================================
  listUsers: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متوفرة");

    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.loginMethod, "local"));

    return allUsers;
  }),

  createUser: adminProcedure
    .input(z.object({
      username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"),
      password: z.string().min(4, "كلمة المرور يجب أن تكون 4 أحرف على الأقل"),
      name: z.string().min(1, "الاسم مطلوب"),
      role: z.enum(["user", "admin"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متوفرة");

      // التحقق من عدم تكرار اسم المستخدم
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      if (existing) {
        throw new Error("اسم المستخدم موجود مسبقاً");
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      const openId = `local_${input.username}_${Date.now()}`;

      await db.insert(users).values({
        openId,
        username: input.username,
        passwordHash,
        name: input.name,
        role: input.role,
        loginMethod: "local",
        lastSignedIn: new Date(),
      });

      await logAuditAction({
        tableName: "users",
        actionType: "CREATE",
        actionDescription: `إنشاء مستخدم جديد: ${input.username} (${input.role})`,
        performedBy: ctx.user?.id,
        performedByName: ctx.user?.name || "مدير",
        ipAddress: ctx.req?.ip || "unknown",
      });

      return { success: true };
    }),

  updateUser: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      role: z.enum(["user", "admin"]).optional(),
      password: z.string().min(4).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متوفرة");

      const updateData: Record<string, unknown> = {};
      if (input.name) updateData.name = input.name;
      if (input.role) updateData.role = input.role;
      if (input.password) {
        updateData.passwordHash = await bcrypt.hash(input.password, 10);
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error("لا توجد بيانات للتحديث");
      }

      await db.update(users).set(updateData).where(eq(users.id, input.id));

      await logAuditAction({
        tableName: "users",
        actionType: "UPDATE",
        actionDescription: `تعديل مستخدم #${input.id}`,
        performedBy: ctx.user?.id,
        performedByName: ctx.user?.name || "مدير",
        ipAddress: ctx.req?.ip || "unknown",
      });

      return { success: true };
    }),

  deleteUser: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متوفرة");

      // لا يمكن حذف المستخدم الحالي
      if (ctx.user?.id === input.id) {
        throw new Error("لا يمكنك حذف حسابك الخاص");
      }

      await db.delete(users).where(eq(users.id, input.id));

      await logAuditAction({
        tableName: "users",
        actionType: "DELETE",
        actionDescription: `حذف مستخدم #${input.id}`,
        performedBy: ctx.user?.id,
        performedByName: ctx.user?.name || "مدير",
        ipAddress: ctx.req?.ip || "unknown",
      });

      return { success: true };
    }),
});
