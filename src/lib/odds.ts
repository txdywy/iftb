import type { MatchOdds } from '../types';
import { normalizeOddsTeamName } from './teamName';

export function expectedPointsForTeam(teamId: number, match: MatchOdds): number {
  const homeWin = match.outcomes.find((outcome) => normalizeOddsTeamName(outcome.name) === normalizeOddsTeamName(match.homeTeamName))?.impliedProbability ?? 0;
  const awayWin = match.outcomes.find((outcome) => normalizeOddsTeamName(outcome.name) === normalizeOddsTeamName(match.awayTeamName))?.impliedProbability ?? 0;
  const draw = match.outcomes.find((outcome) => normalizeOddsTeamName(outcome.name) === 'draw')?.impliedProbability ?? 0;
  if (teamId === match.homeTeamId) return homeWin * 3 + draw;
  if (teamId === match.awayTeamId) return awayWin * 3 + draw;
  return 0;
}
