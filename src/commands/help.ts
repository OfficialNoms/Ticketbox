/*
 * Ticketbox
 * File: src/commands/help.ts
 * Created by github.com/officialnoms
 * File Description: /help command handler
 */

import type { Interaction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

export async function handleHelpCommand(interaction: Interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'help') return false;

  const embed = new EmbedBuilder()
    .setTitle('📖 Ticketbox — Help')
    .setDescription('Quick guide to tickets and commands.')
    .addFields(
      {
        name: 'Users',
        value:
          '• **Open a ticket:** `/ticket open [subject]`\n' +
          '• **Mark resolved:** press **“My issue is resolved”** in your ticket\n' +
          '• **Not resolved:** press **“My issue isn’t resolved”** to request a reopen'
      },
      {
        name: 'Staff',
        value:
          '• **Open for a user:** `/ticket openfor @user [subject]`\n' +
          '• **On-duty toggle:** `/duty on`, `/duty off`, `/duty status`\n' +
          '• **Ticket actions:** use the **🛡️ Staff** buttons in the ticket (Resolve / Close / Reopen / Archive)'
      },
      {
        name: 'Notes',
        value:
          '• After **Resolve** or **Close**, the channel is read-only for everyone.\n' +
          '• After **Archive**, only staff can see the ticket.\n' +
          '• **Staff** controls are visible to all but only usable by moderators.'
      }
    )
    .setFooter({ text: 'Ticketbox' })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [embed], flags: 64 });
  return true;
}