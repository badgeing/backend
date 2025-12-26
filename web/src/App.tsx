import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";
import { DashboardShell } from "./components/DashboardShell";

const queryClient = new QueryClient();

export default function App() {
    const backendUrl = useMemo(() => import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, ""), []);

    return (
        <QueryClientProvider client={queryClient}>
            <DashboardShell backendUrl={backendUrl} />
        </QueryClientProvider>
    );
}
