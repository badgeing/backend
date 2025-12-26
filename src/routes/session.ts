import { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";

export async function sessionRoutes(app: FastifyInstance) {
    app.get("/session", { preHandler: requireAuth }, async request => {
        return {
            user: request.currentUser,
            session: request.session
        };
    });
}
