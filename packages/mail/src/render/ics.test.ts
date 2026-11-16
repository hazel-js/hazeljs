import { renderIcs } from './ics';

describe('renderIcs', () => {
  it('builds a VEVENT payload', () => {
    const ics = renderIcs({
      uid: 'evt-1',
      summary: 'Demo, meeting',
      description: 'Line1\nLine2',
      location: 'HQ',
      start: new Date('2024-01-01T10:00:00Z'),
      end: new Date('2024-01-01T11:00:00Z'),
      organizer: 'org@example.com',
      attendees: ['a@example.com'],
    });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:evt-1');
    expect(ics).toContain('SUMMARY:Demo\\, meeting');
    expect(ics).toContain('ORGANIZER:mailto:org@example.com');
    expect(ics).toContain('ATTENDEE:mailto:a@example.com');
  });
});
