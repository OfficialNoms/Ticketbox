import type { Guild } from 'discord.js';
import { now, _getGuildConfig, _upsertGuildConfig } from './db';
import { loadConfig } from './config';

const fileCfg = loadConfig();

export type GuildSettings = {
  guild_id: string;
  moderator_role_ids?: string[];
  on_duty_role_id?: string | null;
  tickets_category_id?: string | null;
  tickets_archive_category_id?: string | null;
  log_channel_id?: string | null;
  audit_log_channel_id?: string | null;
  fallback_ping_mod_if_no_on_duty?: boolean;
  updated_at: number;
};

function nilIfEmpty(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

function safeParseArray(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

export function getGuildSettings(guildId: string): GuildSettings {
  const row = _getGuildConfig.get(guildId) as any | undefined;

  // Prefer DB when present; otherwise fall back to file config, normalized.
  const moderatorRoles =
    row?.moderator_role_ids !== undefined
      ? safeParseArray(row.moderator_role_ids)
      : (fileCfg.moderatorRoleIds ?? []);

  const onDutyRole =
    row?.on_duty_role_id !== undefined
      ? nilIfEmpty(row.on_duty_role_id)
      : nilIfEmpty(fileCfg.onDutyRoleId);

  const ticketsCat =
    row?.tickets_category_id !== undefined
      ? nilIfEmpty(row.tickets_category_id)
      : nilIfEmpty(fileCfg.ticketsCategoryId);

  const archiveCat =
    row?.tickets_archive_category_id !== undefined
      ? nilIfEmpty(row.tickets_archive_category_id)
      : nilIfEmpty(fileCfg.ticketsArchiveCategoryId);

  const logChan =
    row?.log_channel_id !== undefined
      ? nilIfEmpty(row.log_channel_id)
      : nilIfEmpty(fileCfg.logChannelId);

  const auditLogChan =
    row?.audit_log_channel_id !== undefined
      ? nilIfEmpty(row.audit_log_channel_id)
      : null;

  const fallbackPing =
    row?.fallback_ping_mod_if_no_on_duty !== undefined
      ? !!row.fallback_ping_mod_if_no_on_duty
      : !!fileCfg.fallbackPingModeratorIfNoOnDuty;

  return {
    guild_id: guildId,
    moderator_role_ids: moderatorRoles,
    on_duty_role_id: onDutyRole,
    tickets_category_id: ticketsCat,
    tickets_archive_category_id: archiveCat,
    log_channel_id: logChan,
    audit_log_channel_id: auditLogChan,
    fallback_ping_mod_if_no_on_duty: fallbackPing,
    updated_at: (row?.updated_at as number | undefined) ?? now()
  };
}

export function setAuditLogChannel(guildId: string, channelId: string | null) {
  const existing = getGuildSettings(guildId);
  const payload = {
    guild_id: guildId,
    moderator_role_ids: JSON.stringify(existing.moderator_role_ids ?? []),
    on_duty_role_id: existing.on_duty_role_id ?? null,
    tickets_category_id: existing.tickets_category_id ?? null,
    tickets_archive_category_id: existing.tickets_archive_category_id ?? null,
    log_channel_id: existing.log_channel_id ?? null,
    audit_log_channel_id: channelId ?? null,
    fallback_ping_mod_if_no_on_duty: existing.fallback_ping_mod_if_no_on_duty ? 1 : 0,
    updated_at: now()
  };
  _upsertGuildConfig.run(payload);
}
