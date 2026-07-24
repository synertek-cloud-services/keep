import { describe, it, expect } from 'vitest';
import { slaState, computeResponseResolutionDueAt, computeTriageDueAt, TRANSITIONS, canLeaveTriage } from './sla';

describe('slaState', () => {
	it('returns none when there is no clock', () => {
		expect(slaState(1000, null, null)).toBe('none');
		expect(slaState(1000, 500, null)).toBe('none');
		expect(slaState(1000, null, 2000)).toBe('none');
	});

	it('returns breached once now has reached the due date', () => {
		expect(slaState(2000, 1000, 2000)).toBe('breached');
		expect(slaState(2500, 1000, 2000)).toBe('breached');
	});

	it('returns at_risk when 25% or less of the window remains', () => {
		// window = 1000s, due at 2000; at_risk once remaining <= 250s, i.e. now >= 1750
		expect(slaState(1750, 1000, 2000)).toBe('at_risk');
		expect(slaState(1900, 1000, 2000)).toBe('at_risk');
	});

	it('returns on_track when more than 25% of the window remains', () => {
		expect(slaState(1000, 1000, 2000)).toBe('on_track');
		expect(slaState(1500, 1000, 2000)).toBe('on_track');
		expect(slaState(1749, 1000, 2000)).toBe('on_track');
	});
});

describe('computeTriageDueAt', () => {
	it('adds triageMinutes (in seconds) to now', () => {
		expect(computeTriageDueAt(1000, 30)).toBe(1000 + 30 * 60);
	});
});

describe('computeResponseResolutionDueAt', () => {
	it('snapshots slaClockStartedAt at now and computes due dates from the given window', () => {
		const result = computeResponseResolutionDueAt(1000, { responseMinutes: 15, resolutionMinutes: 240 });
		expect(result).toEqual({
			slaClockStartedAt: 1000,
			responseDueAt: 1000 + 15 * 60,
			resolutionDueAt: 1000 + 240 * 60
		});
	});
});

describe('TRANSITIONS', () => {
	it('triage has no direct transitions — must exit via triageTicket', () => {
		expect(TRANSITIONS.triage).toEqual([]);
	});

	it('resolved can go to closed or reopen to in_progress', () => {
		expect(TRANSITIONS.resolved).toContain('closed');
		expect(TRANSITIONS.resolved).toContain('in_progress');
	});

	it('closed can only reopen to in_progress', () => {
		expect(TRANSITIONS.closed).toEqual(['in_progress']);
	});

	it('new cannot transition directly to closed', () => {
		expect(TRANSITIONS.new).not.toContain('closed');
	});
});

describe('canLeaveTriage', () => {
	it('accepts the four valid priorities', () => {
		expect(canLeaveTriage('critical')).toBe(true);
		expect(canLeaveTriage('high')).toBe(true);
		expect(canLeaveTriage('medium')).toBe(true);
		expect(canLeaveTriage('low')).toBe(true);
	});

	it('rejects null, undefined, or an invalid value', () => {
		expect(canLeaveTriage(null)).toBe(false);
		expect(canLeaveTriage(undefined)).toBe(false);
		expect(canLeaveTriage('urgent' as never)).toBe(false);
	});
});
