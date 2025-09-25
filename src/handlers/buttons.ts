import type { Interaction, TextChannel, UserSelectMenuBuilder } from 'discord.js';
import { ActionRowBuilder, UserSelectMenuBuilder as USMB } from 'discord.js';
import {
  getTicketByChannel,
  lockUserSendPermissions,
  unlockUserSendPermissions,
  setTicketState,
  setChannelReadOnlyAll,
  setChannelOpenFor,
  memberIsModerator,
  closeTicket,
  archiveTicket,
} from '../tickets';
import { statusPill } from '../ui';
import { listOnDutyMentions } from '../duty';
import { logAction } from '../log';
import { loadConfig } from '../config';
import { ensureDeferred } from './common';
import { updateAuditEntry, attachTranscriptHTML } from '../audit';
import { getGuildSettings } from '../settings';

const cfg = loadConfig();

export async function handleButton(interaction: Interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.guild || !interaction.channel) {
    await interaction.reply({ content: 'Use this in a server channel.', flags: 64 });
    return true;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const channel = interaction.channel as TextChannel;
  const ticket = getTicketByChannel(channel.id);
  if (!ticket) {
    await interaction.reply({ content: 'This is not a Ticketbox channel.', flags: 64 });
    return true;
  }

  await ensureDeferred(interaction);

  const isArchived = ticket.state === 'ARCHIVED';

  // ... (UNCHANGED: add/remove select, user resolve, user not resolved, mod resolve, mod close)

  // MOD: archive
  if (interaction.customId === 'ticket:mod_archive') {
    if (!member || !memberIsModerator(member)) {
      await interaction.editReply({ content: 'Moderator only.' });
      return true;
    }
    if (isArchived) {
      await interaction.editReply({ content: 'Already archived.' });
      return true;
    }
    try {
      const row = getTicketByChannel(channel.id)!;
      await archiveTicket(ticket.id, channel, row, interaction.user.id);
      await refreshHeader(channel, ticket.id);
      await interaction.editReply({ content: '📦 **Archived**. Only staff retain access.' });
      await logAction(interaction.guild, 'MOD_ARCHIVE', [
        { name: 'Ticket', value: `<#${channel.id}>` },
        { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
      ]);

      // Refresh audit entry (shows status + archiver)
      let updated = getTicketByChannel(channel.id);
      if (updated) await updateAuditEntry(interaction.guild, updated);

      // Generate & attach transcript if enabled
      const g = getGuildSettings(interaction.guild.id);
      if (g.transcript_enabled) {
        updated = getTicketByChannel(channel.id);
        if (updated) {
          await attachTranscriptHTML(interaction.guild, updated);
        }
      }
    } catch (err: any) {
      await interaction.editReply({ content: `Failed: ${err.message ?? 'unknown error'}` });
    }
    return true;
  }

  // MOD: reopen
  if (interaction.customId === 'ticket:mod_reopen') {
    if (!member || !memberIsModerator(member)) {
      await interaction.editReply({ content: 'Moderator only.' });
      return true;
    }
    if (isArchived) {
      await interaction.editReply({ content: 'Archived tickets cannot be reopened.' });
      return true;
    }
    try {
      await setTicketState(ticket.id, 'OPEN');
      await setChannelOpenFor(ticket.target_user_id, channel);
      await unlockUserSendPermissions(channel, ticket.target_user_id);
      await refreshHeader(channel, ticket.id);
      await interaction.editReply({ content: '♻️ **Reopened**. User and staff can speak again.' });
      await logAction(interaction.guild, 'MOD_REOPEN', [
        { name: 'Ticket', value: `<#${channel.id}>` },
        { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
      ]);

      const updated = getTicketByChannel(channel.id);
      if (updated) await updateAuditEntry(interaction.guild, updated);
    } catch (err: any) {
      await interaction.editReply({ content: `Failed: ${err.message ?? 'unknown error'}` });
    }
    return true;
  }

  return false;
}

async function refreshHeader(channel: TextChannel, ticketId: string) {
  const { getTicketByChannel, saveHeaderMessageId } = await import('../tickets');
  const { buildHeaderEmbed, buildUserRow, buildModRow, buildParticipantRow } = await import('../ui');

  const ticket = getTicketByChannel(channel.id)!;
  const header = ticket.header_message_id ? await channel.messages.fetch(ticket.header_message_id).catch(() => null) : null;
  const embed = buildHeaderEmbed(ticket.target_user_id, ticket.subject, ticket.state);
  const components = [buildUserRow(ticket.state), buildModRow(ticket.state), buildParticipantRow(ticket.state)];

  if (header) {
    await header.edit({ embeds: [embed], components });
  } else {
    const msg = await channel.send({ embeds: [embed], components });
    saveHeaderMessageId(ticket.id, msg.id);
  }
}
