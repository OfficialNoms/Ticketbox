/*
 * Ticketbox
 * File: src/tickets/index.ts
 * Created by github.com/officialnoms
 * File Description: Main export file for ticket-related functions and types
 */

// Re-export public types
export type { TicketState, TicketRow } from './types';

// Store-level operations
export {
  getTicketByChannel,
  getTicketById,
  setTicketState,
  saveHeaderMessageId,
  writeParticipantList, // not used externally, but OK if needed
  parseParticipants,    // same
} from './store';

// Permission-level operations
export {
  setChannelReadOnlyAll,
  setChannelOpenFor,
  lockUserSendPermissions,
  unlockUserSendPermissions,
  moveToArchive,
  memberIsModerator,
} from './permissions';

// Participant helpers
export { addParticipant, removeParticipant } from './participants';

// Creation helpers
export { createUserTicket, createTicketForTarget } from './create';

// Higher-level ticket ops that depend on multiple modules
import type { TextChannel } from 'discord.js';
import {
  setTicketState as _set,
  writeClosedAt,
  writeArchivedAt,
  parseParticipants,
  writeClosedByUserId,
  writeArchivedByUserId,
} from './store';
import { setChannelReadOnlyAll as _readOnly, moveToArchive as _moveToArchive } from './permissions';
import type { TicketRow } from './types';

export async function closeTicket(ticketId: string, channel: TextChannel, closedByUserId: string) {
  _set(ticketId, 'CLOSED');
  writeClosedAt(ticketId);
  writeClosedByUserId(ticketId, closedByUserId);
  await _readOnly(channel);
}

export async function archiveTicket(ticketId: string, channel: TextChannel, ticketRow: TicketRow, archivedByUserId: string) {
  _set(ticketId, 'ARCHIVED');
  writeArchivedAt(ticketId);
  writeArchivedByUserId(ticketId, archivedByUserId);

  // Remove opener, target, and added participants
  const toRemove = new Set<string>([
    ticketRow.creator_user_id,
    ticketRow.target_user_id,
    ...parseParticipants(ticketRow),
  ]);
  for (const uid of toRemove) {
    await channel.permissionOverwrites.delete(uid).catch(() => {});
  }

  await _readOnly(channel);
  await _moveToArchive(channel);
}
