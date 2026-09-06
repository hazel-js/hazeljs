import type { MissionDefinition, MissionMetric, MissionProgress } from '../types/organism.types';

export function createMissionProgress(mission: MissionDefinition): MissionProgress {
  const metrics: Record<string, number> = {};
  const criteriaMet: Record<string, boolean> = {};
  for (const c of mission.successCriteria ?? []) {
    metrics[c.name] = 0;
    criteriaMet[c.name] = false;
  }
  return {
    missionId: mission.id,
    objective: mission.objective,
    metrics,
    criteriaMet,
    completed: false,
    updatedAt: new Date(),
  };
}

export function applyMissionMetricUpdates(
  progress: MissionProgress,
  mission: MissionDefinition,
  updates: Record<string, number>
): MissionProgress {
  const metrics = { ...progress.metrics, ...updates };
  const criteriaMet: Record<string, boolean> = {};
  let allMet = true;
  const criteria = mission.successCriteria ?? [];

  if (criteria.length === 0) {
    return {
      ...progress,
      metrics,
      criteriaMet,
      completed: false,
      updatedAt: new Date(),
    };
  }

  for (const criterion of criteria) {
    const value = metrics[criterion.name] ?? 0;
    const met = evaluateCriterion(criterion, value);
    criteriaMet[criterion.name] = met;
    if (criterion.operator !== 'maximize' && criterion.operator !== 'minimize' && !met) {
      allMet = false;
    }
  }

  // maximize/minimize never block completion alone; only target operators do
  const targetCriteria = criteria.filter(
    (c) => c.operator !== 'maximize' && c.operator !== 'minimize'
  );
  const completed = targetCriteria.length > 0 && targetCriteria.every((c) => criteriaMet[c.name]);

  return {
    ...progress,
    metrics,
    criteriaMet,
    completed: completed && allMet,
    updatedAt: new Date(),
  };
}

function evaluateCriterion(criterion: MissionMetric, value: number): boolean {
  const target = criterion.target;
  switch (criterion.operator) {
    case 'gt':
      return target != null && value > target;
    case 'gte':
      return target != null && value >= target;
    case 'lt':
      return target != null && value < target;
    case 'lte':
      return target != null && value <= target;
    case 'eq':
      return target != null && value === target;
    case 'maximize':
    case 'minimize':
      return true;
    default:
      return false;
  }
}
