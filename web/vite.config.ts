import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");

    return {
        plugins: [react()],
        server: {
            port: Number(env.VITE_PORT) || 4173,
            host: env.VITE_HOST || "0.0.0.0"
        },
        build: {
            outDir: "dist",
            sourcemap: mode !== "production"
        }
    };
});
