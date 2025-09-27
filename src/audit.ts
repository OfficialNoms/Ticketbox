/*
 * Ticketbox
 * File: src/audit.ts
 * Created by github.com/officialnoms
 * File Description: Audit log and transcript functions
 */

import { ChannelType, EmbedBuilder, type Guild, type TextChannel, AttachmentBuilder } from 'discord.js';
import { getGuildSettings } from './settings';
import { parseParticipants, writeAuditMessageId, writeTranscriptUrl, getTicketById } from './tickets/store';
import type { TicketRow } from './tickets/types';

async function getAuditChannel(guild: Guild): Promise<TextChannel | null> {
  const id = getGuildSettings(guild.id).audit_log_channel_id?.trim();
  if (!id) return null;

  const cached = guild.channels.cache.get(id);
  if (cached && cached.type === ChannelType.GuildText) return cached as TextChannel;

  const fetched = await guild.channels.fetch(id).catch(() => null);
  if (fetched && fetched.type === ChannelType.GuildText) return fetched as TextChannel;

  return null;
}

function uniqParticipants(row: TicketRow): string[] {
  const set = new Set<string>([row.creator_user_id, row.target_user_id, ...parseParticipants(row)]);
  return Array.from(set);
}

function buildAuditEmbed(row: TicketRow): EmbedBuilder {
  const participants = uniqParticipants(row).map(id => `<@${id}>`).join(', ') || '—';
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Status', value: `\`${row.state}\``, inline: true },
    { name: 'Opened by', value: `<@${row.creator_user_id}>`, inline: true },
    { name: 'Target user', value: `<@${row.target_user_id}>`, inline: true },
    ...(row.closed_by_user_id ? [{ name: 'Closed by', value: `<@${row.closed_by_user_id}>`, inline: true }] : []),
    ...(row.archived_by_user_id ? [{ name: 'Archived by', value: `<@${row.archived_by_user_id}>`, inline: true }] : []),
    ...(row.subject ? [{ name: 'Subject', value: row.subject, inline: false }] : []),
    { name: 'Participants', value: participants, inline: false },
  ];
  if (row.transcript_url) {
    fields.push({ name: 'Transcript', value: row.transcript_url, inline: false });
  }

  return new EmbedBuilder()
    .setTitle(`🧭 Ticket Audit — ${row.id}`)
    .setDescription(`Channel: <#${row.channel_id}>`)
    .addFields(fields)
    .setTimestamp(new Date(row.created_at * 1000));
}

export async function ensureAuditEntry(guild: Guild, row: TicketRow): Promise<string | null> {
  const ch = await getAuditChannel(guild);
  if (!ch) return null;
  if (row.audit_message_id) {
    const existing = await ch.messages.fetch(row.audit_message_id).catch(() => null);
    if (existing) return existing.id;
  }
  const embed = buildAuditEmbed(row);
  const msg = await ch.send({ embeds: [embed] });
  writeAuditMessageId(row.id, msg.id);
  return msg.id;
}

export async function updateAuditEntry(guild: Guild, row: TicketRow): Promise<void> {
  const ch = await getAuditChannel(guild);
  if (!ch) return;
  const id = await ensureAuditEntry(guild, row);
  if (!id) return;
  const msg = await ch.messages.fetch(id).catch(() => null);
  const embed = buildAuditEmbed(row);
  if (msg) await msg.edit({ embeds: [embed] });
}

// Respect guild toggle; generate+attach HTML transcript.
export async function attachTranscriptHTML(guild: Guild, ticket: TicketRow): Promise<string | null> {
  const g = getGuildSettings(guild.id);
  if (!g.transcript_enabled) return null;

  const ch = await getAuditChannel(guild);
  if (!ch) return null;

  const id = await ensureAuditEntry(guild, ticket);
  if (!id) return null;

  const msg = await ch.messages.fetch(id).catch(() => null);
  if (!msg) return null;

  // Pull channel messages and render minimal HTML
  const ticketChannel = guild.channels.cache.get(ticket.channel_id);
  if (!ticketChannel || ticketChannel.type !== ChannelType.GuildText) return null;
  const text = ticketChannel as TextChannel;

  // Collect up to ~500 messages, oldest → newest
  const collected: any[] = [];
  let beforeId: string | undefined = undefined;
  for (let i = 0; i < 5; i++) {
    const batch = await text.messages.fetch({ limit: 100, before: beforeId }).catch(() => null);
    if (!batch || batch.size === 0) break;
    const msgs = Array.from(batch.values());
    collected.push(...msgs);
    const oldest = msgs.reduce((a, b) => (a.createdTimestamp < b.createdTimestamp ? a : b));
    beforeId = oldest.id;
    if (batch.size < 100) break;
  }
  collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const isSnowflake = (s: string | undefined) => !!s && /^\d+$/.test(s);

  const rows = collected.map(m => {
    const time = new Date(m.createdTimestamp).toISOString();
    const authorId = m.author?.id ?? '';
    const username = ((m.author?.username ?? authorId) || 'unknown');
    const authorAnchor = isSnowflake(authorId)
      ? `<a class="a" href="https://discord.com/users/${authorId}" title="ID: ${authorId}">${escape(username)}</a>`
      : `<span class="a">${escape(username)}</span>`;
    const idSuffix = isSnowflake(authorId) ? ` <span class="uid">(${authorId})</span>` : '';
    const content = m.content ? escape(m.content) : '';
    const attachments = m.attachments?.size
      ? `<div class="atts">Attachments: ${Array.from(m.attachments.values()).map(a => `<a href="${a.url}">${escape(a.name ?? 'file')}</a>`).join(', ')}</div>`
      : '';
    return `<div class="msg"><span class="t">${time}</span> ${authorAnchor}${idSuffix}<div class="c">${content}</div>${attachments}</div>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<title>Ticket ${ticket.id} Transcript</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;background:#111;color:#eee;margin:0;padding:24px;}
h1{margin-top:0;font-size:20px;}
.msg{padding:8px 0;border-bottom:1px solid #222;}
.t{color:#9aa0a6;margin-right:8px;font-size:12px}
.a{color:#8ab4f8;text-decoration:none}
.a:hover{text-decoration:underline}
.uid{color:#9aa0a6;font-size:12px;margin-left:4px}
.c{white-space:pre-wrap;margin-top:4px}
.atts a{color:#8ab4f8}
.meta{color:#9aa0a6;margin-bottom:12px}
</style>
<h1>Ticket ${escape(ticket.id)} Transcript</h1>
<div class="meta">Channel: #${escape((text as any).name ?? '')} • Guild: ${escape(guild.name)}</div>
${rows}
</html>`;

  const attachment = new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `ticket-${ticket.id}.html` });

  const embed = buildAuditEmbed(ticket);
  const edited = await msg.edit({ embeds: [embed], files: [attachment] }).catch(() => null);
  const url = edited?.attachments?.first()?.url ?? null;

  writeTranscriptUrl(ticket.id, url);
  const updated = getTicketById(ticket.id);
  if (updated) await updateAuditEntry(guild, updated);
  return url;
}
