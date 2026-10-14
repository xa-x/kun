/** Privacy and sharing switches for a workspace, stored on `organizations.settings`. */
export interface WorkspaceSettings {
  /** Members may create share links. */
  allowPublicShares: boolean;
  /** Members may publish projects to the Community. */
  allowCommunityPublish: boolean;
  /** New share links stop working after this many days (null: never). */
  shareLinkDays: 7 | 30 | 90 | null;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  allowPublicShares: true,
  allowCommunityPublish: true,
  shareLinkDays: null,
};

export const SHARE_DAY_CHOICES = [7, 30, 90] as const;

/** Read stored settings, ignoring anything unknown or malformed. */
export function workspaceSettings(raw: unknown): WorkspaceSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    allowPublicShares:
      typeof o.allowPublicShares === "boolean" ? o.allowPublicShares : DEFAULT_SETTINGS.allowPublicShares,
    allowCommunityPublish:
      typeof o.allowCommunityPublish === "boolean"
        ? o.allowCommunityPublish
        : DEFAULT_SETTINGS.allowCommunityPublish,
    shareLinkDays: SHARE_DAY_CHOICES.find((d) => d === o.shareLinkDays) ?? null,
  };
}

/** Merge a patch from a client into the current settings, keeping only valid fields. */
export function patchSettings(current: WorkspaceSettings, patch: unknown): WorkspaceSettings {
  const p = patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
  return workspaceSettings({
    ...current,
    ...(typeof p.allowPublicShares === "boolean" ? { allowPublicShares: p.allowPublicShares } : {}),
    ...(typeof p.allowCommunityPublish === "boolean"
      ? { allowCommunityPublish: p.allowCommunityPublish }
      : {}),
    ...("shareLinkDays" in p ? { shareLinkDays: p.shareLinkDays } : {}),
  });
}

/** When a link made now should expire, given the workspace's rule. */
export function shareExpiry(settings: WorkspaceSettings, now = Date.now()): Date | null {
  return settings.shareLinkDays ? new Date(now + settings.shareLinkDays * 86_400_000) : null;
}

/** Set by a platform admin: a suspended workspace can't start runs. Kept beside, not inside, the privacy switches. */
export function isSuspended(raw: unknown): boolean {
  return Boolean(raw && typeof raw === "object" && (raw as Record<string, unknown>).suspended === true);
}

/** Privacy settings written over the stored object, so admin-only fields survive an edit. */
export function mergeStored(raw: unknown, next: WorkspaceSettings): Record<string, unknown> {
  const base = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return { ...base, ...next };
}
