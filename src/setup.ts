import {
  ChannelType,
  EmbedBuilder,
  Guild,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { _getGuildConfig, _upsertGuildConfig, now } from './db';
import { loadConfig } from './config';

const fileCfg = loadConfig();

/**
 * Create an initial guild_config row if one does not exist.
 * Returns true if we created a new row (i.e., first-time setup), false otherwise.
 */
async function ensureGuildConfig(guild: Guild): Promise<boolean> {
  const existing = _getGuildConfig.get(guild.id) as any | undefined;
  if (existing) return false;

  const payload = {
    guild_id: guild.id,
    moderator_role_ids: JSON.stringify(fileCfg.moderatorRoleIds ?? []),
    on_duty_role_id: (fileCfg.onDutyRoleId?.trim() || '') || null,
    tickets_category_id: (fileCfg.ticketsCategoryId?.trim() || '') || null,
    tickets_archive_category_id: (fileCfg.ticketsArchiveCategoryId?.trim() || '') || null,
    log_channel_id: (fileCfg.logChannelId?.trim() || '') || null,
    audit_log_channel_id: null, // force explicit selection
    fallback_ping_mod_if_no_on_duty: fileCfg.fallbackPingModeratorIfNoOnDuty ? 1 : 0,
    transcript_enabled: 1, // default ON
    updated_at: now(),
  };

  _upsertGuildConfig.run(payload);
  return true;
}

/** Pick a text channel we can send to: system channel if usable, else the first writable text channel. */
async function pickSetupChannel(guild: Guild): Promise<TextChannel | null> {
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me) return null;

  const canSend = (ch: any) => {
    const perms = ch.permissionsFor(me);
    return perms?.has(PermissionFlagsBits.ViewChannel) && perms?.has(PermissionFlagsBits.SendMessages);
  };

  const sys = guild.systemChannel;
  if (sys && sys.type === ChannelType.GuildText && canSend(sys)) return sys as TextChannel;

  // fallback: first text channel we can write to
  for (const ch of guild.channels.cache.values()) {
    if (ch?.type === ChannelType.GuildText && canSend(ch)) {
      return ch as TextChannel;
    }
  }
  return null;
}

/** Post a concise setup message with the essential /config steps. */
async function postSetupMessage(guild: Guild): Promise<void> {
  const ch = await pickSetupChannel(guild);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle('👋 Ticketbox — First-time setup')
    .setDescription(
      'Thanks for adding Ticketbox! A default config row has been created. ' +
      'Finish setup with the following commands (Admin/Manage Server only):'
    )
    .addFields(
      {
        name: '1) Audit log channel (required)',
        value: 'Create/choose a channel (e.g., **#ticket-audit**) then:\n' +
               '```/config set setting:audit_log_channel_id value:#ticket-audit```',
      },
      {
        name: '2) Ticket categories (recommended)',
        value:
          'Create two categories (e.g., **Tickets** and **Tickets Archive**), then set:\n' +
          '```/config set setting:tickets_category_id value:<#categoryId>```\n' +
          '```/config set setting:tickets_archive_category_id value:<#categoryId>```',
      },
      {
        name: '3) Moderator roles (recommended)',
        value:
          'Set one or more staff roles that can act on tickets:\n' +
          '```/config set setting:moderator_role_ids value:@Mods @Support```',
      },
      {
        name: '4) Optional settings',
        value:
          'On-duty role: ```/config set setting:on_duty_role_id value:@OnDuty```\n' +
          'Ping mods if no on-duty: ```/config set setting:fallback_ping_mod_if_no_on_duty value:on|off```\n' +
          'Transcripts on archive: ```/config set setting:transcript_enabled value:on|off```',
      },
      {
        name: 'Check current settings',
        value: '```/config show```',
      }
    )
    .setFooter({ text: 'Tip: Use /ticket open to test a ticket once setup is complete.' })
    .setTimestamp(new Date());

  await ch.send({ embeds: [embed] }).catch(() => {});
}

/** Public entry: ensure config exists, and post a one-time setup message when we just created it. */
export async function bootstrapGuild(guild: Guild): Promise<void> {
  const created = await ensureGuildConfig(guild);
  if (created) {
    await postSetupMessage(guild);
  }
}
