import { useEffect, useState } from "react";
import { LoginGate } from "./LoginGate";
import { ModerationPanel } from "./ModerationPanel";
import type { SessionResponse } from "../types";

interface DashboardShellProps {
    backendUrl?: string;
}

export function DashboardShell({ backendUrl }: DashboardShellProps) {
    const [session, setSession] = useState<SessionResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!backendUrl) return;
        const controller = new AbortController();
        const fetchSession = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${backendUrl}/auth/session`, {
                    credentials: "include",
                    signal: controller.signal
                });
                if (!res.ok) throw new Error("Not authenticated");
                const data = await res.json();
                setSession(data);
            } catch {
                setSession(null);
            } finally {
                setLoading(false);
            }
        };
        fetchSession();
        return () => controller.abort();
    }, [backendUrl]);

    if (!backendUrl) {
        return <div className="container">Set `VITE_BACKEND_URL` in the dashboard env.</div>;
    }

    if (loading) {
        return <div className="container">Checking session…</div>;
    }

    if (!session?.user) {
        return <LoginGate backendUrl={backendUrl} onLogin={setSession} />;
    }

    if (session.user.role !== "MODERATOR" && session.user.role !== "ADMIN") {
        return (
            <div className="container">
                <header className="header">
                    <div>
                        <h1>FreeBadges Moderation</h1>
                        <p>Access Denied</p>
                    </div>
                    <button className="btn" onClick={async () => {
                        await fetch(`${backendUrl}/auth/logout`, { method: "POST", credentials: "include" });
                        setSession(null);
                    }}>Logout</button>
                </header>
                <div style={{ padding: "2rem" }}>
                    <p>You do not have permission to access this moderation dashboard.</p>
                    <p>Only moderators and admins can access this area.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <header className="header">
                <div>
                    <h1>FreeBadges cool dash</h1>
                    <p>Signed in as {session.user.username} ({session.user.role})</p>
                </div>
                <button className="btn" onClick={async () => {
                    await fetch(`${backendUrl}/auth/logout`, { method: "POST", credentials: "include" });
                    setSession(null);
                }}>Logout</button>
            </header>
            <ModerationPanel backendUrl={backendUrl} session={session} />
        </div>
    );
}
