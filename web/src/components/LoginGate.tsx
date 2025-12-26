import { useMemo } from "react";

interface LoginGateProps {
    backendUrl: string;
    onLogin(session: any): void;
}

export function LoginGate({ backendUrl }: LoginGateProps) {
    const oauthUrl = useMemo(() => `${backendUrl}/auth/discord/login`, [backendUrl]);

    return (
        <div className="gate">
            <h2>Moderator Sign-In</h2>
            <p>You must log in with an approved Discord account.</p>
            <a className="btn" href={oauthUrl}>Sign in with Discord</a>
        </div>
    );
}
