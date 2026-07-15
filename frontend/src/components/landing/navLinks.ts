export const NAV_LINKS = [
  { label: 'Home', href: '#home', id: 'home' },
  { label: 'Platform', href: '#platform', id: 'platform' },
  { label: 'How it works', href: '#how', id: 'how' },
  { label: 'Contact', href: '#contact', id: 'contact' },
] as const

export const NAV_SECTION_IDS = NAV_LINKS.map((link) => link.id)
