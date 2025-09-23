import { ChannelType, PermissionFlagsBits, type Guild, type OverwriteResolvable, type TextChannel } from 'discord.js';
import { loadConfig } from '../config';
import { now } from '../db';
import { shortId } from '../util';
import { insertTicketRow } from './store';
import { buildStaffOverwrites } from './permissions';

const cfg = loadConfig();

export async function createUserTicket(guild: Guild, creatorId: string, subject?: string): Promise<TextChannel> {
  const id = shortId();
  const member = await guild.members.fetch(creatorId);

  const safeName = member.user.username
    .replace(/[^a-z0-9-]/gi, '-')
    .toLowerCase()
    .slice(0, 20)
    .replace(/-+/g, '-');

  const channelName = `ticket-${id}-${safeName}`;
  const everyoneId = guild.roles.everyone.id;
  const botUserId = guild.client.user?.id;
  if (!botUserId) throw new Error('Bot user not ready');

  const overwrites: OverwriteResolvable[] = [
    { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
    ...buildStaffOverwrites(),
    {
      id: creatorId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: botUserId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: cfg.ticketsCategoryId || null,
    permissionOverwrites: overwrites,
  });

  const ts = now();
  insertTicketRow({
    id,
    guild_id: guild.id,
    channel_id: channel.id,
    creator_user_id: creatorId,
    target_user_id: creatorId,
    subject: subject ?? null,
    state: 'OPEN',
    created_at: ts,
    updated_at: ts,
    added_participants: JSON.stringify([]),
    header_message_id: null,
    archived_at: null,
    closed_at: null,
    transcript_url: null,
  });

  return channel as TextChannel;
}

export async function createTicketForTarget(
  guild: Guild,
  creatorId: string,     // mod creating
  targetUserId: string,  // user ticket is for
  subject?: string
): Promise<TextChannel> {
  const id = shortId();
  const target = await guild.members.fetch(targetUserId);

  const safeName = target.user.username
    .replace(/[^a-z0-9-]/gi, '-')
    .toLowerCase()
    .slice(0, 20)
    .replace(/-+/g, '-');

  const channelName = `ticket-${id}-${safeName}`;
  const everyoneId = guild.roles.everyone.id;
  const botUserId = guild.client.user?.id;
  if (!botUserId) throw new Error('Bot user not ready');

  const overwrites: OverwriteResolvable[] = [
    { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
    ...buildStaffOverwrites(),
    {
      id: targetUserId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: botUserId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: cfg.ticketsCategoryId || null,
    permissionOverwrites: overwrites,
  });

  const ts = now();
  insertTicketRow({
    id,
    guild_id: guild.id,
    channel_id: channel.id,
    creator_user_id: creatorId,
    target_user_id: targetUserId,
    subject: subject ?? null,
    state: 'OPEN',
    created_at: ts,
    updated_at: ts,
    added_participants: JSON.stringify([]),
    header_message_id: null,
    archived_at: null,
    closed_at: null,
    transcript_url: null,
  });

  return channel as TextChannel;
}
