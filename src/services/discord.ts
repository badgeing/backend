import { config } from "../config.js";

const DISCORD_API = "https://discord.com/api/v10";

export async function fetchDiscordUser(accessToken: string) {
    if (!accessToken) {
        throw new Error('No access token provided');
    }
    
    const response = await fetch(`${DISCORD_API}/users/@me`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Discord API responded with ${response.status}: ${text}`);
    }

    return response.json() as Promise<{
        id: string;
        username: string;
        global_name?: string | null;
        avatar?: string | null;
    }>;
}

export function buildOauthRedirect(state?: string) {
    const url = new URL("https://discord.com/api/oauth2/authorize");
    url.searchParams.set("client_id", config.DISCORD_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify");
    url.searchParams.set("redirect_uri", config.DISCORD_REDIRECT_URI);
    if (state) url.searchParams.set("state", state);
    return url.toString();
}
