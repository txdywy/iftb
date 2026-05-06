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
  if (!Array.isArray(league.standings) || league.standings.length === 0) errors.push(`${prefix} standings required`);
  if (!Array.isArray(league.matches)) errors.push(`${prefix} matches must be an array`);
  if (!Array.isArray(league.titleProbabilities)) errors.push(`${prefix} titleProbabilities required`);

  const probabilitySum = league.titleProbabilities.reduce((sum, team) => sum + checkedNumber(team.probability, `${prefix} ${team.teamName} probability`, errors), 0);
  if (league.titleProbabilities.length && Math.abs(probabilitySum - 1) > 0.001) {
    errors.push(`${prefix} probabilities must sum to 1, got ${probabilitySum}`);
  }

  for (const standing of league.standings ?? []) {
    for (const [key, value] of Object.entries(standing)) {
      if (typeof value === 'number') checkedNumber(value, `${prefix} standing ${standing.teamName}.${key}`, errors);
    }
  }
  for (const probability of league.titleProbabilities ?? []) {
    checkedNumber(probability.rawScore, `${prefix} ${probability.teamName}.rawScore`, errors);
    checkedNumber(probability.confidence, `${prefix} ${probability.teamName}.confidence`, errors);
    for (const [key, value] of Object.entries(probability.features)) {
      checkedNumber(value, `${prefix} ${probability.teamName}.features.${key}`, errors);
    }
  }
  return errors;
}

function checkedNumber(value: number, label: string, errors: string[]): number {
  if (!Number.isFinite(value)) errors.push(`${label} must be finite`);
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
  const snapshot = JSON.parse(await readFile(target, 'utf8')) as Snapshot;
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
