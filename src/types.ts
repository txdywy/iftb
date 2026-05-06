export type LeagueId = 'epl' | 'laliga' | 'bundesliga' | 'seriea' | 'ligue1';

export type DataQualityStatus = 'ok' | 'partial' | 'stale' | 'error';

export interface TeamStanding {
  teamId: number;
  teamName: string;
  shortName: string;
  crest?: string;
  position: number;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form?: string;
}

export interface Match {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface ProbabilityFeatures {
  pointsPerGame: number;
  pointsGapAdjusted: number;
  goalDiffPerGame: number;
  recentPpg: number;
  remainingScheduleAdvantage: number;
}

export interface TitleProbability {
  teamId: number;
  teamName: string;
  shortName: string;
  crest?: string;
  rawScore: number;
  probability: number;
  confidence: number;
  features: ProbabilityFeatures;
  missingFeatures: string[];
  probabilityDeltaPrevious?: number;
  probabilityDelta7d?: number;
}

export interface DataQuality {
  status: DataQualityStatus;
  warnings: string[];
  standingsUpdatedAt?: string;
  matchesUpdatedAt?: string;
}

export interface LeagueSnapshot {
  id: LeagueId;
  name: string;
  country: string;
  code: string;
  emblem?: string;
  season: string;
  standings: TeamStanding[];
  matches: Match[];
  titleProbabilities: TitleProbability[];
  topContenders: TitleProbability[];
  dataQuality: DataQuality;
}

export interface Snapshot {
  generatedAt: string;
  modelVersion: string;
  leagues: LeagueSnapshot[];
}

export interface HistoryIndexEntry {
  generatedAt: string;
  path: string;
  hash: string;
}

export interface HistoryIndex {
  snapshots: HistoryIndexEntry[];
}
