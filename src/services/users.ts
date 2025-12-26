import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface DiscordUser {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
}

export async function upsertUser(payload: DiscordUser) {
    const user = await prisma.user.upsert({
        where: { id: payload.id },
        update: {
            username: payload.username,
            globalName: payload.global_name ?? null,
            avatar: payload.avatar ?? null
        },
        create: {
            id: payload.id,
            username: payload.username,
            globalName: payload.global_name ?? null,
            avatar: payload.avatar ?? null,
            role: Role.USER
        }
    });

    return user;
}

export async function ensureRole(userId: string, fallbackRole: Role, isModeratorId: boolean) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    if (isModeratorId && user.role === Role.USER) {
        return prisma.user.update({ where: { id: userId }, data: { role: fallbackRole } });
    }

    return user;
}
