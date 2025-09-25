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
  transcript_enabled?: boolean; // NEW
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

  const transcriptEnabled =
    row?.transcript_enabled !== undefined
      ? !!row.transcript_enabled
      : true; // default ON

  return {
    guild_id: guildId,
    moderator_role_ids: moderatorRoles,
    on_duty_role_id: onDutyRole,
    tickets_category_id: ticketsCat,
    tickets_archive_category_id: archiveCat,
    log_channel_id: logChan,
    audit_log_channel_id: auditLogChan,
    fallback_ping_mod_if_no_on_duty: fallbackPing,
    transcript_enabled: transcriptEnabled,
    updated_at: (row?.updated_at as number | undefined) ?? now()
  };
}

/** Generic setter for a single guild setting. */
export function setGuildSetting(
  guildId: string,
  key:
    | 'moderator_role_ids'
    | 'on_duty_role_id'
    | 'tickets_category_id'
    | 'tickets_archive_category_id'
    | 'log_channel_id'
    | 'audit_log_channel_id'
    | 'fallback_ping_mod_if_no_on_duty'
    | 'transcript_enabled',
  value: string | string[] | boolean | null
) {
  const existing = getGuildSettings(guildId);

  const payload = {
    guild_id: guildId,
    moderator_role_ids: JSON.stringify(existing.moderator_role_ids ?? []),
    on_duty_role_id: existing.on_duty_role_id ?? null,
    tickets_category_id: existing.tickets_category_id ?? null,
    tickets_archive_category_id: existing.tickets_archive_category_id ?? null,
    log_channel_id: existing.log_channel_id ?? null,
    audit_log_channel_id: existing.audit_log_channel_id ?? null,
    fallback_ping_mod_if_no_on_duty: existing.fallback_ping_mod_if_no_on_duty ? 1 : 0,
    transcript_enabled: existing.transcript_enabled ? 1 : 0,
    updated_at: now()
  } as any;

  switch (key) {
    case 'moderator_role_ids':
      payload.moderator_role_ids = JSON.stringify(Array.isArray(value) ? value : []);
      break;
    case 'on_duty_role_id':
      payload.on_duty_role_id = (typeof value === 'string' && value.trim().length > 0) ? value : null;
      break;
    case 'tickets_category_id':
      payload.tickets_category_id = (typeof value === 'string' && value.trim().length > 0) ? value : null;
      break;
    case 'tickets_archive_category_id':
      payload.tickets_archive_category_id = (typeof value === 'string' && value.trim().length > 0) ? value : null;
      break;
    case 'log_channel_id':
      payload.log_channel_id = (typeof value === 'string' && value.trim().length > 0) ? value : null;
      break;
    case 'audit_log_channel_id':
      payload.audit_log_channel_id = (typeof value === 'string' && value.trim().length > 0) ? value : null;
      break;
    case 'fallback_ping_mod_if_no_on_duty':
      payload.fallback_ping_mod_if_no_on_duty = value ? 1 : 0;
      break;
    case 'transcript_enabled':
      payload.transcript_enabled = value ? 1 : 0;
      break;
  }

  _upsertGuildConfig.run(payload);
}

/** Back-compat helper (used earlier) */
export function setAuditLogChannel(guildId: string, channelId: string | null) {
  setGuildSetting(guildId, 'audit_log_channel_id', channelId);
}
