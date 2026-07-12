import { prisma } from '@toefl/database';

export async function auditLog(params: {
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        metadataJson: (params.metadata ?? {}) as object,
      },
    });
  } catch (e) {
    console.error('audit log failed', e);
  }
}
