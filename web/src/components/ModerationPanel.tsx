import { useEffect, useState } from "react";
import type { SessionResponse } from "../types";

interface Badge {
    id: string;
    name: string;
    iconUrl: string;
    status: string;
    creatorId: string;
    creator?: { username: string; bannedUntil?: string; bannedReason?: string };
    createdAt: string;
    reviewReason?: string;
}

interface ModerationPanelProps {
    backendUrl: string;
    session: SessionResponse;
}

export function ModerationPanel({ backendUrl, session }: ModerationPanelProps) {
    const [badges, setBadges] = useState<Badge[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
    const [actionReason, setActionReason] = useState("");
    const [banDialogOpen, setBanDialogOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [banReason, setBanReason] = useState("");
    const [banDuration, setBanDuration] = useState(24);

    useEffect(() => {
        fetchBadges();
    }, []);

    const fetchBadges = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${backendUrl}/moderation/badges`, {
                credentials: "include"
            });
            if (!res.ok) throw new Error("Failed to fetch badges");
            const data = await res.json();
            setBadges(data.badges || []);
        } catch (err) {
            console.error("Error fetching badges:", err);
        } finally {
            setLoading(false);
        }
    };

    const approveBadge = async (badgeId: string) => {
        try {
            const res = await fetch(`${backendUrl}/moderation/badges/${badgeId}/status`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "APPROVED" })
            });
            if (!res.ok) throw new Error("Failed to approve badge");
            await fetchBadges();
        } catch (err) {
            console.error("Error approving badge:", err);
        }
    };

    const rejectBadge = async (badgeId: string) => {
        try {
            const res = await fetch(`${backendUrl}/moderation/badges/${badgeId}/status`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "REJECTED", reason: actionReason })
            });
            if (!res.ok) throw new Error("Failed to reject badge");
            setActionReason("");
            setSelectedBadgeId(null);
            await fetchBadges();
        } catch (err) {
            console.error("Error rejecting badge:", err);
        }
    };

    const deleteBadge = async (badgeId: string) => {
        if (!confirm("Are you sure you want to delete this badge?")) return;
        try {
            const res = await fetch(`${backendUrl}/moderation/badges/${badgeId}`, {
                method: "DELETE",
                credentials: "include"
            });
            if (!res.ok) throw new Error("Failed to delete badge");
            await fetchBadges();
        } catch (err) {
            console.error("Error deleting badge:", err);
        }
    };

    const banUser = async (userId: string) => {
        try {
            const res = await fetch(`${backendUrl}/moderation/bans`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    reason: banReason,
                    durationHours: banDuration
                })
            });
            if (!res.ok) throw new Error("Failed to ban user");
            setBanReason("");
            setBanDuration(24);
            setBanDialogOpen(false);
            setSelectedUserId(null);
            await fetchBadges();
        } catch (err) {
            console.error("Error banning user:", err);
        }
    };

    const unbanUser = async (userId: string) => {
        if (!confirm("Are you sure you want to unban this user?")) return;
        try {
            const res = await fetch(`${backendUrl}/moderation/unbans`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId })
            });
            if (!res.ok) throw new Error("Failed to unban user");
            await fetchBadges();
        } catch (err) {
            console.error("Error unbanning user:", err);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "APPROVED":
                return "#10b981";
            case "REJECTED":
                return "#ef4444";
            case "PENDING":
                return "#f59e0b";
            default:
                return "#6b7280";
        }
    };

    return (
        <div style={{ marginTop: "2rem" }}>
            <h2>Moderation Panel - Badge History</h2>
            {loading && <p>Loading badges...</p>}
            {!loading && badges.length === 0 && <p>No badges found</p>}
            {!loading && badges.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #ddd" }}>
                                <th style={{ textAlign: "left", padding: "0.5rem" }}>Badge</th>
                                <th style={{ textAlign: "left", padding: "0.5rem" }}>Creator</th>
                                <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
                                <th style={{ textAlign: "left", padding: "0.5rem" }}>Created</th>
                                <th style={{ textAlign: "left", padding: "0.5rem" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {badges.map(badge => (
                                <tr key={badge.id} style={{ borderBottom: "1px solid #eee" }}>
                                    <td style={{ padding: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <img
                                            src={badge.iconUrl}
                                            alt={badge.name}
                                            style={{ width: "32px", height: "32px", borderRadius: "4px" }}
                                            onError={e => {
                                                (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect fill='%23ddd' width='32' height='32'/%3E%3C/svg%3E";
                                            }}
                                        />
                                        <span>{badge.name}</span>
                                    </td>
                                    <td style={{ padding: "0.5rem" }}>{badge.creator?.username || "Unknown"}</td>
                                    <td style={{ padding: "0.5rem" }}>
                                        <span style={{ color: getStatusColor(badge.status), fontWeight: "bold" }}>
                                            {badge.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: "0.5rem" }}>
                                        {new Date(badge.createdAt).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                        {badge.status === "PENDING" && (
                                            <>
                                                <button
                                                    className="btn"
                                                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem", backgroundColor: "#10b981" }}
                                                    onClick={() => approveBadge(badge.id)}
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    className="btn"
                                                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem", backgroundColor: "#ef4444" }}
                                                    onClick={() => setSelectedBadgeId(badge.id)}
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    className="btn"
                                                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem", backgroundColor: "#8b5cf6" }}
                                                    onClick={() => {
                                                        setSelectedUserId(badge.creatorId);
                                                        setBanDialogOpen(true);
                                                    }}
                                                >
                                                    Ban User
                                                </button>
                                            </>
                                        )}
                                        {badge.status !== "PENDING" && (
                                            <button
                                                className="btn"
                                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem", backgroundColor: "#6b7280" }}
                                                onClick={() => deleteBadge(badge.id)}
                                            >
                                                Delete
                                            </button>
                                        )}
                                        {badge.creator?.bannedUntil && new Date(badge.creator.bannedUntil) > new Date() && (
                                            <button
                                                className="btn"
                                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem", backgroundColor: "#06b6d4" }}
                                                onClick={() => unbanUser(badge.creatorId)}
                                            >
                                                Unban
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedBadgeId && (
                <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f3f4f6", borderRadius: "4px" }}>
                    <h3>Reject Badge</h3>
                    <textarea
                        value={actionReason}
                        onChange={e => setActionReason(e.target.value)}
                        placeholder="Rejection reason (optional)"
                        style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
                        rows={3}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                            className="btn"
                            style={{ backgroundColor: "#ef4444" }}
                            onClick={() => rejectBadge(selectedBadgeId)}
                        >
                            Confirm Rejection
                        </button>
                        <button
                            className="btn"
                            style={{ backgroundColor: "#6b7280" }}
                            onClick={() => {
                                setSelectedBadgeId(null);
                                setActionReason("");
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {banDialogOpen && selectedUserId && (
                <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f3f4f6", borderRadius: "4px" }}>
                    <h3>Ban User</h3>
                    <div style={{ marginBottom: "0.5rem" }}>
                        <label style={{ display: "block", marginBottom: "0.25rem" }}>Duration (hours)</label>
                        <input
                            type="number"
                            value={banDuration}
                            onChange={e => setBanDuration(Number(e.target.value))}
                            min={1}
                            style={{ width: "100%", padding: "0.5rem" }}
                        />
                    </div>
                    <div style={{ marginBottom: "0.5rem" }}>
                        <label style={{ display: "block", marginBottom: "0.25rem" }}>Reason</label>
                        <textarea
                            value={banReason}
                            onChange={e => setBanReason(e.target.value)}
                            placeholder="Ban reason"
                            style={{ width: "100%", padding: "0.5rem" }}
                            rows={3}
                        />
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                            className="btn"
                            style={{ backgroundColor: "#8b5cf6" }}
                            onClick={() => banUser(selectedUserId)}
                        >
                            Confirm Ban
                        </button>
                        <button
                            className="btn"
                            style={{ backgroundColor: "#6b7280" }}
                            onClick={() => {
                                setBanDialogOpen(false);
                                setSelectedUserId(null);
                                setBanReason("");
                                setBanDuration(24);
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
