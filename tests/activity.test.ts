import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { db } from "../src/prisma/db.js";

const ownerUser = {
  name: "Activity Test Owner",
  email: "activity-owner-test@thread.dev",
  password: "Test1234!",
};

const memberUser = {
  name: "Activity Test Member",
  email: "activity-member-test@thread.dev",
  password: "Test1234!",
};

const outsiderUser = {
  name: "Activity Test Outsider",
  email: "activity-outsider-test@thread.dev",
  password: "Test1234!",
};

const testEmails = [ownerUser.email, memberUser.email, outsiderUser.email];

let ownerToken = "";
let memberToken = "";
let outsiderToken = "";

let workspaceId = 0;
let projectId = 0;
let decisionId = 0;

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

      if (!workspace || !workspace.name.startsWith("Automated Activity Test")) {
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

        const incomingRelations = await db.orm.public.DecisionRelation.where(
          (relation) => relation.targetDecisionId.in(decisionIds),
        ).all();

        for (const relation of incomingRelations) {
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

describe("Workspace Activity API", () => {
  beforeAll(async () => {
    await cleanupTestData();

    const owner = await registerAndLogin(ownerUser);

    ownerToken = owner.token;

    const member = await registerAndLogin(memberUser);

    memberToken = member.token;

    const outsider = await registerAndLogin(outsiderUser);

    outsiderToken = outsider.token;

    const workspaceResponse = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Automated Activity Test Workspace",
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
        name: "Automated Activity Test Project",
        description: "Project used to generate activity records.",
      });

    expect(projectResponse.status).toBe(201);

    projectId = projectResponse.body.data.project.id;

    const decisionResponse = await request(app)
      .post(`/api/v1/projects/${projectId}/decisions`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Activity Test Decision",
        context: "This decision exists to generate workspace activity.",
        decision: "Use this decision for activity integration testing.",
        reasoning: "It provides predictable activity records.",
      });

    expect(decisionResponse.status).toBe(201);

    decisionId = decisionResponse.body.data.decision.id;

    const updateDecisionResponse = await request(app)
      .patch(`/api/v1/decisions/${decisionId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Activity Test Decision Updated",
      });

    expect(updateDecisionResponse.status).toBe(200);

    const statusResponse = await request(app)
      .patch(`/api/v1/decisions/${decisionId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        status: "ACCEPTED",
      });

    expect(statusResponse.status).toBe(200);
  }, 30_000);

  afterAll(async () => {
    await cleanupTestData();
  }, 30_000);

  it("rejects activity access without authentication", async () => {
    const response = await request(app).get(
      `/api/v1/workspaces/${workspaceId}/activity`,
    );

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("rejects an invalid workspace ID", async () => {
    const response = await request(app)
      .get("/api/v1/workspaces/not-a-number/activity")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid workspace ID");
  });

  it("prevents an outsider from viewing workspace activity", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have access to this workspace",
    );
  });

  it("allows a MEMBER to view workspace activity", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Workspace activity retrieved successfully",
    );

    expect(response.body.data.workspaceId).toBe(workspaceId);

    expect(response.body.data.activities.length).toBeGreaterThan(0);
  });

  it("uses the default pagination values", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.pagination.page).toBe(1);

    expect(response.body.data.pagination.limit).toBe(20);

    expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(5);

    expect(response.body.data.pagination.totalPages).toBeGreaterThanOrEqual(1);

    expect(response.body.data.pagination.hasPreviousPage).toBe(false);
  });

  it("returns activity records with actor information", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);

    const activities = response.body.data.activities;

    const decisionCreated = activities.find(
      (activity: { action: string; entityId: number | null }) =>
        activity.action === "DECISION_CREATED" &&
        activity.entityId === decisionId,
    );

    expect(decisionCreated).toBeDefined();

    expect(decisionCreated.actor).toMatchObject({
      name: ownerUser.name,
      email: ownerUser.email,
    });

    expect(decisionCreated.entityType).toBe("DECISION");

    expect(decisionCreated.metadata).toMatchObject({
      projectId,
    });
  });

  it("contains the decision update activity", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);

    const activity = response.body.data.activities.find(
      (item: { action: string; entityId: number | null }) =>
        item.action === "DECISION_UPDATED" && item.entityId === decisionId,
    );

    expect(activity).toBeDefined();

    expect(activity.metadata).toMatchObject({
      projectId,
      updatedFields: ["title"],
    });
  });

  it("contains the decision status change activity", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);

    const activity = response.body.data.activities.find(
      (item: { action: string; entityId: number | null }) =>
        item.action === "DECISION_STATUS_CHANGED" &&
        item.entityId === decisionId,
    );

    expect(activity).toBeDefined();

    expect(activity.metadata).toMatchObject({
      previousStatus: "PROPOSED",
      newStatus: "ACCEPTED",
      projectId,
    });
  });

  it("returns activities newest first", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);

    const activities = response.body.data.activities;

    for (let index = 1; index < activities.length; index += 1) {
      const previousTime = new Date(activities[index - 1].createdAt).getTime();

      const currentTime = new Date(activities[index].createdAt).getTime();

      expect(previousTime).toBeGreaterThanOrEqual(currentTime);
    }
  });

  it("paginates workspace activity", async () => {
    const firstPage = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity?page=1&limit=2`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(firstPage.status).toBe(200);

    expect(firstPage.body.data.pagination.page).toBe(1);

    expect(firstPage.body.data.pagination.limit).toBe(2);

    expect(firstPage.body.data.activities).toHaveLength(2);

    expect(firstPage.body.data.pagination.hasNextPage).toBe(true);

    expect(firstPage.body.data.pagination.hasPreviousPage).toBe(false);

    const secondPage = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity?page=2&limit=2`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(secondPage.status).toBe(200);

    expect(secondPage.body.data.pagination.page).toBe(2);

    expect(secondPage.body.data.pagination.hasPreviousPage).toBe(true);

    const firstPageIds = firstPage.body.data.activities.map(
      (activity: { id: number }) => activity.id,
    );

    const secondPageIds = secondPage.body.data.activities.map(
      (activity: { id: number }) => activity.id,
    );

    for (const id of secondPageIds) {
      expect(firstPageIds).not.toContain(id);
    }
  });

  it("rejects page zero", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity?page=0`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Page must be a positive integer");
  });

  it("rejects a non-integer page", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity?page=1.5`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Page must be a positive integer");
  });

  it("rejects limit zero", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity?limit=0`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Limit must be a positive integer between 1 and 100",
    );
  });

  it("rejects a limit greater than 100", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity?limit=101`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Limit must be a positive integer between 1 and 100",
    );
  });

  it("returns an empty activity array beyond the final page", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/activity?page=999&limit=2`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.activities).toEqual([]);

    expect(response.body.data.pagination.page).toBe(999);

    expect(response.body.data.pagination.hasNextPage).toBe(false);

    expect(response.body.data.pagination.hasPreviousPage).toBe(true);
  });
});
