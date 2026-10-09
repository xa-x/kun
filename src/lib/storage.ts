import * as fs from "fs";
import * as path from "path";
import { AwsClient } from "aws4fetch";

export interface StoredObject {
  key: string;
  bytes: number;
}

export interface ObjectStore {
  put(key: string, data: Uint8Array, contentType?: string): Promise<StoredObject>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
}

/**
 * Production store: a private Cloudflare R2 bucket, reached over its
 * S3-compatible API. Only this server holds the credentials — browsers always
 * go through /api/media/[id], which is where access is decided.
 */
class R2Store implements ObjectStore {
  private client: AwsClient;
  private base: string;
  constructor(cfg: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }) {
    this.client = new AwsClient({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      service: "s3",
      region: "auto",
    });
    this.base = `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}`;
  }
  private url(key: string) {
    return `${this.base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
  async put(key: string, data: Uint8Array, contentType?: string): Promise<StoredObject> {
    const res = await this.client.fetch(this.url(key), {
      method: "PUT",
      body: Buffer.from(data),
      headers: { "content-type": contentType || "application/octet-stream" },
    });
    if (!res.ok) {
      throw new Error(`Could not store media (R2 ${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    return { key, bytes: data.byteLength };
  }
  async get(key: string): Promise<Uint8Array | null> {
    const res = await this.client.fetch(this.url(key));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Could not read media (R2 ${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  async remove(key: string) {
    await this.client.fetch(this.url(key), { method: "DELETE" });
  }
}

/** Local development fallback: files under `.data/media`. */
class LocalStore implements ObjectStore {
  constructor(private root: string) {}
  async put(key: string, data: Uint8Array): Promise<StoredObject> {
    const dest = path.join(this.root, key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
    return { key, bytes: data.byteLength };
  }
  async get(key: string): Promise<Uint8Array | null> {
    const dest = path.join(this.root, key);
    if (!fs.existsSync(dest)) return null;
    return new Uint8Array(fs.readFileSync(dest));
  }
  async remove(key: string) {
    const dest = path.join(this.root, key);
    try {
      fs.unlinkSync(dest);
    } catch {
      /* ignore */
    }
  }
}

function openStore(): ObjectStore {
  const accountId = (process.env.R2_ACCOUNT_ID ?? "").trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID ?? "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY ?? "").trim();
  const bucket = (process.env.R2_BUCKET ?? "kun-media").trim();
  if (accountId && accessKeyId && secretAccessKey) {
    return new R2Store({ accountId, accessKeyId, secretAccessKey, bucket });
  }
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[storage] R2 credentials not set — media is being written to local disk and will not survive a redeploy.",
    );
  }
  return new LocalStore(path.join(process.cwd(), ".data", "media"));
}

export const objectStore: ObjectStore = openStore();

export function mediaKey(orgId: string, filename: string) {
  return orgId ? path.posix.join(orgId, filename) : filename;
}
