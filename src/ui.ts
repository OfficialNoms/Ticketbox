/*
 * Ticketbox
 * File: src/ui.ts
 * Created by github.com/officialnoms
 * File Description: UI components and embeds
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import type { TicketState } from './tickets';

export function statusPill(s: TicketState) {
  return `\`${s}\``;
}

export function buildUserRow(state: TicketState) {
  const isOpen = state === 'OPEN';
  const isArchived = state === 'ARCHIVED';

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(isOpen ? 'ticket:user_resolve' : 'ticket:user_not_resolved')
      .setStyle(isOpen ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setLabel(isOpen ? 'My issue is resolved' : "My issue isn't resolved")
      .setDisabled(isArchived) // no user interaction once archived
  );
}

export function buildModRow(state: TicketState) {
  const isOpen = state === 'OPEN';
  const isPending = state === 'RESOLVED_PENDING_REVIEW';
  const isClosed = state === 'CLOSED';
  const isArchived = state === 'ARCHIVED';

  const disableAll = isArchived; // archived = nothing usable
  const canReopen = (isClosed || isPending) && !isArchived; // spec: allow reopen when CLOSED or PENDING, not ARCHIVED

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:mod_resolve')
      .setStyle(isPending ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(disableAll || isPending || isClosed)
      .setLabel('🛡️ Staff: Resolve'),

    new ButtonBuilder()
      .setCustomId('ticket:mod_close')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disableAll || isClosed)
      .setLabel('🛡️ Staff: Close'),

    new ButtonBuilder()
      .setCustomId('ticket:mod_archive')
      .setStyle(ButtonStyle.Secondary)
      // Enable archive only when ticket is CLOSED (and not archived)
      .setDisabled(!isClosed || isArchived)
      .setLabel('🛡️ Staff: Archive'),

    new ButtonBuilder()
      .setCustomId('ticket:mod_reopen')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canReopen)
      .setLabel('🛡️ Staff: Reopen')
  );
}

// Participant controls are disabled when archived
export function buildParticipantRow(state: TicketState) {
  const isArchived = state === 'ARCHIVED';
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:mod_add')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('🛡️ Staff: Add Participant')
      .setDisabled(isArchived),
    new ButtonBuilder()
      .setCustomId('ticket:mod_remove')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('🛡️ Staff: Remove Participant')
      .setDisabled(isArchived)
  );
}

export function buildHeaderEmbed(openerId: string, subject: string | null, state: TicketState) {
  return new EmbedBuilder()
    .setTitle('🎫 Ticket Created')
    .setDescription(subject ? `**Subject:** ${subject}` : 'Use this channel to describe your issue.')
    .addFields(
      { name: 'Opened by', value: `<@${openerId}>`, inline: true },
      { name: 'Status', value: statusPill(state), inline: true },
      {
        name: 'How this works',
        value:
          '• When your problem is fixed, press **“My issue is resolved.”**\n' +
          '• If it wasn’t actually fixed, press **“My issue isn’t resolved.”** to request a reopen.\n' +
          '• Controls labelled **🛡️ Staff** are visible to everyone but only moderators can use them.'
      }
    )
    .setFooter({ text: 'A moderator will assist you shortly.' })
    .setTimestamp(new Date());
}
