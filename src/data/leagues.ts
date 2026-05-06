import type { LeagueId } from '../types';

export interface LeagueMeta {
  id: LeagueId;
  name: string;
  country: string;
  code: string;
}

export const LEAGUES: LeagueMeta[] = [
  { id: 'epl', name: '英超', country: 'England', code: 'PL' },
  { id: 'laliga', name: '西甲', country: 'Spain', code: 'PD' },
  { id: 'bundesliga', name: '德甲', country: 'Germany', code: 'BL1' },
  { id: 'seriea', name: '意甲', country: 'Italy', code: 'SA' },
  { id: 'ligue1', name: '法甲', country: 'France', code: 'FL1' }
];

export const leagueById = new Map(LEAGUES.map((league) => [league.id, league]));
