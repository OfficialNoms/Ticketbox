import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig } from './types';

const CONFIG_PATH = path.resolve(process.cwd(), 'config.json');

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error('Missing config.json at project root. Create it with your role/category/channel IDs.');
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const json: any = JSON.parse(raw);

  const required = [
    'moderatorRoleIds',
    'ticketsCategoryId',
    'ticketsArchiveCategoryId',
    'logChannelId',
    'fallbackPingModeratorIfNoOnDuty'
  ] as const;

  for (const k of required) {
    if (json[k] === undefined) throw new Error(`config.json missing required key: ${k}`);
  }

  // normalize legacy/single values
  if (!Array.isArray(json.moderatorRoleIds)) {
    if (typeof json.moderatorRoleIds === 'string') {
      json.moderatorRoleIds = [json.moderatorRoleIds];
    } else {
      throw new Error('moderatorRoleIds must be an array of role IDs (strings)');
    }
  }

  if (typeof json.onDutyRoleId !== 'string') json.onDutyRoleId = '';

  cached = json as AppConfig;
  return cached;
}
