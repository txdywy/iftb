import type { LeagueSnapshot, ProbabilityFeatures, Snapshot, TeamStanding, TitleProbability } from '../src/types';

const WEIGHTS: Record<keyof ProbabilityFeatures, number> = {
  pointsPerGame: 0.4,
  pointsGapAdjusted: 0.25,
  goalDiffPerGame: 0.2,
  recentPpg: 0.1,
  remainingScheduleAdvantage: 0.05
};

export function calculateSnapshotProbabilities(snapshot: Snapshot, previousSnapshots: Snapshot[] = []): Snapshot {
  return {
    ...snapshot,
    leagues: snapshot.leagues.map((league) => calculateLeagueProbabilities(league, previousSnapshots))
  };
}

export function calculateLeagueProbabilities(league: LeagueSnapshot, previousSnapshots: Snapshot[] = []): LeagueSnapshot {
  const teamCount = league.standings.length;
  if (teamCount === 0) {
    return { ...league, titleProbabilities: [], topContenders: [] };
  }

  const maxPlayed = Math.max(...league.standings.map((team) => team.playedGames));
  const maxSeasonGames = league.id === 'bundesliga' ? 34 : 38;
  const finished = maxPlayed >= maxSeasonGames || league.matches.every((match) => match.status === 'FINISHED');
  if (finished) {
    const sorted = [...league.standings].sort(compareChampionTiebreaker);
    const champion = sorted[0];
    const probabilities = league.standings.map((team) => probabilityFromStanding(team, team.teamId === champion.teamId ? 1 : 0, 1));
    return {
      ...league,
      titleProbabilities: probabilities.sort((a, b) => b.probability - a.probability),
      topContenders: probabilities.filter((team) => team.probability > 0)
    };
  }

  const featureRows = league.standings.map((team) => ({
    team,
    features: featureValues(team, league)
  }));
  const normalized = normalizeFeatures(featureRows.map((row) => row.features));
  const rawRows = featureRows.map((row, index) => {
    const missingFeatures = Object.entries(row.features)
      .filter(([, value]) => !Number.isFinite(value))
      .map(([key]) => key);
    const rawScore = weightedScore(normalized[index], missingFeatures as Array<keyof ProbabilityFeatures>);
    return { ...row, normalized: normalized[index], rawScore, missingFeatures };
  });

  const maxPoints = Math.max(...league.standings.map((team) => team.points));
  const probabilitiesBeforeElimination = softmax(rawRows.map((row) => row.rawScore));
  const eliminated = new Set(
    league.standings
      .filter((team) => team.points + Math.max(0, maxSeasonGames - team.playedGames) * 3 < maxPoints)
      .map((team) => team.teamId)
  );
  const retainedTotal = probabilitiesBeforeElimination.reduce((sum, value, index) => {
    return eliminated.has(rawRows[index].team.teamId) ? sum : sum + value;
  }, 0);

  const probabilities = rawRows
    .map((row, index) => {
      const baseProbability = eliminated.has(row.team.teamId) ? 0 : probabilitiesBeforeElimination[index] / (retainedTotal || 1);
      return probabilityFromStanding(
        row.team,
        baseProbability,
        confidenceFor(row.team, league),
        row.rawScore,
        row.features,
        row.missingFeatures,
        deltasFor(row.team.teamId, league.id, baseProbability, previousSnapshots)
      );
    })
    .sort((a, b) => b.probability - a.probability);

  return {
    ...league,
    titleProbabilities: probabilities,
    topContenders: probabilities.filter((team) => team.probability >= 0.01).slice(0, 8)
  };
}

function featureValues(team: TeamStanding, league: LeagueSnapshot): ProbabilityFeatures {
  const played = Math.max(team.playedGames, 1);
  const leaderPoints = Math.max(...league.standings.map((item) => item.points));
  return {
    pointsPerGame: team.points / played,
    pointsGapAdjusted: 1 - (leaderPoints - team.points) / Math.max(leaderPoints, 1),
    goalDiffPerGame: team.goalDifference / played,
    recentPpg: recentPpg(team.form),
    remainingScheduleAdvantage: remainingScheduleAdvantage(team, league)
  };
}

function recentPpg(form?: string): number {
  if (!form) return Number.NaN;
  const results = form
    .split('')
    .map((char) => (char === 'W' ? 3 : char === 'D' ? 1 : char === 'L' ? 0 : Number.NaN))
    .filter(Number.isFinite);
  if (!results.length) return Number.NaN;
  return results.reduce((sum, value) => sum + value, 0) / results.length;
}

function remainingScheduleAdvantage(team: TeamStanding, league: LeagueSnapshot): number {
  const futureOpponents = league.matches
    .filter((match) => match.status !== 'FINISHED' && (match.homeTeamId === team.teamId || match.awayTeamId === team.teamId))
    .map((match) => (match.homeTeamId === team.teamId ? match.awayTeamId : match.homeTeamId));
  if (!futureOpponents.length) return Number.NaN;
  const pointsByTeam = new Map(league.standings.map((standing) => [standing.teamId, standing.points / Math.max(standing.playedGames, 1)]));
  const averageOpponentPpg = futureOpponents.reduce((sum, teamId) => sum + (pointsByTeam.get(teamId) ?? 1.3), 0) / futureOpponents.length;
  const leagueAverage = league.standings.reduce((sum, standing) => sum + standing.points / Math.max(standing.playedGames, 1), 0) / league.standings.length;
  return leagueAverage - averageOpponentPpg;
}

function normalizeFeatures(rows: ProbabilityFeatures[]): ProbabilityFeatures[] {
  const keys = Object.keys(WEIGHTS) as Array<keyof ProbabilityFeatures>;
  const stats = Object.fromEntries(
    keys.map((key) => {
      const values = rows.map((row) => row[key]).filter(Number.isFinite).sort((a, b) => a - b);
      const median = percentile(values, 0.5);
      const iqr = percentile(values, 0.75) - percentile(values, 0.25);
      return [key, { median, spread: iqr || 1 }];
    })
  ) as Record<keyof ProbabilityFeatures, { median: number; spread: number }>;

  return rows.map((row) => {
    const normalized = {} as ProbabilityFeatures;
    for (const key of keys) {
      const value = row[key];
      normalized[key] = Number.isFinite(value) ? (value - stats[key].median) / stats[key].spread : Number.NaN;
    }
    return normalized;
  });
}

function weightedScore(features: ProbabilityFeatures, missingFeatures: Array<keyof ProbabilityFeatures>): number {
  const missing = new Set(missingFeatures);
  const availableWeight = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => (missing.has(key as keyof ProbabilityFeatures) ? sum : sum + weight), 0);
  if (!availableWeight) return 0;
  return (Object.entries(WEIGHTS) as Array<[keyof ProbabilityFeatures, number]>).reduce((sum, [key, weight]) => {
    if (missing.has(key)) return sum;
    return sum + features[key] * (weight / availableWeight);
  }, 0);
}

function softmax(values: number[]): number[] {
  const max = Math.max(...values);
  const exp = values.map((value) => Math.exp(value - max));
  const sum = exp.reduce((total, value) => total + value, 0);
  return exp.map((value) => value / sum);
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const index = (values.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (index - lower);
}

function compareChampionTiebreaker(a: TeamStanding, b: TeamStanding): number {
  return b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor;
}

function probabilityFromStanding(
  team: TeamStanding,
  probability: number,
  confidence: number,
  rawScore = probability,
  features: ProbabilityFeatures = {
    pointsPerGame: team.points / Math.max(team.playedGames, 1),
    pointsGapAdjusted: probability,
    goalDiffPerGame: team.goalDifference / Math.max(team.playedGames, 1),
    recentPpg: recentPpg(team.form),
    remainingScheduleAdvantage: Number.NaN
  },
  missingFeatures: string[] = [],
  deltas: Pick<TitleProbability, 'probabilityDeltaPrevious' | 'probabilityDelta7d'> = {}
): TitleProbability {
  return {
    teamId: team.teamId,
    teamName: team.teamName,
    shortName: team.shortName,
    crest: team.crest,
    rawScore: round(rawScore),
    probability: round(probability),
    confidence: round(confidence),
    features: sanitizeFeatures(features),
    missingFeatures,
    ...deltas
  };
}

function sanitizeFeatures(features: ProbabilityFeatures): ProbabilityFeatures {
  return {
    pointsPerGame: Number.isFinite(features.pointsPerGame) ? round(features.pointsPerGame) : 0,
    pointsGapAdjusted: Number.isFinite(features.pointsGapAdjusted) ? round(features.pointsGapAdjusted) : 0,
    goalDiffPerGame: Number.isFinite(features.goalDiffPerGame) ? round(features.goalDiffPerGame) : 0,
    recentPpg: Number.isFinite(features.recentPpg) ? round(features.recentPpg) : 0,
    remainingScheduleAdvantage: Number.isFinite(features.remainingScheduleAdvantage) ? round(features.remainingScheduleAdvantage) : 0
  };
}

function confidenceFor(team: TeamStanding, league: LeagueSnapshot): number {
  const maxGames = league.id === 'bundesliga' ? 34 : 38;
  const scheduleCompleteness = league.matches.length > 0 ? 1 : 0.82;
  return Math.min(0.95, 0.54 + (team.playedGames / maxGames) * 0.32 + scheduleCompleteness * 0.09);
}

function deltasFor(teamId: number, leagueId: string, probability: number, previousSnapshots: Snapshot[]) {
  const previous = previousSnapshots.at(-1)?.leagues.find((league) => league.id === leagueId)?.titleProbabilities.find((team) => team.teamId === teamId);
  const sevenDay = previousSnapshots.find((snapshot) => Date.now() - Date.parse(snapshot.generatedAt) >= 7 * 86400000)
    ?.leagues.find((league) => league.id === leagueId)
    ?.titleProbabilities.find((team) => team.teamId === teamId);
  return {
    probabilityDeltaPrevious: previous ? round(probability - previous.probability) : undefined,
    probabilityDelta7d: sevenDay ? round(probability - sevenDay.probability) : undefined
  };
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
