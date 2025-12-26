import crypto from "node:crypto";

export function createEtag(payload: unknown) {
    const json = typeof payload === "string" ? payload : JSON.stringify(payload);
    return `W/"${crypto.createHash("sha256").update(json).digest("base64")}"`;
}
