import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

interface AuditLogInput {
    badgeId?: string;
    actorId?: string;
    action: AuditAction;
    metadata?: Prisma.InputJsonValue;
}

export async function writeAuditLog(entry: AuditLogInput) {
    await prisma.auditLog.create({ data: entry });
}
