/**
 * Centralized Nextcloud client.
 * All WebDAV and OCS API calls go through this module — never make raw HTTP
 * calls to Nextcloud elsewhere in the codebase.
 */

export interface NextcloudFile {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: "file" | "directory";
  mime?: string;
  etag?: string;
}

export interface NextcloudShare {
  id: string;
  shareType: number;
  shareWith?: string;
  path: string;
  itemType: "file" | "folder";
  permissions: number;
  shareTime: number;
  token?: string;
}

function baseUrl(): string {
  const url = process.env.NEXTCLOUD_URL;
  if (!url) throw new Error("NEXTCLOUD_URL is not configured. Set it to your Nextcloud instance URL.");
  return url.replace(/\/$/, "");
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "OCS-APIRequest": "true",
    "Content-Type": "application/xml",
  };
}

// ---------------------------------------------------------------------------
// WebDAV — file operations
// ---------------------------------------------------------------------------

/**
 * List the contents of a directory for a given user.
 */
export async function listDirectory(
  accessToken: string,
  username: string,
  path: string
): Promise<NextcloudFile[]> {
  const url = `${baseUrl()}/remote.php/dav/files/${encodeURIComponent(username)}${path}`;

  const body = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
  <d:prop>
    <d:getlastmodified/>
    <d:getetag/>
    <d:getcontenttype/>
    <d:resourcetype/>
    <oc:fileid/>
    <oc:size/>
    <d:getcontentlength/>
  </d:prop>
</d:propfind>`;

  const res = await fetch(url, {
    method: "PROPFIND",
    headers: {
      ...authHeaders(accessToken),
      Depth: "1",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`WebDAV PROPFIND failed: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();
  return parseWebDavPropfind(xml, path);
}

/**
 * Download a file and return its content as a Buffer.
 */
export async function downloadFile(
  accessToken: string,
  username: string,
  path: string
): Promise<Buffer> {
  const url = `${baseUrl()}/remote.php/dav/files/${encodeURIComponent(username)}${path}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`WebDAV GET failed: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// OCS Share API
// ---------------------------------------------------------------------------

/**
 * List all shares visible to the user.
 * Returns folders that others have shared with this user.
 */
export async function listSharedWithMe(
  accessToken: string
): Promise<NextcloudShare[]> {
  const url = `${baseUrl()}/ocs/v2.php/apps/files_sharing/api/v1/shares?shared_with_me=true&format=json`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "OCS-APIRequest": "true",
    },
  });

  if (!res.ok) {
    throw new Error(`OCS shares request failed: ${res.status}`);
  }

  const json = await res.json();
  const items = json?.ocs?.data ?? [];

  return items.map((item: Record<string, unknown>) => ({
    id: String(item.id),
    shareType: Number(item.share_type),
    shareWith: item.share_with ? String(item.share_with) : undefined,
    path: String(item.path),
    itemType: String(item.item_type) as "file" | "folder",
    permissions: Number(item.permissions),
    shareTime: Number(item.stime),
    token: item.token ? String(item.token) : undefined,
  }));
}

/**
 * List shares the user has created (outgoing shares).
 */
export async function listMyShares(
  accessToken: string
): Promise<NextcloudShare[]> {
  const url = `${baseUrl()}/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "OCS-APIRequest": "true",
    },
  });

  if (!res.ok) {
    throw new Error(`OCS shares request failed: ${res.status}`);
  }

  const json = await res.json();
  const items = json?.ocs?.data ?? [];

  return items.map((item: Record<string, unknown>) => ({
    id: String(item.id),
    shareType: Number(item.share_type),
    shareWith: item.share_with ? String(item.share_with) : undefined,
    path: String(item.path),
    itemType: String(item.item_type) as "file" | "folder",
    permissions: Number(item.permissions),
    shareTime: Number(item.stime),
    token: item.token ? String(item.token) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// WebDAV XML parser (minimal, no external deps)
// ---------------------------------------------------------------------------

function parseWebDavPropfind(
  xml: string,
  requestedPath: string
): NextcloudFile[] {
  const files: NextcloudFile[] = [];
  const responseRegex = /<d:response>([\s\S]*?)<\/d:response>/gi;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop
  while ((match = responseRegex.exec(xml)) !== null) {
    const block = match[1];

    const href = extractTag(block, "d:href") ?? "";
    const basename = decodeURIComponent(href.split("/").pop() ?? "");
    const lastmod = extractTag(block, "d:getlastmodified") ?? "";
    const etag = extractTag(block, "d:getetag")?.replace(/"/g, "");
    const mime = extractTag(block, "d:getcontenttype");
    const size = Number(
      extractTag(block, "oc:size") ??
        extractTag(block, "d:getcontentlength") ??
        "0"
    );
    const isCollection = block.includes("<d:collection/>");
    const type: "file" | "directory" = isCollection ? "directory" : "file";

    // Skip the directory itself (first entry)
    if (
      !basename ||
      href.endsWith(requestedPath) ||
      href.endsWith(requestedPath + "/")
    ) {
      continue;
    }

    files.push({ filename: href, basename, lastmod, size, type, mime, etag });
  }

  return files;
}

function extractTag(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  return re.exec(xml)?.[1]?.trim();
}
