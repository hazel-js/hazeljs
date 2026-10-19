import type { KnowledgeAuthorizer, KnowledgeScope } from '../types';
import { KagError } from '../errors/kag.error';

/**
 * Default authorizer: require tenantId and enforce tenant equality.
 */
export class TenantKnowledgeAuthorizer implements KnowledgeAuthorizer {
  constructor(private readonly expectedTenantId?: string) {}

  canAccess(
    scope: KnowledgeScope,
    _action: 'read' | 'write',
    _resource: { kind: 'entity' | 'relation' | 'fact' | 'source'; id?: string; type?: string }
  ): boolean {
    if (!scope.tenantId) return false;
    if (this.expectedTenantId && scope.tenantId !== this.expectedTenantId) {
      return false;
    }
    return true;
  }
}

/**
 * Adapts a CASL-shaped can(action, subject) without depending on @hazeljs/casl.
 */
export function createCaslKnowledgeAuthorizer(
  can: (
    action: string,
    subject: string | { __typename?: string; id?: string; tenantId?: string }
  ) => boolean
): KnowledgeAuthorizer {
  return {
    canAccess(scope, action, resource): boolean {
      if (!scope.tenantId) return false;
      const subject =
        resource.kind === 'source'
          ? { __typename: 'KnowledgeSource', id: resource.id, tenantId: scope.tenantId }
          : {
              __typename:
                resource.kind === 'entity'
                  ? 'KnowledgeEntity'
                  : resource.kind === 'relation'
                    ? 'KnowledgeRelation'
                    : 'KnowledgeFact',
              id: resource.id,
              tenantId: scope.tenantId,
            };
      return can(action === 'read' ? 'read' : 'update', subject);
    },
  };
}

export async function assertAuthorized(
  authorizer: KnowledgeAuthorizer | undefined,
  scope: KnowledgeScope,
  action: 'read' | 'write',
  resource: { kind: 'entity' | 'relation' | 'fact' | 'source'; id?: string; type?: string }
): Promise<void> {
  if (!scope.tenantId) {
    throw KagError.tenantRequired();
  }
  if (!authorizer) return;
  const ok = await authorizer.canAccess(scope, action, resource);
  if (!ok) {
    throw KagError.accessDenied(`${resource.kind}:${resource.id ?? resource.type ?? '*'}`);
  }
}
