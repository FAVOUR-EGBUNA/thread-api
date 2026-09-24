import { db } from "../prisma/db.js";

import type { CreateDecisionRelationInput } from "../schemas/decision-relation.schema.js";

import {
  hasMinimumWorkspaceRole,
  type WorkspaceRole,
} from "../utils/workspace-permissions.js";

import { createActivity } from "./activity.service.js";

const requireRelationWritePermission = (role: WorkspaceRole) => {
  const hasPermission = hasMinimumWorkspaceRole(role, "ADMIN");

  if (!hasPermission) {
    throw new Error("INSUFFICIENT_WORKSPACE_ROLE");
  }
};

export const createDecisionRelation = async (
  userId: number,
  sourceDecisionId: number,
  input: CreateDecisionRelationInput,
) => {
  const sourceDecision = await db.orm.public.Decision.where({
    id: sourceDecisionId,
  }).first();

  if (!sourceDecision) {
    throw new Error("SOURCE_DECISION_NOT_FOUND");
  }

  const targetDecision = await db.orm.public.Decision.where({
    id: input.targetDecisionId,
  }).first();

  if (!targetDecision) {
    throw new Error("TARGET_DECISION_NOT_FOUND");
  }

  if (sourceDecision.id === targetDecision.id) {
    throw new Error("SELF_RELATION_NOT_ALLOWED");
  }

  if (sourceDecision.projectId !== targetDecision.projectId) {
    throw new Error("CROSS_PROJECT_RELATION_NOT_ALLOWED");
  }

  const project = await db.orm.public.Project.where({
    id: sourceDecision.projectId,
  }).first();

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const membership = await db.orm.public.WorkspaceMember.where({
    userId,
    workspaceId: project.workspaceId,
  }).first();

  if (!membership) {
    throw new Error("DECISION_ACCESS_DENIED");
  }

  requireRelationWritePermission(membership.role as WorkspaceRole);

  const existingRelation = await db.orm.public.DecisionRelation.where({
    sourceDecisionId,
    targetDecisionId: input.targetDecisionId,
    type: input.type,
  }).first();

  if (existingRelation) {
    throw new Error("RELATION_ALREADY_EXISTS");
  }

  return db.transaction(async (tx) => {
    const relationInsideTransaction =
      await tx.orm.public.DecisionRelation.where({
        sourceDecisionId,
        targetDecisionId: input.targetDecisionId,
        type: input.type,
      }).first();

    if (relationInsideTransaction) {
      throw new Error("RELATION_ALREADY_EXISTS");
    }

    const relation = await tx.orm.public.DecisionRelation.create({
      sourceDecisionId,
      targetDecisionId: input.targetDecisionId,
      type: input.type,
    });

    await createActivity(
      {
        userId,
        workspaceId: project.workspaceId,
        action: "DECISION_RELATION_CREATED",
        entityType: "DECISION_RELATION",
        entityId: relation.id,
        metadata: {
          relationshipType: relation.type,
          sourceDecisionId: sourceDecision.id,
          sourceDecisionTitle: sourceDecision.title,
          targetDecisionId: targetDecision.id,
          targetDecisionTitle: targetDecision.title,
          projectId: project.id,
          projectName: project.name,
        },
      },
      tx,
    );

    return relation;
  });
};

export const deleteDecisionRelation = async (
  userId: number,
  relationId: number,
) => {
  const relation = await db.orm.public.DecisionRelation.where({
    id: relationId,
  }).first();

  if (!relation) {
    throw new Error("RELATION_NOT_FOUND");
  }

  const sourceDecision = await db.orm.public.Decision.where({
    id: relation.sourceDecisionId,
  }).first();

  if (!sourceDecision) {
    throw new Error("SOURCE_DECISION_NOT_FOUND");
  }

  const targetDecision = await db.orm.public.Decision.where({
    id: relation.targetDecisionId,
  }).first();

  if (!targetDecision) {
    throw new Error("TARGET_DECISION_NOT_FOUND");
  }

  const project = await db.orm.public.Project.where({
    id: sourceDecision.projectId,
  }).first();

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const membership = await db.orm.public.WorkspaceMember.where({
    userId,
    workspaceId: project.workspaceId,
  }).first();

  if (!membership) {
    throw new Error("DECISION_ACCESS_DENIED");
  }

  requireRelationWritePermission(membership.role as WorkspaceRole);

  return db.transaction(async (tx) => {
    const relationToDelete = await tx.orm.public.DecisionRelation.where({
      id: relationId,
    }).first();

    if (!relationToDelete) {
      throw new Error("RELATION_NOT_FOUND");
    }

    await tx.orm.public.DecisionRelation.where({
      id: relationId,
    }).delete();

    await createActivity(
      {
        userId,
        workspaceId: project.workspaceId,
        action: "DECISION_RELATION_DELETED",
        entityType: "DECISION_RELATION",
        entityId: relation.id,
        metadata: {
          relationshipType: relation.type,
          sourceDecisionId: sourceDecision.id,
          sourceDecisionTitle: sourceDecision.title,
          targetDecisionId: targetDecision.id,
          targetDecisionTitle: targetDecision.title,
          projectId: project.id,
          projectName: project.name,
        },
      },
      tx,
    );

    return {
      id: relation.id,
      type: relation.type,
      sourceDecisionId: relation.sourceDecisionId,
      targetDecisionId: relation.targetDecisionId,
    };
  });
};

export const getDirectImpact = async (userId: number, decisionId: number) => {
  const rootDecision = await db.orm.public.Decision.where({
    id: decisionId,
  }).first();

  if (!rootDecision) {
    throw new Error("DECISION_NOT_FOUND");
  }

  const project = await db.orm.public.Project.where({
    id: rootDecision.projectId,
  }).first();

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const membership = await db.orm.public.WorkspaceMember.where({
    userId,
    workspaceId: project.workspaceId,
  }).first();

  if (!membership) {
    throw new Error("DECISION_ACCESS_DENIED");
  }

  const projectDecisions = await db.orm.public.Decision.where({
    projectId: rootDecision.projectId,
  }).all();

  const projectDecisionIds = projectDecisions.map((decision) => decision.id);

  const dependencyRelations =
    projectDecisionIds.length === 0
      ? []
      : await db.orm.public.DecisionRelation.where((relation) =>
          relation.targetDecisionId.in(projectDecisionIds),
        ).all();

  const decisionById = new Map(
    projectDecisions.map((decision) => [decision.id, decision]),
  );

  const incomingDependencies = new Map<number, typeof dependencyRelations>();

  for (const relation of dependencyRelations) {
    if (relation.type !== "DEPENDS_ON") {
      continue;
    }

    if (!decisionById.has(relation.sourceDecisionId)) {
      continue;
    }

    const existingRelations =
      incomingDependencies.get(relation.targetDecisionId) ?? [];

    existingRelations.push(relation);

    incomingDependencies.set(relation.targetDecisionId, existingRelations);
  }

  const visited = new Set<number>();

  visited.add(rootDecision.id);

  const impactedDecisions: Array<{
    relationId: number;
    relationship: string;
    depth: number;
    decision: typeof rootDecision;
  }> = [];

  const traverseImpact = (currentDecisionId: number, depth: number): void => {
    const relations = incomingDependencies.get(currentDecisionId) ?? [];

    for (const relation of relations) {
      const impactedDecisionId = relation.sourceDecisionId;

      if (visited.has(impactedDecisionId)) {
        continue;
      }

      const impactedDecision = decisionById.get(impactedDecisionId);

      if (!impactedDecision) {
        continue;
      }

      visited.add(impactedDecisionId);

      impactedDecisions.push({
        relationId: relation.id,
        relationship: relation.type,
        depth,
        decision: impactedDecision,
      });

      traverseImpact(impactedDecision.id, depth + 1);
    }
  };

  traverseImpact(rootDecision.id, 1);

  return {
    rootDecision,
    impactCount: impactedDecisions.length,
    maxDepth:
      impactedDecisions.length === 0
        ? 0
        : Math.max(...impactedDecisions.map((item) => item.depth)),
    impactedDecisions,
  };
};
