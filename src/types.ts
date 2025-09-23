export type TicketState = 'OPEN' | 'RESOLVED_PENDING_REVIEW' | 'CLOSED' | 'ARCHIVED';

export interface AppConfig {
  moderatorRoleIds: string[];
  onDutyRoleId: string; // empty string means disabled
  ticketsCategoryId: string;
  ticketsArchiveCategoryId: string;
  logChannelId: string;
  fallbackPingModeratorIfNoOnDuty: boolean;
}
