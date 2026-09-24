import { db } from "../prisma/db.js";

import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "../schemas/project.schema.js";

import {
  hasMinimumWorkspaceRole,
  type WorkspaceRole,
} from "../utils/workspace-permissions.js";

import { createActivity } from "./activity.service.js";

const requireProjectWritePermission = (role: WorkspaceRole) => {
  const hasPermission = hasMinimumWorkspaceRole(role, "ADMIN");

  if (!hasPermission) {
    throw new Error("INSUFFICIENT_WORKSPACE_ROLE");
  }
};

export const createProject = async (
  userId: number,
  workspaceId: number,
  input: CreateProjectInput,
) => {
  const workspace = await db.orm.public.Workspace.where({
    id: workspaceId,
  }).first();

  if (!workspace) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }

  const membership = await db.orm.public.WorkspaceMember.where({
    userId,
    workspaceId,
  }).first();

  if (!membership) {
    throw new Error("WORKSPACE_ACCESS_DENIED");
  }

  requireProjectWritePermission(membership.role as WorkspaceRole);

  return db.transaction(async (tx) => {
    const project = await tx.orm.public.Project.create({
      name: input.name,
      description: input.description ?? null,
      workspaceId,
    });

    await createActivity(
      {
        userId,
        workspaceId,
        action: "PROJECT_CREATED",
        entityType: "PROJECT",
        entityId: project.id,
        metadata: {
          projectName: project.name,
          description: project.description,
        },
      },
      tx,
    );

    return project;
  });
};

const getAccessibleProject = async (userId: number, projectId: number) => {
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

  return {
    project,
    membership,
  };
};

export const getWorkspaceProjects = async (
  userId: number,
  workspaceId: number,
) => {
  const workspace = await db.orm.public.Workspace.where({
    id: workspaceId,
  }).first();

  if (!workspace) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }

  const membership = await db.orm.public.WorkspaceMember.where({
    userId,
    workspaceId,
  }).first();

  if (!membership) {
    throw new Error("WORKSPACE_ACCESS_DENIED");
  }

  const projects = await db.orm.public.Project.where({
    workspaceId,
  }).all();

  const projectIds = projects.map((project) => project.id);

  const decisions =
    projectIds.length === 0
      ? []
      : await db.orm.public.Decision.where((decision) =>
          decision.projectId.in(projectIds),
        ).all();

  const decisionCounts = new Map<number, number>();

  for (const decision of decisions) {
    decisionCounts.set(
      decision.projectId,
      (decisionCounts.get(decision.projectId) ?? 0) + 1,
    );
  }

  const formattedProjects = projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    workspaceId: project.workspaceId,
    decisionCount: decisionCounts.get(project.id) ?? 0,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }));

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    },
    currentUserRole: membership.role,
    projectCount: formattedProjects.length,
    projects: formattedProjects,
  };
};

export const getProjectById = async (userId: number, projectId: number) => {
  const { project, membership } = await getAccessibleProject(userId, projectId);

  const decisions = await db.orm.public.Decision.where({
    projectId,
  }).all();

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    workspaceId: project.workspaceId,
    currentUserRole: membership.role,
    decisionCount: decisions.length,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
};

export const updateProject = async (
  userId: number,
  projectId: number,
  input: UpdateProjectInput,
) => {
  const { project, membership } = await getAccessibleProject(userId, projectId);

  requireProjectWritePermission(membership.role as WorkspaceRole);

  return db.transaction(async (tx) => {
    const updatedProject = await tx.orm.public.Project.where({
      id: projectId,
    }).update({
      ...input,
    });

    if (!updatedProject) {
      throw new Error("PROJECT_UPDATE_FAILED");
    }

    await createActivity(
      {
        userId,
        workspaceId: project.workspaceId,
        action: "PROJECT_UPDATED",
        entityType: "PROJECT",
        entityId: project.id,
        metadata: {
          previousName: project.name,
          projectName: updatedProject.name,
          updatedFields: Object.keys(input),
        },
      },
      tx,
    );

    return updatedProject;
  });
};

export const deleteProject = async (userId: number, projectId: number) => {
  const { project, membership } = await getAccessibleProject(userId, projectId);

  requireProjectWritePermission(membership.role as WorkspaceRole);

  const decisions = await db.orm.public.Decision.where({
    projectId,
  }).all();

  if (decisions.length > 0) {
    throw new Error("PROJECT_HAS_DECISIONS");
  }

  return db.transaction(async (tx) => {
    const decisionsInsideTransaction = await tx.orm.public.Decision.where({
      projectId,
    }).all();

    if (decisionsInsideTransaction.length > 0) {
      throw new Error("PROJECT_HAS_DECISIONS");
    }

    const projectToDelete = await tx.orm.public.Project.where({
      id: projectId,
    }).first();

    if (!projectToDelete) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    await tx.orm.public.Project.where({
      id: projectId,
    }).delete();

    await createActivity(
      {
        userId,
        workspaceId: project.workspaceId,
        action: "PROJECT_DELETED",
        entityType: "PROJECT",
        entityId: project.id,
        metadata: {
          projectName: project.name,
          description: project.description,
        },
      },
      tx,
    );

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      workspaceId: project.workspaceId,
    };
  });
};

export const getProjectDecisions = async (
  userId: number,
  projectId: number,
) => {
  const { project } = await getAccessibleProject(userId, projectId);

  const decisions = await db.orm.public.Decision.where({
    projectId,
  }).all();

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
    },
    decisionCount: decisions.length,
    decisions,
  };
};

export const getProjectGraph = async (userId: number, projectId: number) => {
  const { project } = await getAccessibleProject(userId, projectId);

  const decisions = await db.orm.public.Decision.where({
    projectId,
  }).all();

  const nodes = decisions.map((decision) => ({
    id: String(decision.id),
    title: decision.title,
    status: decision.status,
    context: decision.context,
    decision: decision.decision,
    reasoning: decision.reasoning,
  }));

  const decisionIds = decisions.map((decision) => decision.id);
  const decisionIdSet = new Set(decisionIds);

  const relations =
    decisionIds.length === 0
      ? []
      : await db.orm.public.DecisionRelation.where((relation) =>
          relation.sourceDecisionId.in(decisionIds),
        ).all();

  const edges = relations
    .filter((relation) => decisionIdSet.has(relation.targetDecisionId))
    .map((relation) => ({
      id: String(relation.id),
      source: String(relation.sourceDecisionId),
      target: String(relation.targetDecisionId),
      type: relation.type,
    }));

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
    },
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
  };
};
