import { db, now } from '../db';
import type { TicketRow, TicketState } from './types';

// --- SQL (idempotent prepared statements) ---
const insertTicket = db.prepare(`
  INSERT INTO tickets (
    id, guild_id, channel_id, creator_user_id, target_user_id, subject, state,
    created_at, updated_at, added_participants, transcript_url, header_message_id,
    audit_message_id, closed_by_user_id, archived_by_user_id
  )
  VALUES (
    @id, @guild_id, @channel_id, @creator_user_id, @target_user_id, @subject, @state,
    @created_at, @updated_at, @added_participants, @transcript_url, @header_message_id,
    @audit_message_id, @closed_by_user_id, @archived_by_user_id
  )
`);
const selectByChannel = db.prepare(`SELECT * FROM tickets WHERE channel_id = ?`);
const selectById = db.prepare(`SELECT * FROM tickets WHERE id = ?`);
const updateStateStmt = db.prepare(`UPDATE tickets SET state = @state, updated_at = @updated_at WHERE id = @id`);
const writeClosedAtStmt = db.prepare(`UPDATE tickets SET closed_at = @ts, updated_at = @ts WHERE id = @id`);
const writeArchivedAtStmt = db.prepare(`UPDATE tickets SET archived_at = @ts, updated_at = @ts WHERE id = @id`);
const writeHeaderMessageIdStmt = db.prepare(`UPDATE tickets SET header_message_id = @mid WHERE id = @id`);
const writeParticipantsStmt = db.prepare(`UPDATE tickets SET added_participants = @list, updated_at = @ts WHERE id = @id`);
const writeAuditMessageIdStmt = db.prepare(`UPDATE tickets SET audit_message_id = @mid, updated_at = @ts WHERE id = @id`);
const writeTranscriptUrlStmt = db.prepare(`UPDATE tickets SET transcript_url = @url, updated_at = @ts WHERE id = @id`);
const writeClosedByStmt = db.prepare(`UPDATE tickets SET closed_by_user_id = @uid, updated_at = @ts WHERE id = @id`);
const writeArchivedByStmt = db.prepare(`UPDATE tickets SET archived_by_user_id = @uid, updated_at = @ts WHERE id = @id`);

export function insertTicketRow(row: Omit<TicketRow, 'transcript_url' | 'audit_message_id' | 'closed_by_user_id' | 'archived_by_user_id'> & {
  transcript_url?: string | null;
  audit_message_id?: string | null;
  closed_by_user_id?: string | null;
  archived_by_user_id?: string | null;
}) {
  insertTicket.run({
    ...row,
    transcript_url: row.transcript_url ?? null,
    audit_message_id: row.audit_message_id ?? null,
    closed_by_user_id: row.closed_by_user_id ?? null,
    archived_by_user_id: row.archived_by_user_id ?? null,
  });
}

export function getTicketByChannel(channelId: string): TicketRow | undefined {
  return selectByChannel.get(channelId) as TicketRow | undefined;
}

export function getTicketById(id: string): TicketRow | undefined {
  return selectById.get(id) as TicketRow | undefined;
}

export function setTicketState(ticketId: string, state: TicketState) {
  updateStateStmt.run({ id: ticketId, state, updated_at: now() });
}

export function writeClosedAt(ticketId: string) {
  writeClosedAtStmt.run({ id: ticketId, ts: now() });
}

export function writeArchivedAt(ticketId: string) {
  writeArchivedAtStmt.run({ id: ticketId, ts: now() });
}

export function saveHeaderMessageId(ticketId: string, messageId: string) {
  writeHeaderMessageIdStmt.run({ id: ticketId, mid: messageId });
}

export function writeParticipantList(ticketId: string, list: string[]) {
  writeParticipantsStmt.run({ id: ticketId, list: JSON.stringify(list), ts: now() });
}

export function writeAuditMessageId(ticketId: string, messageId: string) {
  writeAuditMessageIdStmt.run({ id: ticketId, mid: messageId, ts: now() });
}

export function writeTranscriptUrl(ticketId: string, url: string | null) {
  writeTranscriptUrlStmt.run({ id: ticketId, url, ts: now() });
}

export function writeClosedByUserId(ticketId: string, userId: string) {
  writeClosedByStmt.run({ id: ticketId, uid: userId, ts: now() });
}

export function writeArchivedByUserId(ticketId: string, userId: string) {
  writeArchivedByStmt.run({ id: ticketId, uid: userId, ts: now() });
}

export function saveAuditMessageId(ticketId: string, messageId: string) {
  const stmt = db.prepare(`UPDATE tickets SET audit_message_id = @mid WHERE id = @id`);
  stmt.run({ id: ticketId, mid: messageId });
}


export function parseParticipants(row: TicketRow): string[] {
  try {
    const arr = row.added_participants ? JSON.parse(row.added_participants) : [];
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}
