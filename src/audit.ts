/*
 * Ticketbox
 * File: src/audit.ts
 * Created by github.com/officialnoms
 * File Description: Audit log and transcript functions
 */

import {
  ChannelType,
  EmbedBuilder,
  Guild,
  TextChannel,
} from 'discord.js';
import { db } from './db';
import { getGuildSettings } from './settings';
import type { TicketRow } from './tickets/types';
import { parseParticipants } from './tickets/store';

// DB helpers
const _getTicketById = db.prepare(`SELECT * FROM tickets WHERE id=?`);
const _writeAuditMessageId = db.prepare(`UPDATE tickets SET audit_message_id=@mid WHERE id=@id`);
const _writeTranscriptUrl = db.prepare(`UPDATE tickets SET transcript_url=@url WHERE id=@id`);

// Small cache for user lookups during one audit update
class UserCache {
  private map = new Map<string, string>();
  constructor(private guild: Guild) {}
  async nameFor(id: string): Promise<string> {
    if (this.map.has(id)) return this.map.get(id)!;
    // Prefer global username (not guild nickname)
    const user = await this.guild.client.users.fetch(id).catch(() => null);
    const username = user?.username ?? `Unknown#${id.slice(-4)}`;
    this.map.set(id, username);
    return username;
  }
}

// Format as "username (<@id>)" to show both global username and a mention 
async function fmtUser(cache: UserCache, id: string): Promise<string> {
  const name = await cache.nameFor(id);
  return `${name} (<@${id}>)`;
}

// Gather “everyone ever involved”
async function collectAllParticipantIds(guild: Guild, ticket: TicketRow): Promise<string[]> {
  const set = new Set<string>();

  // Seed with opener, target, and added participants
  set.add(ticket.creator_user_id);
  set.add(ticket.target_user_id);
  for (const p of parseParticipants(ticket)) set.add(p);

  // Add anyone who posted in the channel (best-effort; tickets are usually short)
  const ch = guild.channels.cache.get(ticket.channel_id) ?? await guild.channels.fetch(ticket.channel_id).catch(() => null);
  if (ch && ch.type === ChannelType.GuildText) {
    const text = ch as TextChannel;
    let before: string | undefined;
    // Walk back up to ~4000 messages to be safe
    for (;;) {
      const batch = await text.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
      if (!batch || batch.size === 0) break;
      for (const m of batch.values()) {
        set.add(m.author.id);
      }
      const last = batch.last();
      if (!last) break;
      before = last.id;
      // safety guard
      if (set.size > 4000) break;
    }
  }

  return Array.from(set);
}

// Build the audit embed from current ticket row (optionally with full participants)
async function buildAuditEmbed(guild: Guild, ticket: TicketRow, includeAllParticipants: boolean): Promise<EmbedBuilder> {
  const cache = new UserCache(guild);

  const title = `Ticket ${ticket.id}`;
  const chMention = `<#${ticket.channel_id}>`;

  // Participants: either the minimal known set (for live tickets) or the full union (for archive)
  let participantIds: string[] = [];
  if (includeAllParticipants) {
    participantIds = await collectAllParticipantIds(guild, ticket);
  } else {
    const seeded = new Set<string>([
      ticket.creator_user_id,
      ticket.target_user_id,
      ...parseParticipants(ticket),
    ]);
    participantIds = Array.from(seeded);
  }

  // Render participants — keep under embed field limits
  const rendered: string[] = [];
  for (const id of participantIds) {
    rendered.push(await fmtUser(cache, id));
    if (rendered.join('\n').length > 900) { // stay under 1024 hard limit
      rendered.push('…');
      break;
    }
  }

  const e = new EmbedBuilder()
    .setTitle('🧾 Ticket Audit')
    .addFields(
      { name: 'Ticket', value: `${chMention}`, inline: true },
      { name: 'Status', value: `\`${ticket.state}\``, inline: true },
      { name: 'Subject', value: ticket.subject ? ticket.subject : '—', inline: true },
      { name: 'Opened by', value: await fmtUser(cache, ticket.creator_user_id), inline: true },
      { name: 'Target user', value: await fmtUser(cache, ticket.target_user_id), inline: true },
      { name: 'Participants (ever involved)', value: rendered.length ? rendered.join('\n') : '—', inline: false },
    )
    .setTimestamp(new Date());

  if (ticket.transcript_url) {
    e.addFields({ name: 'Transcript', value: `[HTML transcript](${ticket.transcript_url})`, inline: false });
  }

  if (ticket.closed_at) {
    const closedBy = (ticket as any).closed_by_user_id as string | null | undefined;
    if (closedBy) {
      e.addFields({ name: 'Closed by', value: await fmtUser(cache, closedBy), inline: true });
    }
  }
  if (ticket.archived_at) {
    const archivedBy = (ticket as any).archived_by_user_id as string | null | undefined;
    if (archivedBy) {
      e.addFields({ name: 'Archived by', value: await fmtUser(cache, archivedBy), inline: true });
    }
  }

  return e;
}

// Ensure there is a one-message-per-ticket audit entry 
export async function ensureAuditEntry(guild: Guild, ticket: TicketRow) {
  const g = getGuildSettings(guild.id);
  if (!g.audit_log_channel_id) return; // not configured → nothing to do

  // Already have a message?
  const existing = (_getTicketById.get(ticket.id) as any) || ticket;
  const auditMessageId = existing.audit_message_id as string | null | undefined;
  const ch = guild.channels.cache.get(g.audit_log_channel_id) ?? await guild.channels.fetch(g.audit_log_channel_id).catch(() => null);
  if (!ch || ch.type !== ChannelType.GuildText) return;

  const text = ch as TextChannel;

  if (auditMessageId) {
    // Make sure it still exists; if not, we’ll recreate
    const ok = await text.messages.fetch(auditMessageId).then(() => true).catch(() => false);
    if (ok) return;
  }

  // For live tickets, don’t pay the cost of full history; minimal set is fine here.
  const embed = await buildAuditEmbed(guild, existing as TicketRow, /*includeAllParticipants*/ false);
  const msg = await text.send({ embeds: [embed] }).catch(() => null);
  if (!msg) return;

  _writeAuditMessageId.run({ id: ticket.id, mid: msg.id });
}

// Update/edit the audit entry. When archived, expand participants to “everyone ever involved”. 
export async function updateAuditEntry(guild: Guild, ticket: TicketRow) {
  const g = getGuildSettings(guild.id);
  if (!g.audit_log_channel_id) return;

  const row = (_getTicketById.get(ticket.id) as any) || ticket;
  const auditMessageId = row.audit_message_id as string | null | undefined;
  const ch = guild.channels.cache.get(g.audit_log_channel_id) ?? await guild.channels.fetch(g.audit_log_channel_id).catch(() => null);
  if (!ch || ch.type !== ChannelType.GuildText) return;

  const text = ch as TextChannel;

  // If missing, create it first
  if (!auditMessageId) {
    await ensureAuditEntry(guild, row as TicketRow);
  }

  const msgId = (row.audit_message_id as string | null | undefined);
  if (!msgId) return; // still missing; bail

  // Archived → compute the full union; otherwise use the light set
  const includeAll = (row.state === 'ARCHIVED');
  const embed = await buildAuditEmbed(guild, row as TicketRow, includeAll);

  const msg = await text.messages.fetch(msgId).catch(() => null);
  if (msg) {
    await msg.edit({ embeds: [embed] }).catch(() => {});
  }
}

// Attach the generated HTML transcript (path/url provided elsewhere) to the audit entry
export async function attachTranscriptHTML(guild: Guild, ticket: TicketRow) {
  const g = getGuildSettings(guild.id);
  if (!g.audit_log_channel_id || !ticket.transcript_url) return;

  const row = (_getTicketById.get(ticket.id) as any) || ticket;
  const ch = guild.channels.cache.get(g.audit_log_channel_id) ?? await guild.channels.fetch(g.audit_log_channel_id).catch(() => null);
  if (!ch || ch.type !== ChannelType.GuildText) return;

  const text = ch as TextChannel;

  // Ensure there is a message
  if (!row.audit_message_id) {
    await ensureAuditEntry(guild, row as TicketRow);
  }
  const msgId = (row.audit_message_id as string | null | undefined);
  if (!msgId) return;

  // Just re-render the embed; it already prints the transcript link if present.
  const embed = await buildAuditEmbed(guild, row as TicketRow, row.state === 'ARCHIVED');
  const msg = await text.messages.fetch(msgId).catch(() => null);
  if (msg) await msg.edit({ embeds: [embed] }).catch(() => {});
}

// Optional helper if you add HTML generation elsewhere to set the URL on the row 
export function setTranscriptUrl(ticketId: string, url: string | null) {
  _writeTranscriptUrl.run({ id: ticketId, url });
}
