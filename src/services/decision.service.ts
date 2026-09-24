import { db } from "../prisma/db.js";

import type {
  CreateDecisionInput,
  UpdateDecisionInput,
  UpdateDecisionStatusInput,
} from "../schemas/decision.schema.js";

import {
  hasMinimumWorkspaceRole,
  type WorkspaceRole,
} from "../utils/workspace-permissions.js";

import { createActivity } from "./activity.service.js";

const getAccessibleDecision = async (userId: number, decisionId: number) => {
  const decision = await db.orm.public.Decision.where({
    id: decisionId,
  }).first();

  if (!decision) {
    throw new Error("DECISION_NOT_FOUND");
  }

  const project = await db.orm.public.Project.where({
    id: decision.projectId,
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

  return {
    decision,
    project,
    membership,
  };
};

const requireDecisionWritePermission = (role: WorkspaceRole) => {
  const hasPermission = hasMinimumWorkspaceRole(role, "ADMIN");

  if (!hasPermission) {
    throw new Error("INSUFFICIENT_WORKSPACE_ROLE");
  }
};

export const createDecision = async (
  userId: number,
  projectId: number,
  input: CreateDecisionInput,
) => {
  const project = await db.orm.public.Project.where({
    id: projectId,
  }).first();

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const membership = await db.orm.public.WorkspaceMember.where({
    userId,
    workspaceId: project.workspaceId,
  }).first();

  if (!membership) {
    throw new Error("PROJECT_ACCESS_DENIED");
  }

  requireDecisionWritePermission(membership.role as WorkspaceRole);

  return db.transaction(async (tx) => {
    const decision = await tx.orm.public.Decision.create({
      title: input.title,
      context: input.context,
      decision: input.decision,
      reasoning: input.reasoning ?? null,
      status: input.status,
      projectId,
    });

    await createActivity(
      {
        userId,
        workspaceId: project.workspaceId,
        action: "DECISION_CREATED",
        entityType: "DECISION",
        entityId: decision.id,
        metadata: {
          title: decision.title,
          status: decision.status,
          projectId: project.id,
          projectName: project.name,
        },
      },
      tx,
    );

    return decision;
  });
};

export const getDecisionById = async (userId: number, decisionId: number) => {
  const { decision } = await getAccessibleDecision(userId, decisionId);

  const outgoingRelations = await db.orm.public.DecisionRelation.where({
    sourceDecisionId: decisionId,
  }).all();

  const incomingRelations = await db.orm.public.DecisionRelation.where({
    targetDecisionId: decisionId,
  }).all();

  return {
    decision,
    relationships: {
      outgoing: outgoingRelations,
      incoming: incomingRelations,
    },
  };
};

export const updateDecision = async (
  userId: number,
  decisionId: number,
  input: UpdateDecisionInput,
) => {
  const { decision, project, membership } = await getAccessibleDecision(
    userId,
    decisionId,
  );

  requireDecisionWritePermission(membership.role as WorkspaceRole);

  return db.transaction(async (tx) => {
    const updatedDecision = await tx.orm.public.Decision.where({
      id: decisionId,
    }).update({
      ...input,
    });

    if (!updatedDecision) {
      throw new Error("DECISION_UPDATE_FAILED");
    }

    await createActivity(
      {
        userId,
        workspaceId: project.workspaceId,
        action: "DECISION_UPDATED",
        entityType: "DECISION",
        entityId: decisionId,
        metadata: {
          title: updatedDecision.title,
          projectId: project.id,
          projectName: project.name,
          updatedFields: Object.keys(input),
          previousTitle: decision.title,
        },
      },
      tx,
    );

    return updatedDecision;
  });
};

export const updateDecisionStatus = async (
  userId: number,
  decisionId: number,
  input: UpdateDecisionStatusInput,
) => {
  const { decision, project, membership } = await getAccessibleDecision(
    userId,
    decisionId,
  );

  requireDecisionWritePermission(membership.role as WorkspaceRole);

  if (decision.status === input.status) {
    throw new Error("STATUS_UNCHANGED");
  }

  const previousStatus = decision.status;

  return db.transaction(async (tx) => {
    const updatedDecision = await tx.orm.public.Decision.where({
      id: decisionId,
    }).update({
      status: input.status,
    });

    if (!updatedDecision) {
      throw new Error("DECISION_UPDATE_FAILED");
    }

    const history = await tx.orm.public.DecisionStatusHistory.create({
      previousStatus,
      newStatus: input.status,
      decisionId,
      changedById: userId,
    });

    const activity = await createActivity(
      {
        userId,
        workspaceId: project.workspaceId,
        action: "DECISION_STATUS_CHANGED",
        entityType: "DECISION",
        entityId: decisionId,
        metadata: {
          title: decision.title,
          previousStatus,
          newStatus: input.status,
          projectId: project.id,
          projectName: project.name,
        },
      },
      tx,
    );

    return {
      previousStatus,
      currentStatus: updatedDecision.status,
      decision: updatedDecision,
      history,
      activity,
    };
  });
};

export const getDecisionHistory = async (
  userId: number,
  decisionId: number,
) => {
  const { decision } = await getAccessibleDecision(userId, decisionId);

  const history = await db.orm.public.DecisionStatusHistory.where({
    decisionId,
  }).all();

  return {
    decision: {
      id: decision.id,
      title: decision.title,
      status: decision.status,
    },
    historyCount: history.length,
    history,
  };
};
