/*
 * Ticketbox
 * File: src/commands/duty.ts
 * Created by github.com/officialnoms
 * File Description: /duty command handler
 */

import type { Interaction } from 'discord.js';
import { listOnDutyMentions, setDuty, syncOnDutyRole } from '../duty';

export async function handleDutyCommand(interaction: Interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'duty') return false;
  if (!interaction.guild) {
    await interaction.reply({ content: 'Use this in a server.', flags: 64 });
    return true;
  }

  const sub = interaction.options.getSubcommand();
  await interaction.deferReply({ flags: 64 });

  if (sub === 'on' || sub === 'off') {
    const isOn = sub === 'on';
    setDuty(interaction.guild.id, interaction.user.id, isOn);
    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await syncOnDutyRole(member, isOn);
    } catch {}
    await interaction.editReply({
      content: isOn
        ? 'You are now **On Duty**. You’ll be pinged for new tickets.'
        : 'You are now **Off Duty**. You will not be pinged.'
    });
    return true;
  }

  if (sub === 'status') {
    const mentions = await listOnDutyMentions(interaction.guild);
    const msg = mentions.length ? `On-Duty: ${mentions.join(', ')}` : 'No one is currently On-Duty.';
    await interaction.editReply({ content: msg });
    return true;
  }

  return false;
}
