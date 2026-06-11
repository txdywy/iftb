import { readFile } from 'node:fs/promises';
import type { LeagueSnapshot, Snapshot } from '../src/types';

export function validateSnapshot(snapshot: Snapshot): string[] {
  const errors: string[] = [];
  if (!isIsoDate(snapshot.generatedAt)) errors.push('generatedAt must be an ISO date');
  if (!snapshot.modelVersion) errors.push('modelVersion is required');
  if (!Array.isArray(snapshot.leagues) || snapshot.leagues.length !== 5) errors.push('snapshot must contain five leagues');

  for (const league of snapshot.leagues ?? []) {
    errors.push(...validateLeague(league));
  }

  return errors;
}

function validateLeague(league: LeagueSnapshot): string[] {
  const errors: string[] = [];
  const prefix = `${league.id ?? 'unknown'}:`;
  if (!league.id || !league.name || !league.code) errors.push(`${prefix} league id/name/code required`);
  if (league.emblem !== undefined && typeof league.emblem !== 'string') errors.push(`${prefix} emblem must be a string`);
  if (!Array.isArray(league.standings) || league.standings.length === 0) errors.push(`${prefix} standings required`);
  if (!Array.isArray(league.matches)) errors.push(`${prefix} matches must be an array`);
  if (!Array.isArray(league.titleProbabilities)) errors.push(`${prefix} titleProbabilities required`);

  const titleProbabilities = Array.isArray(league.titleProbabilities) ? league.titleProbabilities : [];
  const standings = Array.isArray(league.standings) ? league.standings : [];
  const probabilitySum = titleProbabilities.reduce((sum, team) => sum + checkedNumber(team.probability, `${prefix} ${team.teamName} probability`, errors), 0);
  if (titleProbabilities.length && Math.abs(probabilitySum - 1) > 0.001) {
    errors.push(`${prefix} probabilities must sum to 1, got ${probabilitySum}`);
  }

  for (const standing of standings) {
    for (const [key, value] of Object.entries(standing)) {
      if (typeof value === 'number') checkedNumber(value, `${prefix} standing ${standing.teamName}.${key}`, errors);
    }
  }
  for (const probability of titleProbabilities) {
    checkedNumber(probability.rawScore, `${prefix} ${probability.teamName}.rawScore`, errors);
    checkedNumber(probability.confidence, `${prefix} ${probability.teamName}.confidence`, errors);
    for (const [key, value] of Object.entries(probability.features)) {
      checkedNumber(value, `${prefix} ${probability.teamName}.features.${key}`, errors);
    }
  }

  if (league.odds) {
    if (league.odds.leagueId !== league.id) errors.push(`${prefix} odds leagueId must match league id`);
    if (!isIsoDate(league.odds.fetchedAt)) errors.push(`${prefix} odds fetchedAt must be an ISO date`);
    if (!Array.isArray(league.odds.teams)) errors.push(`${prefix} odds teams must be an array`);
    validateOddsDataQuality(league.odds.dataQuality, `${prefix} odds`, errors);

    const standingIds = new Set(standings.map((standing) => standing.teamId));
    const oddsTeams = Array.isArray(league.odds.teams) ? league.odds.teams : [];
    for (const teamOdds of oddsTeams) {
      if (!standingIds.has(teamOdds.teamId)) errors.push(`${prefix} odds team ${teamOdds.teamName} is not in standings`);
      checkedProbability(teamOdds.consensusProbability, `${prefix} ${teamOdds.teamName}.consensusProbability`, errors);
      const bookmakerOdds = Array.isArray(teamOdds.bookmakerOdds) ? teamOdds.bookmakerOdds : [];
      if (!Array.isArray(teamOdds.bookmakerOdds)) errors.push(`${prefix} ${teamOdds.teamName}.bookmakerOdds must be an array`);
      if (!bookmakerOdds.length) errors.push(`${prefix} ${teamOdds.teamName}.bookmakerOdds must not be empty`);
      for (const odds of bookmakerOdds) {
        checkedDecimalOdds(odds.oddsDecimal, `${prefix} ${teamOdds.teamName}.${odds.bookmaker}.oddsDecimal`, errors);
        checkedProbability(odds.impliedProbability, `${prefix} ${teamOdds.teamName}.${odds.bookmaker}.impliedProbability`, errors);
        if (!isIsoDate(odds.lastUpdated)) errors.push(`${prefix} ${teamOdds.teamName}.${odds.bookmaker}.lastUpdated must be an ISO date`);
      }
    }
  }

  if (league.matchOdds) {
    if (league.matchOdds.leagueId !== league.id) errors.push(`${prefix} matchOdds leagueId must match league id`);
    if (!isIsoDate(league.matchOdds.fetchedAt)) errors.push(`${prefix} matchOdds fetchedAt must be an ISO date`);
    if (!Array.isArray(league.matchOdds.matches)) errors.push(`${prefix} matchOdds matches must be an array`);
    if (!Array.isArray(league.matchOdds.teamSchedules)) errors.push(`${prefix} matchOdds teamSchedules must be an array`);
    validateOddsDataQuality(league.matchOdds.dataQuality, `${prefix} matchOdds`, errors);

    const standingIds = new Set(standings.map((standing) => standing.teamId));
    for (const schedule of Array.isArray(league.matchOdds.teamSchedules) ? league.matchOdds.teamSchedules : []) {
      if (!standingIds.has(schedule.teamId)) errors.push(`${prefix} matchOdds schedule ${schedule.teamName} is not in standings`);
      checkedNonNegativeInteger(schedule.matches, `${prefix} ${schedule.teamName}.matches`, errors);
      checkedNumber(schedule.expectedPoints, `${prefix} ${schedule.teamName}.expectedPoints`, errors);
      checkedNumber(schedule.expectedPpg, `${prefix} ${schedule.teamName}.expectedPpg`, errors);
    }
    for (const matchOdds of Array.isArray(league.matchOdds.matches) ? league.matchOdds.matches : []) {
      if (!isIsoDate(matchOdds.utcDate)) errors.push(`${prefix} matchOdds ${matchOdds.homeTeamName}-${matchOdds.awayTeamName}.utcDate must be an ISO date`);
      checkedNonNegativeInteger(matchOdds.bookmakerCount, `${prefix} matchOdds ${matchOdds.homeTeamName}-${matchOdds.awayTeamName}.bookmakerCount`, errors);
      for (const outcome of Array.isArray(matchOdds.outcomes) ? matchOdds.outcomes : []) {
        checkedDecimalOdds(outcome.oddsDecimal, `${prefix} matchOdds ${outcome.name}.oddsDecimal`, errors);
        checkedProbability(outcome.impliedProbability, `${prefix} matchOdds ${outcome.name}.impliedProbability`, errors);
      }
    }
  }

  return errors;
}

function validateOddsDataQuality(dataQuality: { bookmakerCount: number; matchedOutcomeCount: number; unmatchedOutcomeCount: number; coverageRatio: number; warnings: string[] } | undefined, label: string, errors: string[]): void {
  if (!dataQuality) {
    errors.push(`${label} dataQuality is required`);
    return;
  }
  checkedNonNegativeInteger(dataQuality.bookmakerCount, `${label}.dataQuality.bookmakerCount`, errors);
  checkedNonNegativeInteger(dataQuality.matchedOutcomeCount, `${label}.dataQuality.matchedOutcomeCount`, errors);
  checkedNonNegativeInteger(dataQuality.unmatchedOutcomeCount, `${label}.dataQuality.unmatchedOutcomeCount`, errors);
  checkedProbability(dataQuality.coverageRatio, `${label}.dataQuality.coverageRatio`, errors);
  if (!Array.isArray(dataQuality.warnings)) errors.push(`${label}.dataQuality.warnings must be an array`);
}

function checkedNumber(value: number, label: string, errors: string[]): number {
  if (!Number.isFinite(value)) errors.push(`${label} must be finite`);
  return value;
}

function checkedProbability(value: number, label: string, errors: string[]): number {
  checkedNumber(value, label, errors);
  if (value < 0 || value > 1) errors.push(`${label} must be between 0 and 1`);
  return value;
}

function checkedDecimalOdds(value: number, label: string, errors: string[]): number {
  checkedNumber(value, label, errors);
  if (value <= 1) errors.push(`${label} must be greater than 1`);
  return value;
}

function checkedNonNegativeInteger(value: number, label: string, errors: string[]): number {
  checkedNumber(value, label, errors);
  if (!Number.isInteger(value) || value < 0) errors.push(`${label} must be a non-negative integer`);
  return value;
}

function isIsoDate(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    throw new Error('Usage: tsx scripts/validate-data.ts <snapshot.json>');
  }
  let snapshot: Snapshot;
  try {
    snapshot = JSON.parse(await readFile(target, 'utf8')) as Snapshot;
  } catch (err) {
    throw new Error(`Failed to parse ${target}: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
  const errors = validateSnapshot(snapshot);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`Validated ${target}: ${snapshot.leagues.length} leagues`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
