import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  departments,
  locations,
  employees,
  assets,
  custodyItems,
  exclusionTypes,
  assetTransfers,
  assetExclusions,
  clearanceRecords,
  archiveDocuments,
  auditLog,
} from "../../drizzle/schema";
import { logAuditAction } from "../security";
import { storagePut } from "../storage";
import { desc, sql } from "drizzle-orm";

export const backupRouter = router({
  // ==========================================
  // إنشاء نسخة احتياطية
  // ==========================================
  create: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متوفرة");

    const [
      deptData,
      locData,
      empData,
      assetData,
      custodyData,
      exclusionTypeData,
      transferData,
      assetExclusionData,
      clearanceData,
      archiveData,
    ] = await Promise.all([
      db.select().from(departments),
      db.select().from(locations),
      db.select().from(employees),
      db.select().from(assets),
      db.select().from(custodyItems),
      db.select().from(exclusionTypes),
      db.select().from(assetTransfers),
      db.select().from(assetExclusions),
      db.select().from(clearanceRecords),
      db.select().from(archiveDocuments),
    ]);

    const backupData = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      createdBy: ctx.user?.name || "مستخدم",
      tables: {
        departments: deptData,
        locations: locData,
        employees: empData,
        assets: assetData,
        custodyItems: custodyData,
        exclusionTypes: exclusionTypeData,
        assetTransfers: transferData,
        assetExclusions: assetExclusionData,
        clearanceRecords: clearanceData,
        archiveDocuments: archiveData,
      },
      stats: {
        departments: deptData.length,
        locations: locData.length,
        employees: empData.length,
        assets: assetData.length,
        custodyItems: custodyData.length,
        exclusionTypes: exclusionTypeData.length,
        assetTransfers: transferData.length,
        assetExclusions: assetExclusionData.length,
        clearanceRecords: clearanceData.length,
        archiveDocuments: archiveData.length,
      },
    };

    // تشفير المحتوى بـ Base64 لمنع القراءة المباشرة
    const jsonStr = JSON.stringify(backupData);
    const encodedContent = Buffer.from(jsonStr, "utf-8").toString("base64");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `backup-${timestamp}.tln`;
    const fileKey = `backups/${fileName}`;

    const { url } = await storagePut(fileKey, encodedContent, "application/octet-stream");

    await logAuditAction({
      tableName: "backup",
      actionType: "CREATE",
      actionDescription: `إنشاء نسخة احتياطية: ${fileName}`,
      newData: {
        fileName,
        fileKey,
        url,
        stats: backupData.stats,
      },
      performedBy: ctx.user?.id,
      performedByName: ctx.user?.name || "مستخدم",
      ipAddress: ctx.req?.ip || "unknown",
    });

    const totalRecords = Object.values(backupData.stats).reduce((a, b) => a + b, 0);

    return {
      success: true,
      fileName,
      url,
      stats: backupData.stats,
      totalRecords,
      createdAt: backupData.createdAt,
    };
  }),

  // ==========================================
  // استعادة نسخة احتياطية
  // ==========================================
  restore: protectedProcedure
    .input(z.object({ base64Data: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متوفرة");

      let backupData: any;
      try {
        // محاولة فك تشفير Base64 أولاً (ملفات .tln)
        // ثم التحويل المباشر للملفات القديمة .json
        let rawContent = Buffer.from(input.base64Data, "base64").toString("utf-8");
        
        // إذا كان المحتوى مشفراً بـ Base64 (ملفات .tln)
        // سيكون rawContent هو نفسه المحتوى Base64 المشفر
        // نحاول فك التشفير مرة ثانية إذا كان JSON غير صالح
        let jsonStr: string;
        try {
          // محاولة parse مباشرة (ملفات .json القديمة)
          JSON.parse(rawContent);
          jsonStr = rawContent;
        } catch {
          // إذا فشل الـ parse فهو محتوى Base64 مشفر (.tln)
          jsonStr = Buffer.from(rawContent, "base64").toString("utf-8");
        }
        backupData = JSON.parse(jsonStr);
      } catch {
        throw new Error("الملف غير صالح. يرجى اختيار ملف نسخة احتياطية صحيح (.tln)");
      }

      if (!backupData.version || !backupData.tables) {
        throw new Error("تنسيق النسخة الاحتياطية غير صحيح");
      }

      const tables = backupData.tables;
      let restored = 0;
      const errors: string[] = [];

      try {
        // حذف البيانات القديمة بالترتيب الصحيح (العلاقات أولاً)
        await db.delete(archiveDocuments);
        await db.delete(clearanceRecords);
        await db.delete(assetExclusions);
        await db.delete(assetTransfers);
        await db.delete(custodyItems);
        await db.delete(assets);
        await db.delete(employees);
        await db.delete(exclusionTypes);
        await db.delete(locations);
        await db.delete(departments);

        // إعادة إدخال البيانات
        if (tables.departments?.length > 0) {
          for (const row of tables.departments) {
            await db.insert(departments).values({ id: row.id, name: row.name });
            restored++;
          }
        }

        if (tables.locations?.length > 0) {
          for (const row of tables.locations) {
            await db.insert(locations).values({ id: row.id, name: row.name });
            restored++;
          }
        }

        if (tables.exclusionTypes?.length > 0) {
          for (const row of tables.exclusionTypes) {
            await db.insert(exclusionTypes).values({
              id: row.id,
              name: row.name,
            });
            restored++;
          }
        }

        if (tables.employees?.length > 0) {
          for (const row of tables.employees) {
            await db.insert(employees).values({
              id: row.id,
              fullName: row.fullName,
              fingerprintId: row.fingerprintId || null,
              nationalId: row.nationalId || null,
              phone: row.phone || null,
            });
            restored++;
          }
        }

        if (tables.assets?.length > 0) {
          for (const row of tables.assets) {
            try {
              await db.insert(assets).values({
                id: row.id,
                assetName: row.assetName,
                assetCode: row.assetCode || null,
                quantity: row.quantity || 1,
                assetValue: row.assetValue || "0",
                condition: row.condition || null,
                assignedTo: row.assignedTo || null,
                departmentId: row.departmentId || null,
                locationId: row.locationId || null,
                status: row.status || "ACTIVE",
                notes: row.notes || null,
                assetImagePath: row.assetImagePath || null,
                invoiceImagePath: row.invoiceImagePath || null,
              });
              restored++;
            } catch (e: any) {
              errors.push(`أصل #${row.id}: ${e.message}`);
            }
          }
        }

        if (tables.custodyItems?.length > 0) {
          for (const row of tables.custodyItems) {
            try {
              await db.insert(custodyItems).values({
                id: row.id,
                name: row.name,
                code: row.code || null,
                quantity: row.quantity || 1,
                assetValue: row.assetValue || "0",
                condition: row.condition || null,
                assignedTo: row.assignedTo || null,
                departmentId: row.departmentId || null,
                locationId: row.locationId || null,
                status: row.status || "ACTIVE",
                notes: row.notes || null,
                assetImagePath: row.assetImagePath || null,
                invoiceImagePath: row.invoiceImagePath || null,
              });
              restored++;
            } catch (e: any) {
              errors.push(`عهدة #${row.id}: ${e.message}`);
            }
          }
        }

        if (tables.assetTransfers?.length > 0) {
          for (const row of tables.assetTransfers) {
            try {
              await db.insert(assetTransfers).values({
                id: row.id,
                entityType: row.entityType,
                entityId: row.entityId,
                movementType: row.movementType,
                fromEmployeeId: row.fromEmployeeId || null,
                toEmployeeId: row.toEmployeeId || null,
                fromDepartment: row.fromDepartment || null,
                toDepartment: row.toDepartment || null,
                fromLocation: row.fromLocation || null,
                toLocation: row.toLocation || null,
                quantity: row.quantity || 1,
                assetValue: row.assetValue || null,
                notes: row.notes || null,
                transferredBy: row.transferredBy || null,
                transferredAt: row.transferredAt ? new Date(row.transferredAt) : new Date(),
              });
              restored++;
            } catch (e: any) {
              errors.push(`نقل #${row.id}: ${e.message}`);
            }
          }
        }

        if (tables.assetExclusions?.length > 0) {
          for (const row of tables.assetExclusions) {
            try {
              await db.insert(assetExclusions).values({
                id: row.id,
                entityType: row.entityType,
                entityId: row.entityId,
                exclusionCode: row.exclusionCode,
                exclusionMode: row.exclusionMode || "full",
                exclusionTypeId: row.exclusionTypeId || null,
                reason: row.reason,
                quantityBefore: row.quantityBefore || null,
                quantityExcluded: row.quantityExcluded || 1,
                quantityRemaining: row.quantityRemaining || null,
                oldEmployeeName: row.oldEmployeeName || null,
                oldDepartmentName: row.oldDepartmentName || null,
                oldLocationName: row.oldLocationName || null,
                responsibleData: row.responsibleData || null,
                exclusionImages: row.exclusionImages || null,
                reportPath: row.reportPath || null,
                excludedBy: row.excludedBy || null,
                exclusionDate: row.exclusionDate ? new Date(row.exclusionDate) : new Date(),
              });
              restored++;
            } catch (e: any) {
              errors.push(`استبعاد #${row.id}: ${e.message}`);
            }
          }
        }

        if (tables.clearanceRecords?.length > 0) {
          for (const row of tables.clearanceRecords) {
            try {
              await db.insert(clearanceRecords).values({
                id: row.id,
                clearanceCode: row.clearanceCode,
                employeeId: row.employeeId,
                employeeName: row.employeeName,
                fingerprintId: row.fingerprintId || null,
                reason: row.reason || null,
                lastWorkDay: row.lastWorkDay || null,
                htmlFilePath: row.htmlFilePath || null,
                status: row.status || "ACTIVE",
                replacementData: row.replacementData || null,
                createdBy: row.createdBy || null,
              });
              restored++;
            } catch (e: any) {
              errors.push(`براءة ذمة #${row.id}: ${e.message}`);
            }
          }
        }

        if (tables.archiveDocuments?.length > 0) {
          for (const row of tables.archiveDocuments) {
            try {
              await db.insert(archiveDocuments).values({
                id: row.id,
                entityType: row.entityType,
                operationType: row.operationType,
                assetId: row.assetId || null,
                custodyId: row.custodyId || null,
                transferId: row.transferId || null,
                documentTitle: row.documentTitle,
                fileName: row.fileName,
                filePath: row.filePath || null,
                notes: row.notes || null,
                createdBy: row.createdBy || null,
              });
              restored++;
            } catch (e: any) {
              errors.push(`أرشيف #${row.id}: ${e.message}`);
            }
          }
        }
      } catch (e: any) {
        throw new Error(`فشل في استعادة النسخة الاحتياطية: ${e.message}`);
      }

      await logAuditAction({
        tableName: "backup",
        actionType: "RESTORE",
        actionDescription: `استعادة نسخة احتياطية: ${restored} سجل تم استعادته`,
        newData: { restored, errors: errors.length },
        performedBy: ctx.user?.id,
        performedByName: ctx.user?.name || "مستخدم",
        ipAddress: ctx.req?.ip || "unknown",
      });

      return { success: true, restored, errors };
    }),

  // ==========================================
  // عرض النسخ الاحتياطية السابقة
  // ==========================================
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متوفرة");

    const backups = await db
      .select()
      .from(auditLog)
      .where(
        sql`${auditLog.tableName} = 'backup' AND ${auditLog.actionType} = 'CREATE'`
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(20);

    return backups.map((b) => {
      const newData = b.newData as any;
      return {
        id: b.id,
        fileName: newData?.fileName || "نسخة احتياطية",
        url: newData?.url || null,
        stats: newData?.stats || {},
        totalRecords: newData?.stats
          ? Object.values(newData.stats as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
          : 0,
        createdBy: b.performedByName || "مستخدم",
        createdAt: b.createdAt,
      };
    });
  }),
});
