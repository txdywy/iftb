// Pure team-name normalization shared by the data pipeline (Node scripts) and
// the frontend. Kept free of Node/DOM dependencies so it can be imported by both.

const ODDS_TEAM_ALIASES: Record<string, string> = {
  brightonandhovealbion: 'brightonhovealbion',
  celtavigo: 'rcceltavigo',
  athleticbilbao: 'athletic',
  oviedo: 'realoviedo',
  bayerleverkusen: 'bayer04leverkusen',
  tsghoffenheim: 'tsg1899hoffenheim',
  tsg1899hoffenheim: 'tsg1899hoffenheim',
  werderbremen: 'svwerderbremen',
  bayernmunich: 'bayernmunchen',
  bayernmunchen: 'bayernmunchen',
  heidenheim: '1heidenheim1846',
  '1heidenheim': '1heidenheim1846',
  fsvmainz05: '1fsvmainz05',
  mainz05: '1fsvmainz05',
  intermilan: 'internazionalemilano',
  inter: 'internazionalemilano',
  como: 'como1907',
  pisa: 'acpisa1909',
  angers: 'angerssco',
  lyon: 'olympiquelyonnais',
  rennes: 'staderennais1901'
};

export function normalizeOddsTeamName(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|afc|calcio|club|de|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  return ODDS_TEAM_ALIASES[normalized] ?? normalized;
}
