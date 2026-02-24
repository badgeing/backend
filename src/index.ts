import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import fastifyJwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import fastifyOauth2 from "@fastify/oauth2";
import fastifyPlugin from "fastify-plugin";

import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { authRoutes } from "./routes/auth.js";
import { badgeRoutes } from "./routes/badges.js";
import { moderationRoutes } from "./routes/moderation.js";
import { sessionRoutes } from "./routes/session.js";

const app = Fastify({
    logger: true
});

await app.register(cors, {
    origin: (origin, cb) => {
        if (!origin || origin === "null" || config.corsOrigins.includes(origin) || origin === "https://discord.com") {
            return cb(null, true);
        }
        cb(new Error("Origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"]
});

await app.register(cookie, { secret: config.SESSION_SECRET });
await app.register(formbody);
await app.register(multipart, { limits: { fileSize: 1_000_000 } });
await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    hook: "preHandler"
});
await app.register(fastifyJwt, { secret: config.JWT_SECRET, cookie: { cookieName: "fb_session", signed: false } });

await app.register(fastifyPlugin(async instance => {
    instance.decorate("prisma", prisma);
    instance.decorate("config", config);
}));

await app.register(fastifyOauth2, {
    name: "discordOAuth2",
    credentials: {
        client: {
            id: config.DISCORD_CLIENT_ID,
            secret: config.DISCORD_CLIENT_SECRET
        },
        auth: fastifyOauth2.DISCORD_CONFIGURATION
    },
    startRedirectPath: "/auth/discord",
    callbackUri: config.DISCORD_REDIRECT_URI,
    scope: ["identify"],
    generateStateFunction: () => "nostate",
    checkStateFunction: () => true
});

app.decorateRequest("session", null);
app.decorateRequest("currentUser", null);

app.addHook("preHandler", async request => {
    try {
        const payload = await request.jwtVerify() as any;
        if (payload && typeof payload === 'object' && 'userId' in payload) {
            request.session = payload as { userId: string; role: string; };
            const user = await prisma.user.findUnique({ where: { id: payload.userId as string } });
            if (user) request.currentUser = user;
        }
    } catch (_) {
        // unauthenticated; ignore
    }
});

await app.register(authRoutes, { prefix: "/auth" });
await app.register(sessionRoutes, { prefix: "/auth" });
await app.register(badgeRoutes, { prefix: "/badges" });
await app.register(moderationRoutes, { prefix: "/moderation" });

app.log.info("All routes registered");

const shutdown = async () => {
    app.log.info("Shutting down FreeBadges backend");
    await prisma.$disconnect();
    await app.close();
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen({ host: config.HOST, port: config.PORT })
    .then(address => app.log.info(`FreeBadges backend listening on ${address}`))
    .catch(err => {
        app.log.error(err);
        process.exit(1);
    });

declare module "fastify" {
    interface FastifyInstance {
        config: typeof config;
        prisma: typeof prisma;
        discordOAuth2: any;
    }

    interface FastifyRequest {
        session?: { userId: string; role: string; } | null;
        currentUser?: import("@prisma/client").User | null;
    }
}

