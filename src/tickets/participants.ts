/*
 * Ticketbox
 * File: src/tickets/participants.ts
 * Created by github.com/officialnoms
 * File Description: Participant management functions
 */

import type { TextChannel } from 'discord.js';
import { PermissionsBitField } from 'discord.js';
import { loadConfig } from '../config';
import { parseParticipants, writeParticipantList } from './store';
import type { TicketRow } from './types';

const cfg = loadConfig();

export async function addParticipant(channel: TextChannel, ticket: TicketRow, userId: string) {
  await channel.permissionOverwrites.edit(userId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });

  const current = parseParticipants(ticket);
  if (!current.includes(userId)) {
    current.push(userId);
    writeParticipantList(ticket.id, current);
  }
}

export async function removeParticipant(channel: TextChannel, ticket: TicketRow, userId: string) {
  const guildMember = await channel.guild.members.fetch(userId).catch(() => null);
  if (!guildMember) return;

  const isOpener = userId === ticket.creator_user_id || userId === ticket.target_user_id;
  const isMod =
    cfg.moderatorRoleIds.some(rid => guildMember.roles.cache.has(rid)) ||
    guildMember.permissions.has(PermissionsBitField.Flags.Administrator);
  if (isOpener || isMod) return;

  await channel.permissionOverwrites.delete(userId).catch(() => {});
  const current = parseParticipants(ticket).filter(id => id !== userId);
  writeParticipantList(ticket.id, current);
}
