/*
 * Ticketbox
 * File: src/log.ts
 * Created by github.com/officialnoms
 * File Description: Logging functions
 */

import { EmbedBuilder, Guild, TextChannel, ChannelType } from 'discord.js';
import { getGuildSettings } from './settings';

async function getLogChannel(guild: Guild): Promise<TextChannel | null> {
  const id = getGuildSettings(guild.id).log_channel_id?.trim();
  if (!id) return null;

  const cached = guild.channels.cache.get(id);
  if (cached && cached.type === ChannelType.GuildText) return cached as TextChannel;

  const fetched = await guild.channels.fetch(id).catch(() => null);
  if (fetched && fetched.type === ChannelType.GuildText) return fetched as TextChannel;

  return null;
}

export type LogEvent =
  | 'OPEN'
  | 'OPEN_FOR'
  | 'USER_RESOLVED'
  | 'USER_REOPEN_REQUEST'
  | 'MOD_RESOLVE'
  | 'MOD_CLOSE'
  | 'MOD_ARCHIVE'
  | 'MOD_REOPEN'
  | 'ADD_PARTICIPANT'
  | 'REMOVE_PARTICIPANT';

const COLORS: Record<LogEvent, number> = {
  OPEN: 0x4b9fff,
  OPEN_FOR: 0x4b9fff,
  USER_RESOLVED: 0x9aa0a6,
  USER_REOPEN_REQUEST: 0xfbbc04,
  MOD_RESOLVE: 0x9aa0a6,
  MOD_CLOSE: 0xdb4437,
  MOD_ARCHIVE: 0x5f6368,
  MOD_REOPEN: 0x34a853,
  ADD_PARTICIPANT: 0x7baaf7,
  REMOVE_PARTICIPANT: 0xa0a0a0
};

const TITLES: Record<LogEvent, string> = {
  OPEN: 'Ticket Opened',
  OPEN_FOR: 'Ticket Opened (for user)',
  USER_RESOLVED: 'User Marked Resolved',
  USER_REOPEN_REQUEST: 'User Requested Reopen',
  MOD_RESOLVE: 'Moderator Set Resolved (Pending Review)',
  MOD_CLOSE: 'Ticket Closed',
  MOD_ARCHIVE: 'Ticket Archived',
  MOD_REOPEN: 'Ticket Reopened',
  ADD_PARTICIPANT: 'Participant Added',
  REMOVE_PARTICIPANT: 'Participant Removed'
};

export async function logAction(
  guild: Guild,
  type: LogEvent,
  fields: { name: string; value: string; inline?: boolean }[],
) {
  const channel = await getLogChannel(guild);
  if (!channel) return; // no-op if misconfigured

  const embed = new EmbedBuilder()
    .setTitle(`🧾 ${TITLES[type]}`)
    .setColor(COLORS[type])
    .addFields(fields)
    .setTimestamp(new Date());

  try {
    await channel.send({ embeds: [embed] });
  } catch {
    // swallow logging failures
  }
}
