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

/** Ensure the per-ticket audit message exists; create it if missing, and persist its message id. */
export async function ensureAuditEntry(guild: Guild, row: TicketRow): Promise<string | null> {
  const ch = await getAuditChannel(guild);
  if (!ch) return null; // Not configured; silently skip

  if (row.audit_message_id) {
    const existing = await ch.messages.fetch(row.audit_message_id).catch(() => null);
    if (existing) return existing.id;
  }

  const embed = buildAuditEmbed(row);
  const msg = await ch.send({ embeds: [embed] });
  writeAuditMessageId(row.id, msg.id);
  return msg.id;
}

/** Update the audit message with a fresh embed snapshot. */
export async function updateAuditEntry(guild: Guild, row: TicketRow): Promise<void> {
  const ch = await getAuditChannel(guild);
  if (!ch) return;

  // Ensure an audit message exists
  const id = await ensureAuditEntry(guild, row);
  if (!id) return;

  const msg = await ch.messages.fetch(id).catch(() => null);
  const embed = buildAuditEmbed(row);
  if (msg) {
    await msg.edit({ embeds: [embed] });
  }
}

/** Generate a simple HTML transcript, attach it to the audit message, and persist the URL. */
export async function attachTranscriptHTML(guild: Guild, ticket: TicketRow): Promise<string | null> {
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

  // Collect up to ~500 messages, oldest->newest
  const collected: any[] = [];
  let lastId: string | undefined = undefined;
  for (let i = 0; i < 5; i++) {
    const batch = await text.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
    if (!batch || batch.size === 0) break;
    const sorted = Array.from(batch.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    collected.push(...sorted);
    lastId = sorted[0]?.id;
    if (batch.size < 100) break;
  }

  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const rows = collected.map(m => {
    const time = new Date(m.createdTimestamp).toISOString();
    const author = m.author?.tag ?? m.author?.id ?? 'unknown';
    const content = m.content ? escape(m.content) : '';
    const attachments = m.attachments?.size
      ? `<div class="atts">Attachments: ${Array.from(m.attachments.values()).map(a => `<a href="${a.url}">${escape(a.name ?? 'file')}</a>`).join(', ')}</div>`
      : '';
    return `<div class="msg"><span class="t">${time}</span> <span class="a">${escape(author)}</span><div class="c">${content}</div>${attachments}</div>`;
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
.a{color:#8ab4f8}
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
  // Re-render embed to show the Transcript link field
  const updated = getTicketById(ticket.id);
  if (updated) {
    await updateAuditEntry(guild, updated);
  }
  return url;
}
