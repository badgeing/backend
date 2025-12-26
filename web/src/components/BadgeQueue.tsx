import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { clsx } from "clsx";
import type { BadgeWithCreator } from "../types";

interface BadgeQueueProps {
    backendUrl: string;
}

async function fetchQueue(backendUrl: string): Promise<BadgeWithCreator[]> {
    const res = await fetch(`${backendUrl}/moderation/queue`, {
        credentials: "include"
    });
    if (!res.ok) throw new Error("Failed to load queue");
    const data = await res.json();
    return data.badges ?? [];
}

export function BadgeQueue({ backendUrl }: BadgeQueueProps) {
    const queryClient = useQueryClient();
    const [reasons, setReasons] = useState<Record<string, string>>({});
    
    const { data, isLoading, error } = useQuery({
        queryKey: ["queue"],
        queryFn: () => fetchQueue(backendUrl),
        refetchInterval: 60_000
    });

    const mutation = useMutation({
        mutationFn: async (payload: { id: string; status: string; reason?: string; }) => {
            const res = await fetch(`${backendUrl}/moderation/badges/${payload.id}/status`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                throw new Error((await res.json()).error ?? "Failed to update");
            }
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["queue"] })
    });

    if (isLoading) return <p>Loading queue…</p>;
    if (error) return <p className="error">{(error as Error).message}</p>;
    if (!data?.length) return <p>No pending badges 🎉</p>;

    return (
        <div className="queue">
            {data.map(item => (
                <article key={item.id} className="card">
                    <div className="card-header">
                        <img src={`${backendUrl}/badges/pending/${item.pendingKey}`} alt="Pending" className="thumb" />
                        <div>
                            <h3>{item.name}</h3>
                            <p>Submitted by {item.creator.username}</p>
                        </div>
                    </div>
                    <textarea
                        placeholder="Reason (optional)"
                        className="input"
                        value={reasons[item.id] || ""}
                        onChange={e => setReasons(prev => ({ ...prev, [item.id]: e.target.value }))}
                    />
                    <div className="actions">
                        <button
                            className={clsx("btn", "secondary")}
                            onClick={() => mutation.mutate({ id: item.id, status: "REJECTED", reason: reasons[item.id] })}
                        >Reject</button>
                        <button
                            className={clsx("btn", "primary")}
                            onClick={() => mutation.mutate({ id: item.id, status: "APPROVED", reason: reasons[item.id] })}
                        >Approve</button>
                    </div>
                </article>
            ))}
        </div>
    );
}
