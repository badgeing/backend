import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { AppConfig } from "../config.js";

let client: S3Client | null = null;

export function getR2Client(config: AppConfig) {
    if (!client) {
        if (!config.R2_ACCOUNT_ID || !config.R2_ACCESS_KEY_ID || !config.R2_SECRET_ACCESS_KEY || !config.R2_BUCKET_NAME) {
            throw new Error("R2 credentials are not configured");
        }

        client = new S3Client({
            region: "auto",
            endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: config.R2_ACCESS_KEY_ID,
                secretAccessKey: config.R2_SECRET_ACCESS_KEY
            }
        });
    }

    return client;
}

export async function uploadBadgeAsset(config: AppConfig, key: string, body: Buffer, contentType: string) {
    const r2 = getR2Client(config);
    await r2.send(new PutObjectCommand({
        Bucket: config.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType
    }));

    return buildPublicUrl(config, key);
}

export async function deleteBadgeAsset(config: AppConfig, key: string) {
    const r2 = getR2Client(config);
    await r2.send(new DeleteObjectCommand({
        Bucket: config.R2_BUCKET_NAME,
        Key: key
    }));
}

export function buildPublicUrl(config: AppConfig, key: string) {
    if (config.R2_PUBLIC_BASE_URL) {
        return `${config.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
    }

    return `https://fb.kzis.gay/badges/${key}`;
}
