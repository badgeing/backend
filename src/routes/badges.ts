import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { BadgeStatus } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { writeAuditLog } from "../services/audit.js";
import { savePendingFile } from "../services/pendingStore.js";
import { createEtag } from "../utils/hash.js";

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const MIME_TYPES: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
};

const FILE_SIGNATURES: Record<string, number[]> = {
    ".png": [0x89, 0x50, 0x4e, 0x47], // PNG
    ".jpg": [0xff, 0xd8, 0xff], // JPEG
    ".jpeg": [0xff, 0xd8, 0xff], // JPEG
    ".webp": [0x52, 0x49, 0x46, 0x46] // RIFF
};

const submitSchema = z.object({
    name: z.string().min(3).max(32)
});

function parseExt(filename?: string) {
    if (!filename || !filename.includes(".")) return ".png";
    return `.${filename.split(".").pop()}`;
}

function validateFileType(buffer: Buffer, ext: string): boolean {
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return false;
    }

    const signature = FILE_SIGNATURES[ext];
    if (!signature) {
        return false;
    }

    for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
            return false;
        }
    }

    if (ext === ".webp") {
        const webpCheck = buffer.slice(8, 12).toString("ascii");
        if (webpCheck !== "WEBP") {
            return false;
        }
    }

    return true;
}

export async function badgeRoutes(app: FastifyInstance) {
    app.get("/approved", async (request: FastifyRequest, reply: FastifyReply) => {
        const approved = await app.prisma.badge.findMany({
            where: { status: BadgeStatus.APPROVED },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                name: true,
                iconUrl: true,
                creatorId: true,
                createdAt: true,
                updatedAt: true
            }
        });

        const payload = approved.map(badge => ({
            id: badge.id,
            name: badge.name,
            iconUrl: badge.iconUrl,
            creatorId: badge.creatorId,
            createdAt: badge.createdAt,
            updatedAt: badge.updatedAt
        }));

        const etag = createEtag(payload.map(b => `${b.id}:${b.updatedAt.toISOString()}`));
        const previous = request.headers["if-none-match"];
        if (previous && previous === etag) {
            reply.code(304);
            return reply.send();
        }

        reply.header("ETag", etag);
        reply.header("Access-Control-Allow-Origin", "*");
        reply.header("Access-Control-Allow-Methods", "GET");
        return { badges: payload };
    });

    app.get("/mine", { preHandler: requireAuth }, async (request: FastifyRequest) => {
        const badges = await app.prisma.badge.findMany({
            where: { creatorId: request.session!.userId },
            orderBy: { createdAt: "desc" }
        });
        return { badges };
    });

    app.post("/submit", { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
        const parts = request.parts();
        let metadata: z.infer<typeof submitSchema> | null = null;
        let iconBuffer: Buffer | null = null;
        let iconExt = ".png";

        for await (const part of parts) {
            if (part.type === "file") {
                const chunks: Buffer[] = [];
                for await (const chunk of part.file) {
                    chunks.push(chunk);
                }
                iconBuffer = Buffer.concat(chunks);
                iconExt = parseExt(part.filename);
            } else if (part.type === "field" && part.fieldname === "metadata") {
                metadata = submitSchema.parse(JSON.parse(part.value as string));
            }
        }

        if (!metadata || !iconBuffer) {
            reply.code(400);
            return { error: "Missing metadata or icon file" };
        }

        if (!validateFileType(iconBuffer, iconExt)) {
            reply.code(400);
            return { error: `Invalid file type.` };
        }

        if (iconBuffer.length > 512 * 1024) {
            reply.code(400);
            return { error: "Icon too large" };
        }

        const now = new Date();
        const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const count = await app.prisma.badge.count({
            where: {
                creatorId: request.session!.userId,
                createdAt: { gte: windowStart }
            }
        });

        if (count >= app.config.DAILY_SUBMISSION_LIMIT) {
            reply.code(429);
            return { error: "Daily submission limit reached" };
        }

        const pendingFile = await savePendingFile(iconBuffer, iconExt);

        const badge = await app.prisma.badge.create({
            data: {
                name: metadata.name,
                creatorId: request.session!.userId,
                pendingKey: pendingFile.key,
                status: BadgeStatus.PENDING
            }
        });

        await writeAuditLog({
            badgeId: badge.id,
            actorId: request.session!.userId,
            action: "SUBMITTED"
        });

        return { success: true, badge };
    });
}
