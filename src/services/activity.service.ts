import { db, type Tx } from "../prisma/db.js";

type CreateActivityInput = {
  userId: number;
  workspaceId: number;
  action: string;
  entityType: string;
  entityId?: number | null;
  metadata?: Record<string, unknown> | null;
};

type ActivityPaginationOptions = {
  page: number;
  limit: number;
};

export const createActivity = async (input: CreateActivityInput, tx?: Tx) => {
  const orm = tx?.orm ?? db.orm;

  const activity = await orm.public.ActivityLog.create({
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    userId: input.userId,
    workspaceId: input.workspaceId,
  });

  return activity;
};

export const getWorkspaceActivities = async (
  userId: number,
  workspaceId: number,
  options: ActivityPaginationOptions,
) => {
  const membership = await db.orm.public.WorkspaceMember.where({
    userId,
    workspaceId,
  }).first();

  if (!membership) {
    throw new Error("WORKSPACE_ACCESS_DENIED");
  }

  const offset = (options.page - 1) * options.limit;

  const allActivities = await db.orm.public.ActivityLog.where({
    workspaceId,
  }).all();

  const total = allActivities.length;

  const totalPages = total === 0 ? 0 : Math.ceil(total / options.limit);

  const activities = await db.orm.public.ActivityLog.where({
    workspaceId,
  })
    .orderBy((activity) => activity.createdAt.desc())
    .offset(offset)
    .limit(options.limit)
    .all();

  const actorIds = [...new Set(activities.map((activity) => activity.userId))];

  const actors =
    actorIds.length === 0
      ? []
      : await db.orm.public.User.where((user) => user.id.in(actorIds)).all();

  const actorById = new Map(
    actors.map((actor) => [
      actor.id,
      {
        id: actor.id,
        name: actor.name,
        email: actor.email,
      },
    ]),
  );

  const formattedActivities = activities.map((activity) => {
    let metadata: unknown = null;

    if (activity.metadata) {
      try {
        metadata = JSON.parse(activity.metadata);
      } catch {
        metadata = activity.metadata;
      }
    }

    return {
      id: activity.id,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      actor: actorById.get(activity.userId) ?? null,
      metadata,
      createdAt: activity.createdAt,
    };
  });

  return {
    workspaceId,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPreviousPage: options.page > 1,
    },
    activities: formattedActivities,
  };
};
