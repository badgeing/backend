import { AuditAction, Role } from "@prisma/client";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { fetchDiscordUser, buildOauthRedirect } from "../services/discord.js";
import { upsertUser, ensureRole } from "../services/users.js";
import { writeAuditLog } from "../services/audit.js";

export async function authRoutes(app: FastifyInstance) {
    app.get("/discord/login", async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply.redirect(buildOauthRedirect());
    });

    app.get("/discord/callback", async (request: FastifyRequest, reply: FastifyReply) => {
        const query = request.query as { clientMod?: string; };
        const tokenResponse = await app.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
        
        app.log.info({ tokenResponse: JSON.stringify(tokenResponse) }, "Full token response");
        
        const accessToken = tokenResponse.token?.access_token || tokenResponse.access_token;
        
        if (!accessToken) {
            app.log.error({ tokenResponse }, "No access token found in response");
            return reply.code(500).send({ error: "Failed to obtain access token" });
        }
        
        const discordUser = await fetchDiscordUser(accessToken);
        const isModeratorId = app.config.moderatorIds.includes(discordUser.id);
        const user = await upsertUser(discordUser);

        if (isModeratorId && user.role === Role.USER) {
            await ensureRole(user.id, Role.MODERATOR, true);
            user.role = Role.MODERATOR;
        }

        if (user.bannedUntil && user.bannedUntil > new Date()) {
            return reply.code(403).send({ error: "Banned", until: user.bannedUntil, reason: user.bannedReason });
        }

        const jwt = await reply.jwtSign({ userId: user.id, role: user.role }, { expiresIn: "7d" });
        reply.setCookie("fb_session", jwt, {
            httpOnly: true,
            sameSite: "lax",
            secure: app.config.cookieSecure,
            path: "/"
        });

        await writeAuditLog({
            actorId: user.id,
            action: AuditAction.LOGIN,
            metadata: { type: "oauth_login" }
        });

        const payload = { success: true, user, token: jwt };

        if (query?.clientMod === "kzcord") {
            return reply.send(payload);
        }

        if (app.config.WEB_DASHBOARD_URL) {
            return reply.redirect(app.config.WEB_DASHBOARD_URL);
        }

        return reply.send(payload);
    });

    app.post("/logout", { preHandler: requireAuth }, async (_request: FastifyRequest, reply: FastifyReply) => {
        reply.clearCookie("fb_session", { path: "/", secure: app.config.cookieSecure, httpOnly: true, sameSite: "lax" });
        return { success: true };
    });
}

