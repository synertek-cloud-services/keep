// Sidebar nav catalog. Mirrors the WIDGET_TYPES-as-const idiom from
// lib/server/dashboardData.ts — a fixed set of typed items with metadata,
// rather than markup hardcoded per-page. Adding a future module (Contracts,
// Timesheets, ...) is one more NAV_SECTIONS entry plus its routes; no shell
// changes needed.

export type NavRole = 'admin' | 'tech';
// Not all icon names are nav-specific (e.g. 'columns' is used by the ticket
// list's column-chooser button) — this lives here simply because it's the
// first catalog Icon.svelte needed a shared type from.
export type IconName = 'grid' | 'ticket' | 'gear' | 'chevron' | 'columns';

export interface NavLink {
	label: string;
	href: string;
	// Overrides the default pathname-prefix match — needed for Service
	// Desk's 3 /tickets views, distinguished by query string not path.
	isActive?: (url: URL) => boolean;
}

// A labeled cluster of links within a section's body (e.g. Admin's
// "Service Desk" cluster) — distinct from the section header itself.
export interface NavGroup {
	label: string;
	links: NavLink[];
}

export interface NavSection {
	id: string;
	label: string;
	icon: IconName;
	minRole?: NavRole; // omit = visible to everyone
	// Ungrouped links, rendered directly under the section header with no
	// cluster label (e.g. Admin's standalone "Companies").
	links?: NavLink[];
	// Labeled clusters, rendered after any ungrouped `links`.
	groups?: NavGroup[];
}

function defaultIsActive(href: string, url: URL): boolean {
	const path = href.split('?')[0];
	return url.pathname === path || url.pathname.startsWith(path + '/');
}

export function linkIsActive(link: NavLink, url: URL): boolean {
	return link.isActive ? link.isActive(url) : defaultIsActive(link.href, url);
}

// Flattens a section's links + all its groups' links — used to check
// whether ANY link in the section matches the current route (open-by-
// default logic), regardless of grouping.
export function sectionAllLinks(section: NavSection): NavLink[] {
	return [...(section.links ?? []), ...(section.groups?.flatMap((g) => g.links) ?? [])];
}

export const NAV_SECTIONS: NavSection[] = [
	{
		id: 'dashboard',
		label: 'Dashboard',
		icon: 'grid',
		links: [{ label: 'Overview', href: '/', isActive: (u) => u.pathname === '/' }]
	},
	{
		id: 'service-desk',
		label: 'Service Desk',
		icon: 'ticket',
		links: [
			{ label: 'My Tickets', href: '/tickets', isActive: (u) => u.pathname === '/tickets' && u.search === '' },
			{ label: 'All Tickets', href: '/tickets?all=1', isActive: (u) => u.search.includes('all=1') },
			{ label: 'Unassigned', href: '/tickets?unassigned=1', isActive: (u) => u.search.includes('unassigned=1') }
		]
	},
	{
		id: 'admin',
		label: 'Admin',
		icon: 'gear',
		minRole: 'admin',
		groups: [
			{
				label: 'Service Desk',
				links: [
					{ label: 'Queues', href: '/queues' },
					{ label: 'SLA Policies', href: '/sla-policies' },
					{ label: 'Issue Types', href: '/issue-types' },
					{ label: 'Routing Rules', href: '/routing-rules' }
				]
			},
			{
				label: 'Access',
				links: [
					{ label: 'Users', href: '/users' },
					{ label: 'Single Sign-On', href: '/sso' },
					{ label: 'API Keys', href: '/api-keys' }
				]
			}
		],
		links: [{ label: 'Companies', href: '/companies' }]
	}
];

export function visibleNavSections(role: NavRole): NavSection[] {
	return NAV_SECTIONS.filter((s) => !s.minRole || role === s.minRole);
}
