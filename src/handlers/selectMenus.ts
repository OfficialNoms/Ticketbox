import type { TextChannel, Interaction } from 'discord.js';
import { getTicketByChannel, addParticipant, removeParticipant, memberIsModerator } from '../tickets';
import { logAction } from '../log';

export async function handleUserSelectMenu(interaction: Interaction) {
  if (!interaction.isUserSelectMenu()) return false;
  if (!interaction.guild || !interaction.channel) {
    await interaction.reply({ content: 'Use this in a server channel.', ephemeral: true });
    return true;
  }

  const channel = interaction.channel as TextChannel;
  const ticket = getTicketByChannel(channel.id);
  if (!ticket) {
    await interaction.reply({ content: 'This is not a Ticketbox channel.', ephemeral: true });
    return true;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member || !memberIsModerator(member)) {
    await interaction.reply({ content: 'Moderator only.', ephemeral: true });
    return true;
  }

  const selected = interaction.values?.[0];
  if (!selected) {
    await interaction.reply({ content: 'No user selected.', ephemeral: true });
    return true;
  }

  if (interaction.customId === 'ticket:add_select') {
    try {
      await addParticipant(channel, ticket, selected);
      await channel.send({ content: `✅ <@${interaction.user.id}> added <@${selected}> to this ticket.` });
      await interaction.update({ content: `✅ Added <@${selected}> to this ticket.`, components: [] });
      await logAction(interaction.guild, 'ADD_PARTICIPANT', [
        { name: 'Ticket', value: `<#${channel.id}>` },
        { name: 'Actor', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Participant', value: `<@${selected}>`, inline: true }
      ]);
    } catch (err: any) {
      await interaction.update({ content: `Failed to add: ${err.message ?? 'unknown error'}`, components: [] });
    }
    return true;
  }

  if (interaction.customId === 'ticket:remove_select') {
    try {
      await removeParticipant(channel, ticket, selected);
      await channel.send({ content: `➖ <@${interaction.user.id}> removed <@${selected}> from this ticket (if they were added).` });
      await interaction.update({ content: `➖ Removed <@${selected}> (if they were added).`, components: [] });
      await logAction(interaction.guild, 'REMOVE_PARTICIPANT', [
        { name: 'Ticket', value: `<#${channel.id}>` },
        { name: 'Actor', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Participant', value: `<@${selected}>`, inline: true }
      ]);
    } catch (err: any) {
      await interaction.update({ content: `Failed to remove: ${err.message ?? 'unknown error'}`, components: [] });
    }
    return true;
  }

  return false;
}
