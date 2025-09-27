import {
  ChannelType,
  EmbedBuilder,
  Guild,
  PermissionFlagsBits,
  PermissionsBitField,
  TextChannel,
} from 'discord.js';
import { getGuildSettings } from './settings';

/** One line in the validation report */
type Status = 'pass' | 'warn' | 'fail';
type Check = { name: string; status: Status; detail: string; fix?: string };

function ok(detail: string): Check { return { name: '', status: 'pass', detail }; }
function warn(detail: string, fix?: string): Check { return { name: '', status: 'warn', detail, fix }; }
function fail(detail: string, fix?: string): Check { return { name: '', status: 'fail', detail, fix }; }

export async function validateGuild(guild: Guild) {
  const g = getGuildSettings(guild.id);
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  const checks: Check[] = [];

  // helper: perms for a channel
  const can = (ch: TextChannel, ...perms: bigint[]) => {
    if (!me) return false;
    const p = ch.permissionsFor(me);
    return !!p && perms.every(x => p.has(x));
  };

  // helper: ManageChannels on guild or category
  const canManageAt = (categoryId?: string | null) => {
    if (!me) return false;
    if (me.permissions.has(PermissionsBitField.Flags.ManageChannels)) return true;
    if (!categoryId) return false;
    const cat = guild.channels.cache.get(categoryId);
    if (cat && cat.type === ChannelType.GuildCategory) {
      const p = (cat as any).permissionsFor(me);
      return !!p && p.has(PermissionsBitField.Flags.ManageChannels);
    }
    return false;
  };

  // ───────────────────────────────
  // Audit Log channel
  // ───────────────────────────────
  if (!g.audit_log_channel_id) {
    checks.push(fail('Audit log channel is not set.', 'Run: /config set setting:audit_log_channel_id value:#channel'));
  } else {
    const ch = await guild.channels.fetch(g.audit_log_channel_id).catch(() => null);
    if (!ch || ch.type !== ChannelType.GuildText) {
      checks.push(fail('Audit log channel ID does not point to a text channel.', 'Pick a text channel and set it again.'));
    } else {
      const text = ch as TextChannel;
      const need = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles];
      if (!can(text, ...need)) {
        checks.push(fail('Bot lacks permissions in the audit log channel (needs View, Send, Embed Links, Attach Files).', 'Grant those perms in that channel.'));
      } else {
        checks.push(ok(`Audit log channel OK → ${text}`));
      }
    }
  }

  // ───────────────────────────────
  // Ticket Log channel (optional)
  // ───────────────────────────────
  if (!g.log_channel_id) {
    checks.push(warn('Log channel is not set (optional).', 'If you want event logs, set log_channel_id to a text channel.'));
  } else {
    const ch = await guild.channels.fetch(g.log_channel_id).catch(() => null);
    if (!ch || ch.type !== ChannelType.GuildText) {
      checks.push(fail('Log channel ID does not point to a text channel.', 'Pick a text channel and set it again.'));
    } else {
      const text = ch as TextChannel;
      const need = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
      if (!can(text, ...need)) {
        checks.push(fail('Bot lacks permissions in the log channel (needs View, Send, Embed Links).', 'Grant those perms in that channel.'));
      } else {
        checks.push(ok(`Log channel OK → ${text}`));
      }
    }
  }

  // ───────────────────────────────
  // Categories
  // ───────────────────────────────
  const ticketsCat = g.tickets_category_id ? guild.channels.cache.get(g.tickets_category_id) : null;
  const archiveCat = g.tickets_archive_category_id ? guild.channels.cache.get(g.tickets_archive_category_id) : null;

  if (!g.tickets_category_id) {
    checks.push(warn('Tickets category is not set.', 'Recommended: create a “Tickets” category and set tickets_category_id.'));
  } else if (!ticketsCat || ticketsCat.type !== ChannelType.GuildCategory) {
    checks.push(fail('tickets_category_id is not a valid category.', 'Set to a real category channel ID.'));
  } else if (!canManageAt(g.tickets_category_id)) {
    checks.push(fail('Bot cannot Manage Channels for the Tickets category.', 'Grant Manage Channels for the bot on that category or at guild level.'));
  } else {
    checks.push(ok('Tickets category OK.'));
  }

  if (!g.tickets_archive_category_id) {
    checks.push(warn('Archive category is not set.', 'Recommended: create a “Tickets Archive” category and set tickets_archive_category_id.'));
  } else if (!archiveCat || archiveCat.type !== ChannelType.GuildCategory) {
    checks.push(fail('tickets_archive_category_id is not a valid category.', 'Set to a real category channel ID.'));
  } else if (g.tickets_category_id && g.tickets_category_id === g.tickets_archive_category_id) {
    checks.push(fail('Tickets category and Archive category cannot be the same.', 'Pick two distinct categories.'));
  } else if (!canManageAt(g.tickets_archive_category_id)) {
    checks.push(fail('Bot cannot Manage Channels for the Archive category.', 'Grant Manage Channels for the bot on that category or at guild level.'));
  } else {
    checks.push(ok('Archive category OK.'));
  }

  // ───────────────────────────────
  // Roles
  // ───────────────────────────────
  if (!g.moderator_role_ids || g.moderator_role_ids.length === 0) {
    checks.push(warn('No moderator roles configured.', 'Recommended: set moderator_role_ids to your staff roles.'));
  } else {
    const missing = g.moderator_role_ids.filter(rid => !guild.roles.cache.has(rid));
    if (missing.length) {
      checks.push(fail(`Some moderator roles do not exist: ${missing.map(id => `<@&${id}>`).join(', ')}`, 'Remove old IDs or set to existing roles.'));
    } else {
      checks.push(ok('Moderator roles OK.'));
    }
  }

  if (g.on_duty_role_id) {
    if (!guild.roles.cache.has(g.on_duty_role_id)) {
      checks.push(fail('On-duty role ID does not exist.', 'Set to an existing role or clear it.'));
    } else {
      checks.push(ok('On-duty role OK.'));
    }
  } else {
    checks.push(warn('On-duty role not set (optional).', 'If you use on-duty, set on_duty_role_id to a role.'));
  }

  // ───────────────────────────────
  // Transcript toggle
  // ───────────────────────────────
  checks.push(ok(`Transcripts are ${g.transcript_enabled ? 'ENABLED' : 'DISABLED'} (can be toggled with /config set).`));

  return checks;
}

export function renderValidationEmbed(guild: Guild, checks: Check[]) {
  const emoji = (s: Status) => (s === 'pass' ? '✅' : s === 'warn' ? '⚠️' : '❌');
  const pass = checks.filter(c => c.status === 'pass').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const failCount = checks.filter(c => c.status === 'fail').length;

  const lines = checks.map(c => {
    const tip = c.fix ? `\n• Fix: ${c.fix}` : '';
    return `${emoji(c.status)} ${c.detail}${tip}`;
  }).join('\n');

  return new EmbedBuilder()
    .setTitle('🔎 Ticketbox — Configuration Health Check')
    .setDescription(`**Summary:** ${pass} pass · ${warnCount} warn · ${failCount} fail`)
    .addFields({ name: 'Results', value: lines || 'No checks run.' })
    .setTimestamp(new Date());
}
