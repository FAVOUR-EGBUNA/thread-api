import { db } from "../prisma/db.js";

type SearchResult = {
  id: number;
  title: string;
  context: string;
  decision: string;
  reasoning: string | null;
  status: string;
  projectId: number;
  projectName: string;
  workspaceId: number;
  workspaceName: string;
};

type SearchOptions = {
  page: number;
  limit: number;
};

export const searchDecisions = async (
  userId: number,
  rawQuery: string,
  options: SearchOptions,
) => {
  const query = rawQuery.trim().toLowerCase();

  const memberships = await db.orm.public.WorkspaceMember.where({
    userId,
  }).all();

  if (memberships.length === 0) {
    return {
      query: rawQuery.trim(),
      pagination: {
        page: options.page,
        limit: options.limit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      results: [] as SearchResult[],
    };
  }

  const workspaceIds = [
    ...new Set(memberships.map((membership) => membership.workspaceId)),
  ];

  const workspaces = await db.orm.public.Workspace.where((workspace) =>
    workspace.id.in(workspaceIds),
  ).all();

  const workspaceById = new Map(
    workspaces.map((workspace) => [workspace.id, workspace]),
  );

  const projects = await db.orm.public.Project.where((project) =>
    project.workspaceId.in(workspaceIds),
  ).all();

  if (projects.length === 0) {
    return {
      query: rawQuery.trim(),
      pagination: {
        page: options.page,
        limit: options.limit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      results: [] as SearchResult[],
    };
  }

  const projectIds = projects.map((project) => project.id);

  const decisions = await db.orm.public.Decision.where((decision) =>
    decision.projectId.in(projectIds),
  ).all();

  const projectById = new Map(projects.map((project) => [project.id, project]));

  const results: SearchResult[] = [];
  const seenDecisionIds = new Set<number>();

  for (const decision of decisions) {
    if (seenDecisionIds.has(decision.id)) {
      continue;
    }

    const project = projectById.get(decision.projectId);

    if (!project) {
      continue;
    }

    const workspace = workspaceById.get(project.workspaceId);

    if (!workspace) {
      continue;
    }

    const searchableText = [
      decision.title,
      decision.context,
      decision.decision,
      decision.reasoning ?? "",
      decision.status,
      project.name,
      workspace.name,
    ]
      .join(" ")
      .toLowerCase();

    if (!searchableText.includes(query)) {
      continue;
    }

    seenDecisionIds.add(decision.id);

    results.push({
      id: decision.id,
      title: decision.title,
      context: decision.context,
      decision: decision.decision,
      reasoning: decision.reasoning,
      status: decision.status,
      projectId: project.id,
      projectName: project.name,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    });
  }

  const total = results.length;

  const totalPages = total === 0 ? 0 : Math.ceil(total / options.limit);

  const startIndex = (options.page - 1) * options.limit;

  const paginatedResults = results.slice(
    startIndex,
    startIndex + options.limit,
  );

  return {
    query: rawQuery.trim(),
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPreviousPage: options.page > 1,
    },
    results: paginatedResults,
  };
};
