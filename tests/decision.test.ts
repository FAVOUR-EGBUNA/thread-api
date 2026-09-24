import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { db } from "../src/prisma/db.js";

const ownerUser = {
  name: "Decision Test Owner",
  email: "decision-owner-test@thread.dev",
  password: "Test1234!",
};

const memberUser = {
  name: "Decision Test Member",
  email: "decision-member-test@thread.dev",
  password: "Test1234!",
};

const outsiderUser = {
  name: "Decision Test Outsider",
  email: "decision-outsider-test@thread.dev",
  password: "Test1234!",
};

const testEmails = [ownerUser.email, memberUser.email, outsiderUser.email];

let ownerToken = "";
let memberToken = "";
let outsiderToken = "";

let memberUserId = 0;

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

      if (!workspace || !workspace.name.startsWith("Automated Decision Test")) {
        continue;
      }

      const projects = await db.orm.public.Project.where({
        workspaceId: currentWorkspaceId,
      }).all();

      for (const project of projects) {
        const decisions = await db.orm.public.Decision.where({
          projectId: project.id,
        }).all();

        for (const decision of decisions) {
          const outgoingRelations = await db.orm.public.DecisionRelation.where({
            sourceDecisionId: decision.id,
          }).all();

          for (const relation of outgoingRelations) {
            await db.orm.public.DecisionRelation.where({
              id: relation.id,
            }).delete();
          }

          const incomingRelations = await db.orm.public.DecisionRelation.where({
            targetDecisionId: decision.id,
          }).all();

          for (const relation of incomingRelations) {
            await db.orm.public.DecisionRelation.where({
              id: relation.id,
            }).delete();
          }

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

describe("Decision API", () => {
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
        name: "Automated Decision Test Workspace",
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
        name: "Automated Decision Test Project",
        description: "Project used by the decision integration suite.",
      });

    expect(projectResponse.status).toBe(201);

    projectId = projectResponse.body.data.project.id;
  }, 30_000);

  afterAll(async () => {
    await cleanupTestData();
  }, 30_000);

  it("rejects decision creation without authentication", async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/decisions`)
      .send({
        title: "Choose PostgreSQL",
        context: "The platform requires reliable relational storage.",
        decision: "Use PostgreSQL as the primary database.",
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("rejects invalid decision data", async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/decisions`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "DB",
        context: "short",
        decision: "yes",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });

  it("prevents a MEMBER from creating a decision", async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/decisions`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        title: "Member Decision",
        context: "This context is long enough for validation.",
        decision: "This decision should not be created.",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have permission to create decisions in this workspace",
    );
  });

  it("prevents an outsider from creating a decision", async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/decisions`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({
        title: "Outsider Decision",
        context: "This context is long enough for validation.",
        decision: "This decision should not be created.",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have access to this project",
    );
  });

  it("allows the OWNER to create a decision", async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/decisions`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Choose PostgreSQL",
        context:
          "THREAD requires reliable relational storage for connected decision data.",
        decision: "Use PostgreSQL as the primary relational database.",
        reasoning:
          "It provides strong relational modelling and transaction support.",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Decision created successfully");

    expect(response.body.data.decision).toMatchObject({
      title: "Choose PostgreSQL",
      status: "PROPOSED",
      projectId,
    });

    decisionId = response.body.data.decision.id;

    expect(decisionId).toEqual(expect.any(Number));
  });

  it("allows a MEMBER to retrieve a decision", async () => {
    const response = await request(app)
      .get(`/api/v1/decisions/${decisionId}`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.decision).toMatchObject({
      id: decisionId,
      title: "Choose PostgreSQL",
      status: "PROPOSED",
      projectId,
    });

    expect(response.body.data.relationships.outgoing).toEqual([]);

    expect(response.body.data.relationships.incoming).toEqual([]);
  });

  it("prevents an outsider from retrieving a decision", async () => {
    const response = await request(app)
      .get(`/api/v1/decisions/${decisionId}`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have access to this decision",
    );
  });

  it("prevents a MEMBER from updating a decision", async () => {
    const response = await request(app)
      .patch(`/api/v1/decisions/${decisionId}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        title: "Member Should Not Update",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have permission to update decisions in this workspace",
    );
  });

  it("allows the OWNER to update a decision", async () => {
    const response = await request(app)
      .patch(`/api/v1/decisions/${decisionId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Choose PostgreSQL for THREAD",
        reasoning:
          "PostgreSQL supports the relational structure and transactional guarantees THREAD needs.",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.decision).toMatchObject({
      id: decisionId,
      title: "Choose PostgreSQL for THREAD",
      status: "PROPOSED",
      projectId,
    });
  });

  it("rejects an empty decision update", async () => {
    const response = await request(app)
      .patch(`/api/v1/decisions/${decisionId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation failed");
  });

  it("prevents a MEMBER from changing decision status", async () => {
    const response = await request(app)
      .patch(`/api/v1/decisions/${decisionId}/status`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        status: "ACCEPTED",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have permission to change decision status in this workspace",
    );
  });

  it("allows the OWNER to change PROPOSED to ACCEPTED", async () => {
    const response = await request(app)
      .patch(`/api/v1/decisions/${decisionId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        status: "ACCEPTED",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Decision status updated successfully");

    expect(response.body.data.previousStatus).toBe("PROPOSED");

    expect(response.body.data.currentStatus).toBe("ACCEPTED");

    expect(response.body.data.decision.status).toBe("ACCEPTED");

    expect(response.body.data.history).toMatchObject({
      decisionId,
      previousStatus: "PROPOSED",
      newStatus: "ACCEPTED",
    });

    expect(response.body.data.activity).toMatchObject({
      action: "DECISION_STATUS_CHANGED",
      entityType: "DECISION",
      entityId: decisionId,
      workspaceId,
    });
  });

  it("rejects setting the same decision status again", async () => {
    const response = await request(app)
      .patch(`/api/v1/decisions/${decisionId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        status: "ACCEPTED",
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: "Decision already has this status",
    });
  });

  it("rejects an invalid decision status", async () => {
    const response = await request(app)
      .patch(`/api/v1/decisions/${decisionId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        status: "APPROVED",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });

  it("returns decision status history to a MEMBER", async () => {
    const response = await request(app)
      .get(`/api/v1/decisions/${decisionId}/history`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.decision).toMatchObject({
      id: decisionId,
      title: "Choose PostgreSQL for THREAD",
      status: "ACCEPTED",
    });

    expect(response.body.data.historyCount).toBe(1);

    expect(response.body.data.history).toHaveLength(1);

    expect(response.body.data.history[0]).toMatchObject({
      decisionId,
      previousStatus: "PROPOSED",
      newStatus: "ACCEPTED",
    });
  });

  it("prevents an outsider from reading decision history", async () => {
    const response = await request(app)
      .get(`/api/v1/decisions/${decisionId}/history`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have access to this decision",
    );
  });

  it("shows the decision in the project decision list", async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/decisions`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.decisionCount).toBe(1);

    expect(response.body.data.decisions).toHaveLength(1);

    expect(response.body.data.decisions[0]).toMatchObject({
      id: decisionId,
      title: "Choose PostgreSQL for THREAD",
      status: "ACCEPTED",
      projectId,
    });
  });

  it("updates the project decision count", async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.project.decisionCount).toBe(1);
  });

  it("prevents deleting a project that contains a decision", async () => {
    const response = await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: "This project contains decisions and cannot be deleted",
    });
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

  it("allows an ADMIN to create a decision", async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/decisions`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        title: "Use TypeScript",
        context:
          "THREAD requires predictable types across the backend codebase.",
        decision: "Use TypeScript throughout the backend.",
        reasoning:
          "Static typing improves maintainability and catches mistakes earlier.",
        status: "ACCEPTED",
      });

    expect(response.status).toBe(201);

    expect(response.body.data.decision).toMatchObject({
      title: "Use TypeScript",
      status: "ACCEPTED",
      projectId,
    });
  });
});
