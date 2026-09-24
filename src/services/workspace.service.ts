import { db } from "../prisma/db.js";

import type {
  AddWorkspaceMemberInput,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  UpdateWorkspaceMemberRoleInput,
} from "../schemas/workspace.schema.js";

import {
  hasMinimumWorkspaceRole,
  type WorkspaceRole,
} from "../utils/workspace-permissions.js";

import { createActivity } from "./activity.service.js";

const createSlug = (name: string) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const createWorkspace = async (
  userId: number,
  input: CreateWorkspaceInput,
) => {
  const baseSlug = createSlug(input.name);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  return db.transaction(async (tx) => {
    const workspace = await tx.orm.public.Workspace.create({
      name: input.name,
      slug,
    });

    await tx.orm.public.WorkspaceMember.create({
      userId,
      workspaceId: workspace.id,
      role: "OWNER",
    });

    return workspace;
  });
};

export const getUserWorkspaces = async (userId: number) => {
  const memberships = await db.orm.public.WorkspaceMember.where({
    userId,
  }).all();

  const workspaceIds = memberships.map((membership) => membership.workspaceId);

  if (workspaceIds.length === 0) {
    return {
      workspaceCount: 0,
      workspaces: [],
    };
  }

  const workspaces = await db.orm.public.Workspace.where((workspace) =>
    workspace.id.in(workspaceIds),
  ).all();

  const allMemberships = await db.orm.public.WorkspaceMember.where(
    (membership) => membership.workspaceId.in(workspaceIds),
  ).all();

  const projects = await db.orm.public.Project.where((project) =>
    project.workspaceId.in(workspaceIds),
  ).all();

  const memberCounts = new Map<number, number>();

  for (const membership of allMemberships) {
    memberCounts.set(
      membership.workspaceId,
      (memberCounts.get(membership.workspaceId) ?? 0) + 1,
    );
  }

  const projectCounts = new Map<number, number>();

  for (const project of projects) {
    projectCounts.set(
      project.workspaceId,
      (projectCounts.get(project.workspaceId) ?? 0) + 1,
    );
  }

  const workspaceById = new Map(
    workspaces.map((workspace) => [workspace.id, workspace]),
  );

  const formattedWorkspaces = memberships.flatMap((membership) => {
    const workspace = workspaceById.get(membership.workspaceId);

    if (!workspace) {
      return [];
    }

    return [
      {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: membership.role,
        memberCount: memberCounts.get(workspace.id) ?? 0,
        projectCount: projectCounts.get(workspace.id) ?? 0,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
    ];
  });

  return {
    workspaceCount: formattedWorkspaces.length,
    workspaces: formattedWorkspaces,
  };
};

export const getWorkspaceById = async (userId: number, workspaceId: number) => {
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

  const members = await db.orm.public.WorkspaceMember.where({
    workspaceId,
  }).all();

  const projects = await db.orm.public.Project.where({
    workspaceId,
  }).all();

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    currentUserRole: membership.role,
    memberCount: members.length,
    projectCount: projects.length,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
};

export const updateWorkspace = async (
  userId: number,
  workspaceId: number,
  input: UpdateWorkspaceInput,
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

  if (membership.role !== "OWNER") {
    throw new Error("OWNER_ROLE_REQUIRED");
  }

  if (workspace.name === input.name) {
    throw new Error("WORKSPACE_NAME_UNCHANGED");
  }

  const previousName = workspace.name;

  return db.transaction(async (tx) => {
    const updatedWorkspace = await tx.orm.public.Workspace.where({
      id: workspaceId,
    }).update({
      name: input.name,
    });

    if (!updatedWorkspace) {
      throw new Error("WORKSPACE_UPDATE_FAILED");
    }

    await createActivity(
      {
        userId,
        workspaceId,
        action: "WORKSPACE_UPDATED",
        entityType: "WORKSPACE",
        entityId: workspaceId,
        metadata: {
          previousName,
          newName: updatedWorkspace.name,
        },
      },
      tx,
    );

    return updatedWorkspace;
  });
};

export const getWorkspaceMembers = async (
  userId: number,
  workspaceId: number,
) => {
  const workspace = await db.orm.public.Workspace.where({
    id: workspaceId,
  }).first();

  if (!workspace) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }

  const requestingMembership = await db.orm.public.WorkspaceMember.where({
    userId,
    workspaceId,
  }).first();

  if (!requestingMembership) {
    throw new Error("WORKSPACE_ACCESS_DENIED");
  }

  const memberships = await db.orm.public.WorkspaceMember.where({
    workspaceId,
  }).all();

  const userIds = memberships.map((membership) => membership.userId);

  const users =
    userIds.length === 0
      ? []
      : await db.orm.public.User.where((user) => user.id.in(userIds)).all();

  const userById = new Map(users.map((user) => [user.id, user]));

  const members = memberships.flatMap((membership) => {
    const user = userById.get(membership.userId);

    if (!user) {
      return [];
    }

    return [
      {
        id: membership.id,
        role: membership.role,
        joinedAt: membership.createdAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
    ];
  });

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    },
    currentUserRole: requestingMembership.role,
    memberCount: members.length,
    members,
  };
};

export const addWorkspaceMember = async (
  requestingUserId: number,
  workspaceId: number,
  input: AddWorkspaceMemberInput,
) => {
  const workspace = await db.orm.public.Workspace.where({
    id: workspaceId,
  }).first();

  if (!workspace) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }

  const requestingMembership = await db.orm.public.WorkspaceMember.where({
    userId: requestingUserId,
    workspaceId,
  }).first();

  if (!requestingMembership) {
    throw new Error("WORKSPACE_ACCESS_DENIED");
  }

  const hasPermission = hasMinimumWorkspaceRole(
    requestingMembership.role as WorkspaceRole,
    "ADMIN",
  );

  if (!hasPermission) {
    throw new Error("INSUFFICIENT_WORKSPACE_ROLE");
  }

  const user = await db.orm.public.User.where({
    email: input.email,
  }).first();

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const existingMembership = await db.orm.public.WorkspaceMember.where({
    userId: user.id,
    workspaceId,
  }).first();

  if (existingMembership) {
    throw new Error("WORKSPACE_MEMBER_ALREADY_EXISTS");
  }

  return db.transaction(async (tx) => {
    /*
     * Recheck inside the transaction before
     * creating the membership.
     */
    const membershipInsideTransaction =
      await tx.orm.public.WorkspaceMember.where({
        userId: user.id,
        workspaceId,
      }).first();

    if (membershipInsideTransaction) {
      throw new Error("WORKSPACE_MEMBER_ALREADY_EXISTS");
    }

    const membership = await tx.orm.public.WorkspaceMember.create({
      userId: user.id,
      workspaceId,
      role: input.role,
    });

    await createActivity(
      {
        userId: requestingUserId,
        workspaceId,
        action: "WORKSPACE_MEMBER_ADDED",
        entityType: "WORKSPACE_MEMBER",
        entityId: membership.id,
        metadata: {
          memberUserId: user.id,
          memberName: user.name,
          memberEmail: user.email,
          role: membership.role,
        },
      },
      tx,
    );

    return {
      id: membership.id,
      role: membership.role,
      joinedAt: membership.createdAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  });
};

export const updateWorkspaceMemberRole = async (
  requestingUserId: number,
  workspaceId: number,
  memberId: number,
  input: UpdateWorkspaceMemberRoleInput,
) => {
  const workspace = await db.orm.public.Workspace.where({
    id: workspaceId,
  }).first();

  if (!workspace) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }

  const requestingMembership = await db.orm.public.WorkspaceMember.where({
    userId: requestingUserId,
    workspaceId,
  }).first();

  if (!requestingMembership) {
    throw new Error("WORKSPACE_ACCESS_DENIED");
  }

  if (requestingMembership.role !== "OWNER") {
    throw new Error("OWNER_ROLE_REQUIRED");
  }

  const targetMembership = await db.orm.public.WorkspaceMember.where({
    id: memberId,
    workspaceId,
  }).first();

  if (!targetMembership) {
    throw new Error("WORKSPACE_MEMBER_NOT_FOUND");
  }

  if (targetMembership.role === "OWNER") {
    throw new Error("OWNER_ROLE_CHANGE_NOT_ALLOWED");
  }

  if (targetMembership.role === input.role) {
    throw new Error("MEMBER_ROLE_UNCHANGED");
  }

  const user = await db.orm.public.User.where({
    id: targetMembership.userId,
  }).first();

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return db.transaction(async (tx) => {
    const membershipInsideTransaction =
      await tx.orm.public.WorkspaceMember.where({
        id: memberId,
        workspaceId,
      }).first();

    if (!membershipInsideTransaction) {
      throw new Error("WORKSPACE_MEMBER_NOT_FOUND");
    }

    if (membershipInsideTransaction.role === "OWNER") {
      throw new Error("OWNER_ROLE_CHANGE_NOT_ALLOWED");
    }

    if (membershipInsideTransaction.role === input.role) {
      throw new Error("MEMBER_ROLE_UNCHANGED");
    }

    const updatedMembership = await tx.orm.public.WorkspaceMember.where({
      id: memberId,
      workspaceId,
    }).update({
      role: input.role,
    });

    if (!updatedMembership) {
      throw new Error("WORKSPACE_MEMBER_UPDATE_FAILED");
    }

    await createActivity(
      {
        userId: requestingUserId,
        workspaceId,
        action: "WORKSPACE_MEMBER_ROLE_CHANGED",
        entityType: "WORKSPACE_MEMBER",
        entityId: updatedMembership.id,
        metadata: {
          memberUserId: user.id,
          memberName: user.name,
          memberEmail: user.email,
          previousRole: membershipInsideTransaction.role,
          newRole: updatedMembership.role,
        },
      },
      tx,
    );

    return {
      id: updatedMembership.id,
      previousRole: membershipInsideTransaction.role,
      role: updatedMembership.role,
      joinedAt: updatedMembership.createdAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  });
};

export const removeWorkspaceMember = async (
  requestingUserId: number,
  workspaceId: number,
  memberId: number,
) => {
  const workspace = await db.orm.public.Workspace.where({
    id: workspaceId,
  }).first();

  if (!workspace) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }

  const requestingMembership = await db.orm.public.WorkspaceMember.where({
    userId: requestingUserId,
    workspaceId,
  }).first();

  if (!requestingMembership) {
    throw new Error("WORKSPACE_ACCESS_DENIED");
  }

  const hasPermission = hasMinimumWorkspaceRole(
    requestingMembership.role as WorkspaceRole,
    "ADMIN",
  );

  if (!hasPermission) {
    throw new Error("INSUFFICIENT_WORKSPACE_ROLE");
  }

  const targetMembership = await db.orm.public.WorkspaceMember.where({
    id: memberId,
    workspaceId,
  }).first();

  if (!targetMembership) {
    throw new Error("WORKSPACE_MEMBER_NOT_FOUND");
  }

  if (targetMembership.userId === requestingUserId) {
    throw new Error("SELF_REMOVAL_NOT_ALLOWED");
  }

  if (targetMembership.role === "OWNER") {
    throw new Error("OWNER_REMOVAL_NOT_ALLOWED");
  }

  if (
    requestingMembership.role === "ADMIN" &&
    targetMembership.role === "ADMIN"
  ) {
    throw new Error("ADMIN_CANNOT_REMOVE_ADMIN");
  }

  const user = await db.orm.public.User.where({
    id: targetMembership.userId,
  }).first();

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return db.transaction(async (tx) => {
    const membershipToRemove = await tx.orm.public.WorkspaceMember.where({
      id: memberId,
      workspaceId,
    }).first();

    if (!membershipToRemove) {
      throw new Error("WORKSPACE_MEMBER_NOT_FOUND");
    }

    if (membershipToRemove.userId === requestingUserId) {
      throw new Error("SELF_REMOVAL_NOT_ALLOWED");
    }

    if (membershipToRemove.role === "OWNER") {
      throw new Error("OWNER_REMOVAL_NOT_ALLOWED");
    }

    if (
      requestingMembership.role === "ADMIN" &&
      membershipToRemove.role === "ADMIN"
    ) {
      throw new Error("ADMIN_CANNOT_REMOVE_ADMIN");
    }

    await tx.orm.public.WorkspaceMember.where({
      id: memberId,
      workspaceId,
    }).delete();

    await createActivity(
      {
        userId: requestingUserId,
        workspaceId,
        action: "WORKSPACE_MEMBER_REMOVED",
        entityType: "WORKSPACE_MEMBER",
        entityId: memberId,
        metadata: {
          memberUserId: user.id,
          memberName: user.name,
          memberEmail: user.email,
          previousRole: membershipToRemove.role,
        },
      },
      tx,
    );

    return {
      id: memberId,
      previousRole: membershipToRemove.role,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  });
};
