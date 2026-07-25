/**
 * Fictional demo worlds for Keep. Same five themes as Beacon's
 * scripts/demo-worlds.mjs (Matrix, Minecraft, Holy Grail, Fallout, Star
 * Trek) for consistency across the product suite — a demo environment
 * reads as one story whether you're looking at Beacon devices or Keep
 * tickets for the same world. Data-only definitions: the seed runner
 * supplies IDs, timestamps, and SQL. Do not add assets, logos, or dialogue
 * excerpts from the source material.
 *
 * Every world shares the same 15-row ticket BLUEPRINT (status/priority/
 * category/assignment/SLA-demo-state pattern) so every dashboard widget
 * gets meaningful data regardless of which world is seeded — only the
 * company/tech names and ticket titles vary per world.
 */

// company index (0/1/2) for each of the 15 ticket rows — simple round robin.
const ROW_COMPANY = [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2];

// tech index (0/1/2) or null (unassigned) for each row.
const ROW_TECH = [null, null, null, null, 0, 1, 2, 0, 1, null, null, 2, 0, 1, 2];

const ROW_CATEGORY = [
	'computer', 'network', 'secops',
	'computer', 'server', 'network',
	'secops', 'computer', 'server',
	'network', 'computer', 'secops',
	'server', 'computer', 'network'
];
const ROW_SUBTYPE = [
	'hardware', 'wifi', 'av-malware-alert',
	'software', 'active-directory', 'vpn',
	'anomalous-logon', 'peripherals', 'dns',
	'firewall', 'user-management', 'phishing-report',
	'software', 'hardware', 'switching-routing'
];
const ROW_STATUS = [
	'triage', 'triage', 'triage',
	'new', 'new', 'in_progress',
	'in_progress', 'waiting_on_client', 'waiting_on_vendor',
	'in_progress', 'new', 'waiting_on_client',
	'resolved', 'closed', 'resolved'
];
const ROW_PRIORITY = [
	null, null, null,
	'critical', 'high', 'critical',
	'medium', 'low', 'high',
	'medium', 'low', 'critical',
	'medium', 'low', 'high'
];
const ROW_NEEDS_ATTENTION = [
	false, false, false,
	false, true, false,
	false, true, false,
	false, false, true,
	false, false, false
];
// SLA demo state — drives how buildWorldSql back-computes slaClockStartedAt/
// responseDueAt/resolutionDueAt so the dashboard's SLA breach/at-risk
// widgets have real, deterministic data to show. 'triage' rows use
// triageAgeMinutes instead (see TRIAGE_AGE_MINUTES). 'none' rows are the
// resolved/closed history tickets (see HISTORY_DAYS_AGO).
const ROW_SLA_DEMO = [
	'triage', 'triage', 'triage',
	'response_breached', 'response_at_risk', 'resolution_breached',
	'resolution_at_risk', 'on_track', 'on_track',
	'on_track', 'on_track', 'resolution_at_risk',
	'none', 'none', 'none'
];
const TRIAGE_AGE_MINUTES = { 0: 5, 1: 25, 2: 45 }; // row index -> minutes ago
const HISTORY_DAYS_AGO = { 12: 4, 13: 7, 14: 2 }; // row index -> days ago

export const BLUEPRINT = {
	rowCount: 15,
	company: ROW_COMPANY,
	tech: ROW_TECH,
	category: ROW_CATEGORY,
	subtype: ROW_SUBTYPE,
	status: ROW_STATUS,
	priority: ROW_PRIORITY,
	needsAttention: ROW_NEEDS_ATTENTION,
	slaDemo: ROW_SLA_DEMO,
	triageAgeMinutes: TRIAGE_AGE_MINUTES,
	historyDaysAgo: HISTORY_DAYS_AGO
};

function world(id, title, description, companies, techs, titles) {
	return { id, title, description, companies, techs, titles };
}

export const WORLDS = {
	matrix: world(
		'matrix',
		'The Matrix',
		'Zion and hovercraft operations',
		[
			{ key: 'zion', name: 'Zion Council', contact: 'Commander Lock' },
			{ key: 'nebuchadnezzar', name: 'Nebuchadnezzar Crew', contact: 'Morpheus' },
			{ key: 'oracle', name: 'Oracle Network', contact: 'The Oracle' }
		],
		[
			{ key: 'neo', name: 'Neo' },
			{ key: 'trinity', name: 'Trinity' },
			{ key: 'switch', name: 'Switch' }
		],
		[
			"Zion Council workstation won't power on after blackout drill",
			'Nebuchadnezzar bridge Wi-Fi dropping mid-dive',
			'Oracle Network AV alert on the prediction relay',
			"Zion Council user can't launch Construct simulation software",
			'Nebuchadnezzar Active Directory login failures for crew accounts',
			'Oracle Network VPN tunnel to Zion mainframe is down',
			'Zion Council anomalous logon detected on operator console',
			"Nebuchadnezzar field laptop mouse unresponsive",
			'Oracle Network DNS resolution failing for simulation queries',
			'Zion Council firewall blocking sentinel tracking feed',
			'Nebuchadnezzar new crew member needs console access',
			'Oracle Network phishing email reported by staff',
			'Zion Council archive server software update completed',
			'Nebuchadnezzar bridge console mouse replaced',
			'Oracle Network relay switch replaced after outage'
		]
	),

	minecraft: world(
		'minecraft',
		'Minecraft',
		'Overworld, Nether, and End operations',
		[
			{ key: 'overworld', name: 'Overworld Villages', contact: 'Village Librarian' },
			{ key: 'nether', name: 'Nether Transit Authority', contact: 'Piglin Quartermaster' },
			{ key: 'end', name: 'End Research Expedition', contact: 'Ender Researcher' }
		],
		[
			{ key: 'steve', name: 'Steve' },
			{ key: 'alex', name: 'Alex' },
			{ key: 'jeb', name: 'Jeb' }
		],
		[
			"Overworld Villages trade ledger workstation won't boot",
			'Nether Transit Authority portal gateway Wi-Fi dropping',
			'End Research Expedition AV alert on the ender relay',
			'Overworld Villages redstone controller software crashing',
			'Nether Transit Authority Active Directory login failures',
			'End Research Expedition VPN tunnel to stronghold is down',
			'Overworld Villages anomalous logon on the trade ledger',
			'Nether Transit Authority blaze ops laptop mouse unresponsive',
			'End Research Expedition DNS resolution failing for mapping station',
			'Overworld Villages firewall blocking iron farm monitor feed',
			'Nether Transit Authority new quartermaster needs ledger access',
			'End Research Expedition phishing email reported by researcher',
			'Overworld Villages redstone controller software update completed',
			'Nether Transit Authority barter ledger mouse replaced',
			'End Research Expedition dragon watch switch replaced after outage'
		]
	),

	'holy-grail': world(
		'holy-grail',
		'Monty Python and the Holy Grail',
		'Arthurian quest operations',
		[
			{ key: 'camelot', name: 'Camelot', contact: 'King Arthur' },
			{ key: 'swamp', name: 'Swamp Castle', contact: 'Sir Lancelot' },
			{ key: 'anthrax', name: 'Castle Anthrax', contact: 'Zoot' }
		],
		[
			{ key: 'galahad', name: 'Sir Galahad' },
			{ key: 'robin', name: 'Sir Robin' },
			{ key: 'patsy', name: 'Patsy' }
		],
		[
			"Camelot round table console won't power on",
			'Swamp Castle bridge Wi-Fi dropping during siege drill',
			'Castle Anthrax AV alert on the reception desk',
			'Camelot grail archive software crashing',
			'Swamp Castle Active Directory login failures for guards',
			'Castle Anthrax VPN tunnel to Camelot is down',
			'Camelot anomalous logon on the round table console',
			'Swamp Castle quest laptop mouse unresponsive',
			'Castle Anthrax DNS resolution failing for quest map station',
			'Camelot firewall blocking knights relay feed',
			'Swamp Castle new guard needs bridge console access',
			'Castle Anthrax phishing email reported by Zoot',
			'Camelot grail archive software update completed',
			'Swamp Castle bridge console mouse replaced',
			'Castle Anthrax rabbit watch switch replaced after outage'
		]
	),

	fallout: world(
		'fallout',
		'Fallout',
		'Mojave and Vault-Tec operations',
		[
			{ key: 'vault33', name: 'Vault 33', contact: 'Vault Overseer' },
			{ key: 'newvegas', name: 'New Vegas', contact: 'Mr. House' },
			{ key: 'ncr', name: 'NCR Mojave Outpost', contact: 'NCR Quartermaster' }
		],
		[
			{ key: 'veronica', name: 'Veronica' },
			{ key: 'boone', name: 'Boone' },
			{ key: 'arcade', name: 'Arcade Gannon' }
		],
		[
			"Vault 33 administration terminal won't power on",
			'New Vegas Lucky 38 core Wi-Fi dropping',
			'NCR Mojave Outpost AV alert on the command desk',
			'Vault 33 water chip controller software crashing',
			'New Vegas Active Directory login failures for securitrons',
			'NCR Mojave Outpost VPN tunnel to Hoover Dam is down',
			'Vault 33 anomalous logon on the administration terminal',
			'New Vegas ranger field laptop mouse unresponsive',
			'NCR Mojave Outpost DNS resolution failing for command desk',
			'Vault 33 firewall blocking water chip controller feed',
			'New Vegas new securitron operator needs console access',
			'NCR Mojave Outpost phishing email reported by quartermaster',
			'Vault 33 communications server software update completed',
			'New Vegas strip relay mouse replaced',
			'NCR Mojave Outpost Hoover sensor switch replaced after outage'
		]
	),

	'star-trek': world(
		'star-trek',
		'Star Trek',
		'Federation fleet and starbase operations',
		[
			{ key: 'academy', name: 'Starfleet Academy', contact: 'Academy Operations' },
			{ key: 'enterprise', name: 'USS Enterprise', contact: 'Captain Pike' },
			{ key: 'ds9', name: 'Deep Space 9', contact: 'Station Operations' }
		],
		[
			{ key: 'scotty', name: 'Scotty' },
			{ key: 'geordi', name: 'Geordi La Forge' },
			{ key: 'belanna', name: "B'Elanna Torres" }
		],
		[
			"Starfleet Academy cadet lab workstation won't power on",
			'USS Enterprise bridge console Wi-Fi dropping',
			'Deep Space 9 AV alert on the infirmary console',
			'Starfleet Academy holodeck simulator software crashing',
			'USS Enterprise Active Directory login failures for crew',
			'Deep Space 9 VPN tunnel to Starfleet Academy is down',
			'Starfleet Academy anomalous logon on the cadet lab',
			'USS Enterprise away team laptop mouse unresponsive',
			'Deep Space 9 DNS resolution failing for station operations',
			'Starfleet Academy firewall blocking campus comms feed',
			'USS Enterprise new ensign needs bridge console access',
			'Deep Space 9 phishing email reported by station operations',
			'Starfleet Academy campus communications software update completed',
			'USS Enterprise warp core monitor mouse replaced',
			'Deep Space 9 docking control switch replaced after outage'
		]
	)
};

export function worldNames() {
	return Object.keys(WORLDS);
}

export function validateWorld(w) {
	if (w.companies.length !== 3) throw new Error(`${w.id}: expected 3 companies`);
	if (w.techs.length !== 3) throw new Error(`${w.id}: expected 3 techs`);
	if (w.titles.length !== BLUEPRINT.rowCount) {
		throw new Error(`${w.id}: expected ${BLUEPRINT.rowCount} ticket titles`);
	}
	const companyKeys = new Set(w.companies.map((c) => c.key));
	const techKeys = new Set(w.techs.map((t) => t.key));
	if (companyKeys.size !== 3) throw new Error(`${w.id}: duplicate company key`);
	if (techKeys.size !== 3) throw new Error(`${w.id}: duplicate tech key`);
}

for (const definition of Object.values(WORLDS)) validateWorld(definition);
