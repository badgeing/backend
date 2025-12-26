import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const pendingRoot = path.resolve(process.cwd(), "data", "pending");

export async function savePendingFile(buffer: Buffer, ext: string) {
    await fs.mkdir(pendingRoot, { recursive: true });
    const key = `${randomUUID()}${ext}`;
    const fullPath = path.join(pendingRoot, key);
    await fs.writeFile(fullPath, buffer);
    return { key, fullPath };
}

export async function readPendingFile(key: string) {
    const fullPath = path.join(pendingRoot, key);
    return fs.readFile(fullPath);
}

export async function deletePendingFile(key: string) {
    const fullPath = path.join(pendingRoot, key);
    await fs.rm(fullPath, { force: true });
}
