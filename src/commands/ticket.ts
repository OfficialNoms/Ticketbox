/*
 * Ticketbox
 * File: src/commands/ticket.ts
 * Created by github.com/officialnoms
 * File Description: /ticket command handler
 */

import type { Interaction, TextChannel } from 'discord.js';
import { EmbedBuilder, ChannelType } from 'discord.js';
import {
  createUserTicket,
  createTicketForTarget,
  getTicketByChannel,
  saveHeaderMessageId,
} from '../tickets';
import { listOnDutyMentions } from '../duty';
import { buildHeaderEmbed, buildUserRow, buildModRow, buildParticipantRow } from '../ui';
import { logAction } from '../log';
import { loadConfig } from '../config';
import { memberIsModerator } from '../tickets';
import { getGuildSettings } from '../settings';
import { ensureAuditEntry } from '../audit';

const cfg = loadConfig();

function preflightTicketCreate(interactionGuild: any) {
  const g = getGuildSettings(interactionGuild.id);
  const warnings: string[] = [];

  let parentId: string | null = null;
  if (g.tickets_category_id) {
    const cat = interactionGuild.channels.cache.get(g.tickets_category_id);
    if (cat && cat.type === ChannelType.GuildCategory) {
      parentId = g.tickets_category_id;
    } else {
      warnings.push('⚠️ Tickets category is not set correctly. Created the ticket at the server root. Run `/config validate` to fix.');
    }
  } else {
    warnings.push('⚠️ Tickets category is not configured. Created the ticket at the server root. Run `/config validate` to fix.');
  }

  return { parentId, warnings };
}

export async function handleTicketCommand(interaction: Interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'ticket') return false;
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    return true;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'open') {
    const subject = interaction.options.getString('subject') ?? null;
    await interaction.deferReply({ flags: 64 });

    const { parentId, warnings } = preflightTicketCreate(interaction.guild);

    try {
      const channel = await createUserTicket(
        interaction.guild,
        interaction.user.id,
        subject ?? undefined,
        { parentCategoryId: parentId }
      );

      const msg = await sendHeader(channel as TextChannel, interaction.user.id, subject);
      const ticket = getTicketByChannel(channel.id)!;
      saveHeaderMessageId(ticket.id, msg.id);

      // 🔎 ensure one-message audit entry exists now
      await ensureAuditEntry(interaction.guild, ticket);

      const extra = warnings.length ? `\n${warnings.join('\n')}` : '';
      await interaction.editReply({ content: `Your ticket is ready: ${channel}${extra}` });

      await logAction(interaction.guild, 'OPEN', [
        { name: 'Ticket', value: `<#${(channel as TextChannel).id}>` },
        { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
        ...(subject ? [{ name: 'Subject', value: subject }] : [])
      ]);
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to create ticket: ${err.message ?? 'unknown error'}` });
    }
    return true;
  }

  if (sub === 'openfor') {
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !memberIsModerator(member)) {
      await interaction.reply({ content: 'Moderator only.', flags: 64 });
      return true;
    }

    const target = interaction.options.getUser('user', true);
    const subject = interaction.options.getString('subject') ?? null;

    await interaction.deferReply({ flags: 64 });

    const { parentId, warnings } = preflightTicketCreate(interaction.guild);

    try {
      const channel = await createTicketForTarget(
        interaction.guild,
        interaction.user.id,
        target.id,
        subject ?? undefined,
        { parentCategoryId: parentId }
      );

      const embed = new EmbedBuilder()
        .setTitle('🎫 Ticket Created')
        .setDescription(subject ? `**Subject:** ${subject}` : 'Use this channel to discuss the issue.')
        .addFields(
          { name: 'Opened by (mod)', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Target user', value: `<@${target.id}>`, inline: true },
          { name: 'Status', value: '`OPEN`', inline: true }
        )
        .setTimestamp(new Date());

      let pingText = `<@${target.id}>`;
      const onDuty = await listOnDutyMentions(interaction.guild);
      if (onDuty.length > 0) {
        pingText += ' ' + onDuty.join(' ');
      } else if (cfg.fallbackPingModeratorIfNoOnDuty) {
        for (const rid of cfg.moderatorRoleIds) {
          pingText += ` <@&${rid}>`;
        }
      }

      const msg = await (channel as TextChannel).send({
        content: pingText,
        embeds: [embed],
        components: [buildUserRow('OPEN'), buildModRow('OPEN'), buildParticipantRow('OPEN')]
      });

      const t = getTicketByChannel(channel.id)!;
      saveHeaderMessageId(t.id, msg.id);

      // 🔎 ensure one-message audit entry exists now
      await ensureAuditEntry(interaction.guild, t);

      const extra = warnings.length ? `\n${warnings.join('\n')}` : '';
      await interaction.editReply({ content: `Opened ticket for ${target} → ${channel}${extra}` });

      await logAction(interaction.guild, 'OPEN_FOR', [
        { name: 'Ticket', value: `<#${(channel as TextChannel).id}>` },
        { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Target', value: `<@${target.id}>`, inline: true },
        ...(subject ? [{ name: 'Subject', value: subject }] : [])
      ]);
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to create ticket: ${err.message ?? 'unknown error'}` });
    }
    return true;
  }

  return false;
}

async function sendHeader(channel: TextChannel, openerId: string, subject: string | null) {
  let pingText = `<@${openerId}>`;
  const onDuty = await listOnDutyMentions(channel.guild);
  if (onDuty.length > 0) {
    pingText += ' ' + onDuty.join(' ');
  } else if (cfg.fallbackPingModeratorIfNoOnDuty) {
    for (const rid of cfg.moderatorRoleIds) {
      pingText += ` <@&${rid}>`;
    }
  }

  const msg = await channel.send({
    content: pingText,
    embeds: [buildHeaderEmbed(openerId, subject, 'OPEN')],
    components: [buildUserRow('OPEN'), buildModRow('OPEN'), buildParticipantRow('OPEN')]
  });
  return msg;
}
