import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { BadgeStatus } from "@prisma/client";
import { z } from "zod";
import { requireModerator } from "../middleware/auth.js";
import { readPendingFile, deletePendingFile } from "../services/pendingStore.js";
import { uploadBadgeAsset, deleteBadgeAsset } from "../lib/r2.js";
import { writeAuditLog } from "../services/audit.js";

const updateStatusSchema = z.object({
    status: z.nativeEnum(BadgeStatus),
    reason: z.string().max(200).optional()
});

const banSchema = z.object({
    userId: z.string(),
    reason: z.string().min(3).max(200),
    durationHours: z.number().int().min(0).max(24 * 30).optional()
});

const unbanSchema = z.object({
    userId: z.string()
});

function contentTypeFromKey(key: string) {
    const ext = key.split(".").pop()?.toLowerCase();
    switch (ext) {
        case "png": return "image/png";
        case "jpg":
        case "jpeg": return "image/jpeg";
        case "webp": return "image/webp";
        default: return "application/octet-stream";
    }
}

export async function moderationRoutes(app: FastifyInstance) {
    app.get("/queue", { preHandler: requireModerator }, async () => {
        const pending = await app.prisma.badge.findMany({
            where: { status: BadgeStatus.PENDING },
            include: { creator: true },
            orderBy: { createdAt: "asc" }
        });
        return { badges: pending };
    });

    app.post("/badges/:id/status", { preHandler: requireModerator }, async (request: FastifyRequest, reply: FastifyReply) => {
        const badgeId = (request.params as { id: string }).id;
        const body = updateStatusSchema.parse(request.body);

        const badge = await app.prisma.badge.findUnique({ where: { id: badgeId } });
        if (!badge) {
            reply.code(404);
            return { error: "Badge not found" };
        }

        let iconUrl = badge.iconUrl;
        let pendingKey = badge.pendingKey;

        if (body.status === BadgeStatus.APPROVED) {
            if (!badge.pendingKey) {
                reply.code(400);
                return { error: "Badge has no pending upload" };
            }

            const file = await readPendingFile(badge.pendingKey);
            const extension = badge.pendingKey.includes(".") ? badge.pendingKey.slice(badge.pendingKey.lastIndexOf(".")) : "";
            const r2Key = `badges/${badge.id}${extension}`;
            iconUrl = await uploadBadgeAsset(app.config, r2Key, file, contentTypeFromKey(badge.pendingKey));
            pendingKey = null;
            await deletePendingFile(badge.pendingKey);
        }

        if (body.status !== BadgeStatus.APPROVED && badge.pendingKey && body.status !== BadgeStatus.PENDING) {
            await deletePendingFile(badge.pendingKey);
            pendingKey = null;
        }

        const updated = await app.prisma.badge.update({
            where: { id: badgeId },
            data: {
                status: body.status,
                reviewReason: body.reason,
                reviewerId: request.session!.userId,
                iconUrl,
                pendingKey
            }
        });

        await writeAuditLog({
            badgeId,
            actorId: request.session!.userId,
            action: body.status === BadgeStatus.APPROVED ? "APPROVED" : "REJECTED",
            metadata: { reason: body.reason }
        });

        return { badge: updated };
    });

    app.post("/bans", { preHandler: requireModerator }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = banSchema.parse(request.body);
        const user = await app.prisma.user.findUnique({ where: { id: body.userId } });
        if (!user) {
            reply.code(404);
            return { error: "User not found" };
        }

        const bannedUntil = body.durationHours && body.durationHours > 0
            ? new Date(Date.now() + body.durationHours * 60 * 60 * 1000)
            : null;

        const updated = await app.prisma.user.update({
            where: { id: body.userId },
            data: {
                bannedUntil,
                bannedReason: body.reason
            }
        });

        await writeAuditLog({
            actorId: request.session!.userId,
            action: "BANNED",
            metadata: { target: body.userId, reason: body.reason, durationHours: body.durationHours }
        });

        return { user: updated };
    });

    app.delete("/badges/:id", { preHandler: requireModerator }, async (request: FastifyRequest, reply: FastifyReply) => {
        const badgeId = (request.params as { id: string }).id;
        const badge = await app.prisma.badge.findUnique({ where: { id: badgeId } });
        
        if (!badge) {
            reply.code(404);
            return { error: "Badge not found" };
        }

        if (badge.iconUrl && badge.iconUrl.startsWith("https://")) {
            try {
                const urlPath = badge.iconUrl.split("/").pop();
                if (urlPath) {
                    const r2Key = `badges/${urlPath}`;
                    const { deleteBadgeAsset } = await import("../lib/r2.js");
                    await deleteBadgeAsset(app.config, r2Key);
                }
            } catch (e) {
                app.log.warn({ error: e }, "Failed to delete badge asset from R2");
            }
        }

        if (badge.pendingKey) {
            await deletePendingFile(badge.pendingKey);
        }

        await app.prisma.badge.delete({ where: { id: badgeId } });

        await writeAuditLog({
            badgeId,
            actorId: request.session!.userId,
            action: "DELETED",
            metadata: {}
        });

        return { success: true };
    });

    app.post("/unbans", { preHandler: requireModerator }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = unbanSchema.parse(request.body);
        const user = await app.prisma.user.findUnique({ where: { id: body.userId } });
        
        if (!user) {
            reply.code(404);
            return { error: "User not found" };
        }

        const updated = await app.prisma.user.update({
            where: { id: body.userId },
            data: {
                bannedUntil: null,
                bannedReason: null
            }
        });

        await writeAuditLog({
            actorId: request.session!.userId,
            action: "UNBANNED",
            metadata: { target: body.userId }
        });

        return { user: updated };
    });

    app.get("/badges", { preHandler: requireModerator }, async () => {
        const badges = await app.prisma.badge.findMany({
            include: {
                creator: true,
                reviewer: true
            },
            orderBy: { createdAt: "desc" }
        });
        return { badges };
    });
}

