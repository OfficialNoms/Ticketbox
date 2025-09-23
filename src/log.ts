import { EmbedBuilder, Guild, TextChannel } from 'discord.js';
import { loadConfig } from './config';

const cfg = loadConfig();

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

function getLogChannel(guild: Guild): TextChannel | null {
  const id = cfg.logChannelId?.trim();
  if (!id) return null;
  const ch = guild.channels.cache.get(id);
  if (ch && ch.isTextBased() && ch.isTextBased()) {
    // types are messy; the cast is safe for guild text channels
    return ch as TextChannel;
  }
  return null;
}

export async function logAction(
  guild: Guild,
  type: LogEvent,
  fields: { name: string; value: string; inline?: boolean }[],
) {
  const channel = getLogChannel(guild);
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
