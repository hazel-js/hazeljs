/**
 * Shared filter utility for service instances
 */

import { ServiceInstance, ServiceFilter } from '../types';

/**
 * Apply a ServiceFilter to an array of ServiceInstances.
 * Returns only instances matching all specified filter criteria.
 */
export function applyServiceFilter(
  instances: ServiceInstance[],
  filter?: ServiceFilter
): ServiceInstance[] {
  if (!filter) return instances;

  return instances.filter((instance) => {
    // Filter by zone
    if (filter.zone && instance.zone !== filter.zone) {
      return false;
    }

    // Filter by status
    if (filter.status && instance.status !== filter.status) {
      return false;
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      if (!instance.tags || !filter.tags.every((tag) => instance.tags!.includes(tag))) {
        return false;
      }
    }

    // Filter by metadata
    if (filter.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (!instance.metadata || instance.metadata[key] !== value) {
          return false;
        }
      }
    }

    return true;
  });
}
