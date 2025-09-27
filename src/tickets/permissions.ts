/*
 * Ticketbox
 * File: src/tickets/permissions.ts
 * Created by github.com/officialnoms
 * File Description: Permission management functions
 */

import type { GuildMember, TextChannel, OverwriteResolvable } from 'discord.js';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { loadConfig } from '../config';

const cfg = loadConfig();

// Make the channel read-only for everyone, including all moderator roles.
export async function setChannelReadOnlyAll(channel: TextChannel) {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: false });
  for (const rid of cfg.moderatorRoleIds) {
    await channel.permissionOverwrites.edit(rid, { SendMessages: false });
  }
}

// Re-open: user + mod roles can send again.
export async function setChannelOpenFor(openerId: string, channel: TextChannel) {
  await channel.permissionOverwrites.edit(openerId, { ViewChannel: true, SendMessages: true });
  for (const rid of cfg.moderatorRoleIds) {
    await channel.permissionOverwrites.edit(rid, { SendMessages: true });
  }
}

export async function lockUserSendPermissions(channel: TextChannel, userId: string) {
  await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: false });
}

export async function unlockUserSendPermissions(channel: TextChannel, userId: string) {
  await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true });
}

// Try to move to archive category if configured & valid. Silently no-op if not.
export async function moveToArchive(channel: TextChannel) {
  const id = cfg.ticketsArchiveCategoryId;
  if (!id) return;
  const cat = channel.guild.channels.cache.get(id) ?? await channel.guild.channels.fetch(id).catch(() => null);
  if (!cat || cat.type !== ChannelType.GuildCategory) return;
  await channel.setParent(id, { lockPermissions: false }).catch(() => {});
}

export function memberIsModerator(member: GuildMember): boolean {
  return cfg.moderatorRoleIds.some(rid => member.roles.cache.has(rid)) || member.permissions.has('Administrator');
}

// Utility to build staff overwrites for a newly created channel.
export function buildStaffOverwrites(): OverwriteResolvable[] {
  return cfg.moderatorRoleIds.map((rid): OverwriteResolvable => ({
    id: rid,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageMessages,
    ],
  }));
}
