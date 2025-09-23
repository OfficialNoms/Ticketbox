import { Guild, GuildMember } from 'discord.js';
import { db, now } from './db.js';
import { loadConfig } from './config.js';

const cfg = loadConfig();

const upsertDuty = db.prepare(`
  INSERT INTO duty (guild_id, user_id, is_on_duty, updated_at)
  VALUES (@guild_id, @user_id, @is_on_duty, @updated_at)
  ON CONFLICT(guild_id, user_id) DO UPDATE SET
    is_on_duty=excluded.is_on_duty,
    updated_at=excluded.updated_at
`);

const selectOnDuty = db.prepare(`
  SELECT user_id FROM duty WHERE guild_id = ? AND is_on_duty = 1
`);

export function setDuty(guildId: string, userId: string, isOn: boolean) {
  upsertDuty.run({
    guild_id: guildId,
    user_id: userId,
    is_on_duty: isOn ? 1 : 0,
    updated_at: now()
  });
}

export function getOnDutyUserIds(guildId: string): string[] {
  return selectOnDuty.all(guildId).map(r => r.user_id as string);
}

// Optional role sync
export async function syncOnDutyRole(member: GuildMember, isOn: boolean) {
  const roleId = cfg.onDutyRoleId?.trim();
  if (!roleId) return; // disabled

  const role = member.guild.roles.cache.get(roleId) ?? await member.guild.roles.fetch(roleId).catch(() => null);
  if (!role) return;

  const has = member.roles.cache.has(role.id);
  if (isOn && !has) {
    await member.roles.add(role).catch(() => {});
  } else if (!isOn && has) {
    await member.roles.remove(role).catch(() => {});
  }
}

export async function listOnDutyMentions(guild: Guild): Promise<string[]> {
  const ids = getOnDutyUserIds(guild.id);
  return ids.map(id => `<@${id}>`);
}
