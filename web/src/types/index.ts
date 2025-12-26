export interface User {
    id: string;
    username: string;
    avatar?: string | null;
    role: string;
}

export interface BadgeWithCreator {
    id: string;
    name: string;
    pendingKey?: string | null;
    creator: User;
    createdAt: string;
}

export interface SessionResponse {
    user: User;
    session: {
        userId: string;
        role: string;
    };
}
