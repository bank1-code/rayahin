/**
 * Settings Router - إعدادات النظام
 * أقسام، مواقع، موظفين، أنواع استبعاد
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  departments,
  locations,
  employees,
  exclusionTypes,
} from "../../drizzle/schema";
import { logAuditAction } from "../security";
import { TRPCError } from "@trpc/server";

// =============================================
// الأقسام
// =============================================
const departmentsRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
    return db.select().from(departments).orderBy(departments.name);
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255).transform(s => s.trim()).refine(s => s.length > 0, { message: "الاسم مطلوب" }) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(departments).values({ name: input.name });
      const insertId = Number(result[0].insertId);
      await logAuditAction({
        tableName: "departments",
        recordId: insertId,
        actionType: "CREATE",
        actionDescription: `إضافة قسم: ${input.name}`,
        newData: { name: input.name },
        performedBy: ctx.user.id,
        performedByName: ctx.user.name || undefined,
        ipAddress: ctx.req.ip || undefined,
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      return { id: insertId, name: input.name };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(255) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [old] = await db.select().from(departments).where(eq(departments.id, input.id)).limit(1);
      await db.update(departments).set({ name: input.name }).where(eq(departments.id, input.id));
      await logAuditAction({
        tableName: "departments",
        recordId: input.id,
        actionType: "UPDATE",
        actionDescription: `تعديل قسم: ${old?.name} → ${input.name}`,
        oldData: old,
        newData: { name: input.name },
        changedFields: ["name"],
        performedBy: ctx.user.id,
        performedByName: ctx.user.name || undefined,
        ipAddress: ctx.req.ip || undefined,
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [old] = await db.select().from(departments).where(eq(departments.id, input.id)).limit(1);
      await db.delete(departments).where(eq(departments.id, input.id));
      await logAuditAction({
        tableName: "departments",
        recordId: input.id,
        actionType: "DELETE",
        actionDescription: `حذف قسم: ${old?.name}`,
        oldData: old,
        performedBy: ctx.user.id,
        performedByName: ctx.user.name || undefined,
        ipAddress: ctx.req.ip || undefined,
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      return { success: true };
    }),
});

// =============================================
// المواقع
// =============================================
const locationsRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(locations).orderBy(locations.name);
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255).transform(s => s.trim()).refine(s => s.length > 0, { message: "الاسم مطلوب" }) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(locations).values({ name: input.name });
      const insertId = Number(result[0].insertId);
      await logAuditAction({
        tableName: "locations",
        recordId: insertId,
        actionType: "CREATE",
        actionDescription: `إضافة موقع: ${input.name}`,
        newData: { name: input.name },
        performedBy: ctx.user.id,
        performedByName: ctx.user.name || undefined,
        ipAddress: ctx.req.ip || undefined,
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      return { id: insertId, name: input.name };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(255) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [old] = await db.select().from(locations).where(eq(locations.id, input.id)).limit(1);
      await db.update(locations).set({ name: input.name }).where(eq(locations.id, input.id));
      await logAuditAction({
        tableName: "locations",
        recordId: input.id,
        actionType: "UPDATE",
        actionDescription: `تعديل موقع: ${old?.name} → ${input.name}`,
        oldData: old,
        newData: { name: input.name },
        changedFields: ["name"],
        performedBy: ctx.user.id,
        performedByName: ctx.user.name || undefined,
        ipAddress: ctx.req.ip || undefined,
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [old] = await db.select().from(locations).where(eq(locations.id, input.id)).limit(1);
      await db.delete(locations).where(eq(locations.id, input.id));
      await logAuditAction({
        tableName: "locations",
        recordId: input.id,
        actionType: "DELETE",
        actionDescription: `حذف موقع: ${old?.name}`,
        oldData: old,
        performedBy: ctx.user.id,
        performedByName: ctx.user.name || undefined,
        ipAddress: ctx.req.ip || undefined,
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      return { success: true };
    }),
});

// =============================================
// الموظفين
// =============================================
const employeesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(employees).orderBy(employees.fullName);
  }),

  create: protectedProcedure
    .input(z.object({
      fullName: z.string().min(1).max(255),
      fingerprintId: z.string().max(100).optional().nullable(),
      nationalId: z.string().max(100).optional().nullable(),
      phone: z.string().max(50).optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(employees).values({
        fullName: input.fullName,
        fingerprintId: input.fingerprintId || null,
        nationalId: input.nationalId || null,
        phone: input.phone || null,
      });
      const insertId = Number(result[0].insertId);
      await logAuditAction({
        tableName: "employees",
        recordId: insertId,
        actionType: "CREATE",
        actionDescription: `إضافة موظف: ${input.fullName}`,
        newData: input,
        performedBy: ctx.user.id,
        performedByName: ctx.user.name || undefined,
        ipAddress: ctx.req.ip || undefined,
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      return { id: insertId, ...input };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      fullName: z.string().min(1).max(255),
      fingerprintId: z.string().max(100).optional().nullable(),
      nationalId: z.string().max(100).optional().nullable(),
      phone: z.string().max(50).optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [old] = await db.select().from(employees).where(eq(employees.id, input.id)).limit(1);
      await db.update(employees).set({
        fullName: input.fullName,
        fingerprintId: input.fingerprintId || null,
        nationalId: input.nationalId || null,
        phone: input.phone || null,
      }).where(eq(employees.id, input.id));
      // تحديد الحقول المتغيرة
      const changedFields: string[] = [];
      if (old?.fullName !== input.fullName) changedFields.push('fullName');
      if (old?.fingerprintId !== (input.fingerprintId || null)) changedFields.push('fingerprintId');
      if (old?.nationalId !== (input.nationalId || null)) changedFields.push('nationalId');
      if (old?.phone !== (input.phone || null)) changedFields.push('phone');

      await logAuditAction({
        tableName: "employees",
        recordId: input.id,
        actionType: "UPDATE",
        actionDescription: `تعديل موظف: ${old?.fullName} - تغيير ${changedFields.length} حقل`,
        oldData: old,
        newData: input,
        changedFields,
        performedBy: ctx.user.id,
        performedByName: ctx.user.name || undefined,
        ipAddress: ctx.req.ip || undefined,
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [old] = await db.select().from(employees).where(eq(employees.id, input.id)).limit(1);
      await db.delete(employees).where(eq(employees.id, input.id));
      await logAuditAction({
        tableName: "employees",
        recordId: input.id,
        actionType: "DELETE",
        actionDescription: `حذف موظف: ${old?.fullName}`,
        oldData: old,
        performedBy: ctx.user.id,
        performedByName: ctx.user.name || undefined,
        ipAddress: ctx.req.ip || undefined,
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      return { success: true };
    }),
});

// =============================================
// أنواع الاستبعاد
// =============================================
const exclusionTypesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(exclusionTypes).orderBy(exclusionTypes.name);
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(exclusionTypes).values({ name: input.name });
      const insertId = Number(result[0].insertId);
      await logAuditAction({
        tableName: "exclusion_types",
        recordId: insertId,
        actionType: "CREATE",
        actionDescription: `إضافة نوع استبعاد: ${input.name}`,
        newData: { name: input.name },
        performedBy: ctx.user.id,
        performedByName: ctx.user.name || undefined,
        ipAddress: ctx.req.ip || undefined,
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      return { id: insertId, name: input.name };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [old] = await db.select().from(exclusionTypes).where(eq(exclusionTypes.id, input.id)).limit(1);
      await db.delete(exclusionTypes).where(eq(exclusionTypes.id, input.id));
      await logAuditAction({
        tableName: "exclusion_types",
        recordId: input.id,
        actionType: "DELETE",
        actionDescription: `حذف نوع استبعاد: ${old?.name}`,
        oldData: old,
        performedBy: ctx.user.id,
        performedByName: ctx.user.name || undefined,
        ipAddress: ctx.req.ip || undefined,
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      return { success: true };
    }),
});

// =============================================
// تجميع الإعدادات
// =============================================
export const settingsRouter = router({
  departments: departmentsRouter,
  locations: locationsRouter,
  employees: employeesRouter,
  exclusionTypes: exclusionTypesRouter,
});
