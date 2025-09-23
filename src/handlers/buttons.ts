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

const cfg = loadConfig();

export async function handleButton(interaction: Interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.guild || !interaction.channel) {
    await interaction.reply({ content: 'Use this in a server channel.', ephemeral: true });
    return true;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const channel = interaction.channel as TextChannel;
  const ticket = getTicketByChannel(channel.id);
  if (!ticket) {
    await interaction.reply({ content: 'This is not a Ticketbox channel.', ephemeral: true });
    return true;
  }

  await ensureDeferred(interaction);

  // Disallow any staff actions on archived tickets (belt-and-braces)
  const isArchived = ticket.state === 'ARCHIVED';

  // Open a user select for add/remove
  if (interaction.customId === 'ticket:mod_add' || interaction.customId === 'ticket:mod_remove') {
    if (!member || !memberIsModerator(member)) {
      await interaction.editReply({ content: 'Moderator only.' });
      return true;
    }
    if (isArchived) {
      await interaction.editReply({ content: 'Archived tickets are sealed; participants cannot be modified.' });
      return true;
    }

    const select = new USMB()
      .setCustomId(interaction.customId === 'ticket:mod_add' ? 'ticket:add_select' : 'ticket:remove_select')
      .setPlaceholder(interaction.customId === 'ticket:mod_add' ? 'Select a user to add' : 'Select a user to remove')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(select);
    await interaction.editReply({
      content: interaction.customId === 'ticket:mod_add'
        ? 'Choose a user to add to this ticket:'
        : 'Choose a user to remove from this ticket:',
      components: [row]
    });
    return true;
  }

  // USER: resolved
  if (interaction.customId === 'ticket:user_resolve') {
    const clicker = interaction.user.id;
    const allowed = clicker === ticket.creator_user_id || clicker === ticket.target_user_id;
    if (!allowed) {
      await interaction.editReply({ content: 'Only the ticket owner can mark it resolved.' });
      return true;
    }
    if (ticket.state !== 'OPEN') {
      await interaction.editReply({ content: `This ticket is already ${statusPill(ticket.state)}.` });
      return true;
    }
    try {
      await setChannelReadOnlyAll(channel);
      await lockUserSendPermissions(channel, ticket.target_user_id);

      await setTicketState(ticket.id, 'RESOLVED_PENDING_REVIEW');
      await refreshHeader(channel, ticket.id);
      await interaction.editReply({ content: '✅ Set to **RESOLVED_PENDING_REVIEW**. Mods will review and close.' });
      await logAction(interaction.guild, 'USER_RESOLVED', [
        { name: 'Ticket', value: `<#${channel.id}>` },
        { name: 'User', value: `<@${clicker}>`, inline: true }
      ]);

      const updated = getTicketByChannel(channel.id);
      if (updated) await updateAuditEntry(interaction.guild, updated);
    } catch (err: any) {
      await interaction.editReply({ content: `Failed: ${err.message ?? 'unknown error'}` });
    }
    return true;
  }

  // USER: not resolved (request reopen)
  if (interaction.customId === 'ticket:user_not_resolved') {
    const clicker = interaction.user.id;
    const allowed = clicker === ticket.creator_user_id || clicker === ticket.target_user_id;
    if (!allowed) {
      await interaction.editReply({ content: 'Only the ticket owner can request reopening.' });
      return true;
    }
    if (ticket.state === 'OPEN') {
      await interaction.editReply({ content: 'Ticket is already open.' });
      return true;
    }
    if (isArchived) {
      await interaction.editReply({ content: 'This ticket is archived and cannot be reopened.' });
      return true;
    }
    try {
      let pingText = `<@${clicker}> requested to reopen this ticket.`;
      const onDuty = await listOnDutyMentions(interaction.guild);
      if (onDuty.length > 0) {
        pingText += ' Notifying: ' + onDuty.join(' ');
      } else if (cfg.fallbackPingModeratorIfNoOnDuty) {
        for (const rid of cfg.moderatorRoleIds) pingText += ` <@&${rid}>`;
      }
      await channel.send({ content: `📣 ${pingText}` });
      await interaction.editReply({ content: '✅ Your reopen request was posted to the channel.' });

      await logAction(interaction.guild, 'USER_REOPEN_REQUEST', [
        { name: 'Ticket', value: `<#${channel.id}>` },
        { name: 'User', value: `<@${clicker}>`, inline: true },
        { name: 'State', value: statusPill(ticket.state), inline: true }
      ]);
    } catch (err: any) {
      await interaction.editReply({ content: `Failed: ${err.message ?? 'unknown error'}` });
    }
    return true;
  }

  // MOD: resolve
  if (interaction.customId === 'ticket:mod_resolve') {
    if (!member || !memberIsModerator(member)) {
      await interaction.editReply({ content: 'Moderator only.' });
      return true;
    }
    if (isArchived) {
      await interaction.editReply({ content: 'Archived tickets are sealed; cannot resolve.' });
      return true;
    }
    if (ticket.state === 'RESOLVED_PENDING_REVIEW') {
      await interaction.editReply({ content: 'Already in resolved-pending-review.' });
      return true;
    }
    try {
      await setChannelReadOnlyAll(channel);
      await lockUserSendPermissions(channel, ticket.target_user_id);

      await setTicketState(ticket.id, 'RESOLVED_PENDING_REVIEW');
      await refreshHeader(channel, ticket.id);
      await interaction.editReply({ content: '🔒 Set to **RESOLVED_PENDING_REVIEW**. User locked; ready to close.' });
      await logAction(interaction.guild, 'MOD_RESOLVE', [
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

  // MOD: close
  if (interaction.customId === 'ticket:mod_close') {
    if (!member || !memberIsModerator(member)) {
      await interaction.editReply({ content: 'Moderator only.' });
      return true;
    }
    if (isArchived) {
      await interaction.editReply({ content: 'Archived tickets are sealed; cannot close.' });
      return true;
    }
    try {
      await closeTicket(ticket.id, channel, interaction.user.id);
      await refreshHeader(channel, ticket.id);
      await interaction.editReply({ content: '🧷 **Closed**. Channel is now read-only for everyone.' });
      await logAction(interaction.guild, 'MOD_CLOSE', [
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

      // Generate & attach transcript (stores URL and updates embed to include "Transcript" field)
      updated = getTicketByChannel(channel.id);
      if (updated) {
        await attachTranscriptHTML(interaction.guild, updated);
      }
    } catch (err: any) {
      await interaction.editReply({ content: `Failed: ${err.message ?? 'unknown error'}` });
    }
    return true;
  }

  // MOD: reopen — (policy: your UI controls now handle availability)
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
