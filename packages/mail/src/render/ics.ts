import type { MailIcsPart } from '../types/email-document';

function toIcsDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Build a minimal iCalendar VEVENT payload. */
export function renderIcs(ics: MailIcsPart): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HazelJS Mail//EN',
    `METHOD:${ics.method ?? 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${ics.uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(ics.start)}`,
    `DTEND:${toIcsDate(ics.end)}`,
    `SUMMARY:${escapeIcs(ics.summary)}`,
  ];
  if (ics.description) {
    lines.push(`DESCRIPTION:${escapeIcs(ics.description)}`);
  }
  if (ics.location) {
    lines.push(`LOCATION:${escapeIcs(ics.location)}`);
  }
  if (ics.organizer) {
    lines.push(`ORGANIZER:mailto:${ics.organizer}`);
  }
  for (const attendee of ics.attendees ?? []) {
    lines.push(`ATTENDEE:mailto:${attendee}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
