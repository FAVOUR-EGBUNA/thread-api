import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { db } from "../src/prisma/db.js";

const ownerUser = {
  name: "Relation Test Owner",
  email: "relation-owner-test@thread.dev",
  password: "Test1234!",
};

const memberUser = {
  name: "Relation Test Member",
  email: "relation-member-test@thread.dev",
  password: "Test1234!",
};

const outsiderUser = {
  name: "Relation Test Outsider",
  email: "relation-outsider-test@thread.dev",
  password: "Test1234!",
};

const testEmails = [ownerUser.email, memberUser.email, outsiderUser.email];

let ownerToken = "";
let memberToken = "";
let outsiderToken = "";

let memberUserId = 0;

let workspaceId = 0;
let projectId = 0;
let secondProjectId = 0;

let databaseDecisionId = 0;
let prismaDecisionId = 0;
let repositoryDecisionId = 0;
let typescriptDecisionId = 0;
let crossProjectDecisionId = 0;

let prismaDependsOnDatabaseRelationId = 0;
let repositoryDependsOnPrismaRelationId = 0;
let relatedRelationId = 0;

const registerAndLogin = async (user: typeof ownerUser) => {
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

      if (!workspace || !workspace.name.startsWith("Automated Relation Test")) {
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
        const relations = await db.orm.public.DecisionRelation.where(
          (relation) => relation.sourceDecisionId.in(decisionIds),
        ).all();

        for (const relation of relations) {
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

const createDecision = async (targetProjectId: number, title: string) => {
  const response = await request(app)
    .post(`/api/v1/projects/${targetProjectId}/decisions`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      title,
      context:
        "This decision exists for automated relationship integration testing.",
      decision: "Use this decision as part of the relationship graph.",
      reasoning:
        "It allows deterministic testing of THREAD dependency traversal.",
      status: "ACCEPTED",
    });

  expect(response.status).toBe(201);

  return response.body.data.decision.id as number;
};

describe("Decision Relationship and Impact API", () => {
  beforeAll(async () => {
    await cleanupTestData();

    const owner = await registerAndLogin(ownerUser);
    ownerToken = owner.token;

    const member = await registerAndLogin(memberUser);
    memberUserId = member.userId;
    memberToken = member.token;

    const outsider = await registerAndLogin(outsiderUser);
    outsiderToken = outsider.token;

    const workspaceResponse = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Automated Relation Test Workspace",
      });

    expect(workspaceResponse.status).toBe(201);

    workspaceId = workspaceResponse.body.data.workspace.id;

    const addMemberResponse = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        email: memberUser.email,
        role: "MEMBER",
      });

    expect(addMemberResponse.status).toBe(201);

    const projectResponse = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Automated Relation Test Project",
      });

    expect(projectResponse.status).toBe(201);

    projectId = projectResponse.body.data.project.id;

    const secondProjectResponse = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Automated Relation Test Second Project",
      });

    expect(secondProjectResponse.status).toBe(201);

    secondProjectId = secondProjectResponse.body.data.project.id;

    databaseDecisionId = await createDecision(projectId, "Choose PostgreSQL");

    prismaDecisionId = await createDecision(projectId, "Use Prisma ORM");

    repositoryDecisionId = await createDecision(
      projectId,
      "Use Repository Layer",
    );

    typescriptDecisionId = await createDecision(projectId, "Use TypeScript");

    crossProjectDecisionId = await createDecision(
      secondProjectId,
      "Cross Project Decision",
    );
  }, 30_000);

  afterAll(async () => {
    await cleanupTestData();
  }, 30_000);

  it("rejects relationship creation without authentication", async () => {
    const response = await request(app)
      .post(`/api/v1/decisions/${prismaDecisionId}/relations`)
      .send({
        targetDecisionId: databaseDecisionId,
        type: "DEPENDS_ON",
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("rejects an invalid relationship type", async () => {
    const response = await request(app)
      .post(`/api/v1/decisions/${prismaDecisionId}/relations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        targetDecisionId: databaseDecisionId,
        type: "USES",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation failed");
  });

  it("rejects a self relationship", async () => {
    const response = await request(app)
      .post(`/api/v1/decisions/${databaseDecisionId}/relations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        targetDecisionId: databaseDecisionId,
        type: "DEPENDS_ON",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("A decision cannot relate to itself");
  });

  it("rejects a cross-project relationship", async () => {
    const response = await request(app)
      .post(`/api/v1/decisions/${databaseDecisionId}/relations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        targetDecisionId: crossProjectDecisionId,
        type: "DEPENDS_ON",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Decisions must belong to the same project",
    );
  });

  it("prevents a MEMBER from creating a relationship", async () => {
    const response = await request(app)
      .post(`/api/v1/decisions/${prismaDecisionId}/relations`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        targetDecisionId: databaseDecisionId,
        type: "DEPENDS_ON",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have permission to create decision relationships in this workspace",
    );
  });

  it("prevents an outsider from creating a relationship", async () => {
    const response = await request(app)
      .post(`/api/v1/decisions/${prismaDecisionId}/relations`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({
        targetDecisionId: databaseDecisionId,
        type: "DEPENDS_ON",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have access to these decisions",
    );
  });

  it("creates Prisma DEPENDS_ON PostgreSQL", async () => {
    const response = await request(app)
      .post(`/api/v1/decisions/${prismaDecisionId}/relations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        targetDecisionId: databaseDecisionId,
        type: "DEPENDS_ON",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.relation).toMatchObject({
      sourceDecisionId: prismaDecisionId,
      targetDecisionId: databaseDecisionId,
      type: "DEPENDS_ON",
    });

    prismaDependsOnDatabaseRelationId = response.body.data.relation.id;
  });

  it("rejects a duplicate relationship", async () => {
    const response = await request(app)
      .post(`/api/v1/decisions/${prismaDecisionId}/relations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        targetDecisionId: databaseDecisionId,
        type: "DEPENDS_ON",
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "This decision relationship already exists",
    );
  });

  it("creates Repository DEPENDS_ON Prisma", async () => {
    const response = await request(app)
      .post(`/api/v1/decisions/${repositoryDecisionId}/relations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        targetDecisionId: prismaDecisionId,
        type: "DEPENDS_ON",
      });

    expect(response.status).toBe(201);

    repositoryDependsOnPrismaRelationId = response.body.data.relation.id;

    expect(response.body.data.relation).toMatchObject({
      sourceDecisionId: repositoryDecisionId,
      targetDecisionId: prismaDecisionId,
      type: "DEPENDS_ON",
    });
  });

  it("creates a non-dependency relationship", async () => {
    const response = await request(app)
      .post(`/api/v1/decisions/${typescriptDecisionId}/relations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        targetDecisionId: databaseDecisionId,
        type: "RELATED_TO",
      });

    expect(response.status).toBe(201);

    relatedRelationId = response.body.data.relation.id;

    expect(response.body.data.relation.type).toBe("RELATED_TO");
  });

  it("returns direct and transitive impact", async () => {
    const response = await request(app)
      .get(`/api/v1/decisions/${databaseDecisionId}/impact`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.rootDecision.id).toBe(databaseDecisionId);

    expect(response.body.data.impactCount).toBe(2);
    expect(response.body.data.maxDepth).toBe(2);

    const impacted = response.body.data.impactedDecisions;

    const prismaImpact = impacted.find(
      (item: { decision: { id: number } }) =>
        item.decision.id === prismaDecisionId,
    );

    const repositoryImpact = impacted.find(
      (item: { decision: { id: number } }) =>
        item.decision.id === repositoryDecisionId,
    );

    expect(prismaImpact).toMatchObject({
      relationId: prismaDependsOnDatabaseRelationId,
      relationship: "DEPENDS_ON",
      depth: 1,
    });

    expect(repositoryImpact).toMatchObject({
      relationId: repositoryDependsOnPrismaRelationId,
      relationship: "DEPENDS_ON",
      depth: 2,
    });

    expect(
      impacted.some(
        (item: { decision: { id: number } }) =>
          item.decision.id === typescriptDecisionId,
      ),
    ).toBe(false);
  });

  it("prevents an outsider from viewing impact", async () => {
    const response = await request(app)
      .get(`/api/v1/decisions/${databaseDecisionId}/impact`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have access to this decision",
    );
  });

  it("shows all relationships in the project graph", async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/graph`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.nodeCount).toBe(4);
    expect(response.body.data.edgeCount).toBe(3);

    expect(response.body.data.nodes).toHaveLength(4);
    expect(response.body.data.edges).toHaveLength(3);

    expect(response.body.data.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: String(prismaDecisionId),
          target: String(databaseDecisionId),
          type: "DEPENDS_ON",
        }),
        expect.objectContaining({
          source: String(repositoryDecisionId),
          target: String(prismaDecisionId),
          type: "DEPENDS_ON",
        }),
        expect.objectContaining({
          source: String(typescriptDecisionId),
          target: String(databaseDecisionId),
          type: "RELATED_TO",
        }),
      ]),
    );
  });

  it("creates a dependency cycle safely", async () => {
    const response = await request(app)
      .post(`/api/v1/decisions/${databaseDecisionId}/relations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        targetDecisionId: repositoryDecisionId,
        type: "DEPENDS_ON",
      });

    expect(response.status).toBe(201);
  });

  it("handles a dependency cycle without infinite traversal", async () => {
    const response = await request(app)
      .get(`/api/v1/decisions/${databaseDecisionId}/impact`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.impactCount).toBe(2);
    expect(response.body.data.maxDepth).toBe(2);

    const impactedIds = response.body.data.impactedDecisions.map(
      (item: { decision: { id: number } }) => item.decision.id,
    );

    expect(impactedIds).toContain(prismaDecisionId);

    expect(impactedIds).toContain(repositoryDecisionId);

    expect(impactedIds).not.toContain(databaseDecisionId);
  });

  it("promotes the MEMBER to ADMIN", async () => {
    const membership = await db.orm.public.WorkspaceMember.where({
      userId: memberUserId,
      workspaceId,
    }).first();

    expect(membership).not.toBeNull();

    const response = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/members/${membership!.id}/role`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        role: "ADMIN",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.member.role).toBe("ADMIN");
  });

  it("allows an ADMIN to delete a relationship", async () => {
    const response = await request(app)
      .delete(`/api/v1/decision-relations/${relatedRelationId}`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Decision relationship deleted successfully",
    );

    expect(response.body.data.relation).toMatchObject({
      id: relatedRelationId,
      sourceDecisionId: typescriptDecisionId,
      targetDecisionId: databaseDecisionId,
      type: "RELATED_TO",
    });
  });

  it("returns 404 when deleting the same relationship again", async () => {
    const response = await request(app)
      .delete(`/api/v1/decision-relations/${relatedRelationId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Decision relationship not found");
  });

  it("reflects relationship deletion in the project graph", async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/graph`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);

    // Three DEPENDS_ON edges remain:
    // Prisma -> PostgreSQL
    // Repository -> Prisma
    // PostgreSQL -> Repository
    expect(response.body.data.nodeCount).toBe(4);
    expect(response.body.data.edgeCount).toBe(3);

    expect(
      response.body.data.edges.some(
        (edge: { id: string }) => edge.id === String(relatedRelationId),
      ),
    ).toBe(false);
  });
});
