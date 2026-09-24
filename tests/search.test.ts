import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { db } from "../src/prisma/db.js";

const userA = {
  name: "Search Test User A",
  email: "automated-search-a@thread.dev",
  password: "Test1234!",
};

const userB = {
  name: "Search Test User B",
  email: "automated-search-b@thread.dev",
  password: "Test1234!",
};

const testEmails = [userA.email, userB.email];

let userAToken = "";
let userBToken = "";

let workspaceAId = 0;
let workspaceBId = 0;

let projectAId = 0;
let projectBId = 0;

const registerAndLogin = async (user: typeof userA) => {
  const registerResponse = await request(app)
    .post("/api/v1/auth/register")
    .send(user);

  expect(registerResponse.status).toBe(201);

  const loginResponse = await request(app).post("/api/v1/auth/login").send({
    email: user.email,
    password: user.password,
  });

  expect(loginResponse.status).toBe(200);

  return {
    userId: loginResponse.body.data.user.id as number,
    token: loginResponse.body.data.token as string,
  };
};

const createDecision = async (
  token: string,
  projectId: number,
  data: {
    title: string;
    context: string;
    decision: string;
    reasoning?: string;
    status?: string;
  },
) => {
  const response = await request(app)
    .post(`/api/v1/projects/${projectId}/decisions`)
    .set("Authorization", `Bearer ${token}`)
    .send(data);

  expect(response.status).toBe(201);

  return response.body.data.decision;
};

const cleanupTestData = async () => {
  const users = [];

  for (const email of testEmails) {
    const user = await db.orm.public.User.where({
      email,
    }).first();

    if (user) {
      users.push(user);
    }
  }

  const userIds = users.map((user) => user.id);

  if (userIds.length > 0) {
    const memberships = await db.orm.public.WorkspaceMember.where(
      (membership) => membership.userId.in(userIds),
    ).all();

    const workspaceIds = [
      ...new Set(memberships.map((membership) => membership.workspaceId)),
    ];

    for (const currentWorkspaceId of workspaceIds) {
      const workspace = await db.orm.public.Workspace.where({
        id: currentWorkspaceId,
      }).first();

      if (!workspace || !workspace.name.startsWith("Automated Search Test")) {
        continue;
      }

      const projects = await db.orm.public.Project.where({
        workspaceId: currentWorkspaceId,
      }).all();

      const projectIds = projects.map((project) => project.id);

      const decisions =
        projectIds.length === 0
          ? []
          : await db.orm.public.Decision.where((decision) =>
              decision.projectId.in(projectIds),
            ).all();

      const decisionIds = decisions.map((decision) => decision.id);

      if (decisionIds.length > 0) {
        const outgoingRelations = await db.orm.public.DecisionRelation.where(
          (relation) => relation.sourceDecisionId.in(decisionIds),
        ).all();

        for (const relation of outgoingRelations) {
          await db.orm.public.DecisionRelation.where({
            id: relation.id,
          }).delete();
        }

        const remainingIncomingRelations =
          await db.orm.public.DecisionRelation.where((relation) =>
            relation.targetDecisionId.in(decisionIds),
          ).all();

        for (const relation of remainingIncomingRelations) {
          await db.orm.public.DecisionRelation.where({
            id: relation.id,
          }).delete();
        }

        for (const decision of decisions) {
          const histories = await db.orm.public.DecisionStatusHistory.where({
            decisionId: decision.id,
          }).all();

          for (const history of histories) {
            await db.orm.public.DecisionStatusHistory.where({
              id: history.id,
            }).delete();
          }

          await db.orm.public.Decision.where({
            id: decision.id,
          }).delete();
        }
      }

      for (const project of projects) {
        await db.orm.public.Project.where({
          id: project.id,
        }).delete();
      }

      const activities = await db.orm.public.ActivityLog.where({
        workspaceId: currentWorkspaceId,
      }).all();

      for (const activity of activities) {
        await db.orm.public.ActivityLog.where({
          id: activity.id,
        }).delete();
      }

      const workspaceMemberships = await db.orm.public.WorkspaceMember.where({
        workspaceId: currentWorkspaceId,
      }).all();

      for (const membership of workspaceMemberships) {
        await db.orm.public.WorkspaceMember.where({
          id: membership.id,
        }).delete();
      }

      await db.orm.public.Workspace.where({
        id: currentWorkspaceId,
      }).delete();
    }
  }

  for (const email of testEmails) {
    const user = await db.orm.public.User.where({
      email,
    }).first();

    if (!user) {
      continue;
    }

    const memberships = await db.orm.public.WorkspaceMember.where({
      userId: user.id,
    }).all();

    const activities = await db.orm.public.ActivityLog.where({
      userId: user.id,
    }).all();

    const histories = await db.orm.public.DecisionStatusHistory.where({
      changedById: user.id,
    }).all();

    if (
      memberships.length === 0 &&
      activities.length === 0 &&
      histories.length === 0
    ) {
      await db.orm.public.User.where({
        id: user.id,
      }).delete();
    }
  }
};

describe("Global Search API", () => {
  beforeAll(async () => {
    await cleanupTestData();

    const accountA = await registerAndLogin(userA);

    userAToken = accountA.token;

    const accountB = await registerAndLogin(userB);

    userBToken = accountB.token;

    const workspaceAResponse = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        name: "Automated Search Test Engineering",
      });

    expect(workspaceAResponse.status).toBe(201);

    workspaceAId = workspaceAResponse.body.data.workspace.id;

    const workspaceBResponse = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${userBToken}`)
      .send({
        name: "Automated Search Test Private",
      });

    expect(workspaceBResponse.status).toBe(201);

    workspaceBId = workspaceBResponse.body.data.workspace.id;

    const projectAResponse = await request(app)
      .post(`/api/v1/workspaces/${workspaceAId}/projects`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        name: "Eventra Architecture",
        description: "Search integration test project.",
      });

    expect(projectAResponse.status).toBe(201);

    projectAId = projectAResponse.body.data.project.id;

    const projectBResponse = await request(app)
      .post(`/api/v1/workspaces/${workspaceBId}/projects`)
      .set("Authorization", `Bearer ${userBToken}`)
      .send({
        name: "Private Architecture",
        description: "Private search integration project.",
      });

    expect(projectBResponse.status).toBe(201);

    projectBId = projectBResponse.body.data.project.id;

    await createDecision(userAToken, projectAId, {
      title: "Choose PostgreSQL",
      context: "The platform needs PostgreSQL relational storage.",
      decision: "Use PostgreSQL as the primary database.",
      reasoning: "PostgreSQL provides reliable transactions.",
      status: "ACCEPTED",
    });

    await createDecision(userAToken, projectAId, {
      title: "Use Prisma ORM",
      context: "The Eventra backend needs typed database access.",
      decision: "Use Prisma for database operations.",
      reasoning: "Typed queries improve maintainability.",
      status: "ACCEPTED",
    });

    await createDecision(userAToken, projectAId, {
      title: "Repository Layer",
      context: "Eventra needs clear data access boundaries.",
      decision: "Use a repository abstraction.",
      reasoning: "Separates business and persistence logic.",
      status: "PROPOSED",
    });

    await createDecision(userAToken, projectAId, {
      title: "TypeScript Backend",
      context: "Eventra needs safer backend development.",
      decision: "Use TypeScript throughout the API.",
      reasoning: "Static types reduce implementation errors.",
      status: "ACCEPTED",
    });

    await createDecision(userAToken, projectAId, {
      title: "Redis Cache",
      context: "Eventra may need faster repeated reads.",
      decision: "Evaluate Redis caching.",
      reasoning: "Caching could reduce database load.",
      status: "PROPOSED",
    });

    await createDecision(userBToken, projectBId, {
      title: "Secret PostgreSQL Decision",
      context: "This private workspace also uses PostgreSQL.",
      decision: "Use PostgreSQL for the private system.",
      reasoning: "This must never appear in User A search.",
      status: "ACCEPTED",
    });
  }, 30_000);

  afterAll(async () => {
    await cleanupTestData();
  }, 30_000);

  it("rejects search without authentication", async () => {
    const response = await request(app).get("/api/v1/search?q=postgres");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("requires a search query", async () => {
    const response = await request(app)
      .get("/api/v1/search")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Search query is required");
  });

  it("rejects a one-character query", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=a")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Search query must be at least 2 characters",
    );
  });

  it("rejects a query longer than 100 characters", async () => {
    const query = "a".repeat(101);

    const response = await request(app)
      .get(`/api/v1/search?q=${query}`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Search query must not exceed 100 characters",
    );
  });

  it("rejects an invalid page", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=Eventra&page=0")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Page must be a positive integer");
  });

  it("rejects a non-integer page", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=Eventra&page=1.5")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Page must be a positive integer");
  });

  it("rejects a limit greater than 100", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=Eventra&limit=101")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Limit must be a positive integer between 1 and 100",
    );
  });

  it("finds a decision by title and content", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=postgres")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Search completed successfully");

    expect(response.body.data.query).toBe("postgres");

    expect(response.body.data.pagination.total).toBe(1);

    expect(response.body.data.results).toHaveLength(1);

    expect(response.body.data.results[0]).toMatchObject({
      title: "Choose PostgreSQL",
      projectId: projectAId,
      projectName: "Eventra Architecture",
      workspaceId: workspaceAId,
      workspaceName: "Automated Search Test Engineering",
    });
  });

  it("searches project names", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=Eventra")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.pagination.total).toBe(5);

    expect(response.body.data.results).toHaveLength(5);
  });

  it("search is case-insensitive", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=POSTGRESQL")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.pagination.total).toBe(1);

    expect(response.body.data.results[0].title).toBe("Choose PostgreSQL");
  });

  it("trims the search query", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=%20%20Redis%20%20")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.query).toBe("Redis");

    expect(response.body.data.pagination.total).toBe(1);

    expect(response.body.data.results[0].title).toBe("Redis Cache");
  });

  it("returns empty results when nothing matches", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=zzzznotfound")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    expect(response.body.data.results).toEqual([]);
  });

  it("paginates search results", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=Eventra&page=2&limit=2")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.pagination).toMatchObject({
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });

    expect(response.body.data.results).toHaveLength(2);
  });

  it("returns an empty page beyond the final page", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=Eventra&page=99&limit=2")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.pagination).toMatchObject({
      page: 99,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    });

    expect(response.body.data.results).toEqual([]);
  });

  it("does not expose decisions from another workspace", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=Secret")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.pagination.total).toBe(0);

    expect(response.body.data.results).toEqual([]);
  });

  it("allows the owning user to find their private decision", async () => {
    const response = await request(app)
      .get("/api/v1/search?q=Secret")
      .set("Authorization", `Bearer ${userBToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.pagination.total).toBe(1);

    expect(response.body.data.results).toHaveLength(1);

    expect(response.body.data.results[0]).toMatchObject({
      title: "Secret PostgreSQL Decision",
      projectId: projectBId,
      workspaceId: workspaceBId,
    });
  });
});
