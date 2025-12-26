import { FastifyReply, FastifyRequest } from "fastify";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    if (!request.session?.userId) {
        reply.code(401).send({ error: "Unauthorized" });
        return reply;
    }
}

export async function requireModerator(request: FastifyRequest, reply: FastifyReply) {
    const isModerator = request.currentUser?.role === "MODERATOR" || request.currentUser?.role === "ADMIN";
    const isWhitelisted = request.server.config.moderatorIds.includes(request.session?.userId ?? "");

    if (!isModerator && !isWhitelisted) {
        reply.code(403).send({ error: "Forbidden" });
        return reply;
    }
}
