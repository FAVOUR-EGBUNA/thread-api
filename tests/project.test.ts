import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { db } from "../src/prisma/db.js";

const ownerUser = {
  name: "Project Test Owner",
  email: "project-owner-test@thread.dev",
  password: "Test1234!",
};

const memberUser = {
  name: "Project Test Member",
  email: "project-member-test@thread.dev",
  password: "Test1234!",
};

const outsiderUser = {
  name: "Project Test Outsider",
  email: "project-outsider-test@thread.dev",
  password: "Test1234!",
};

const testEmails = [ownerUser.email, memberUser.email, outsiderUser.email];

let ownerToken = "";
let memberToken = "";
let outsiderToken = "";

let ownerUserId = 0;
let memberUserId = 0;

let workspaceId = 0;
let projectId = 0;
let deletableProjectId = 0;

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

      if (!workspace || !workspace.name.startsWith("Automated Project Test")) {
        continue;
      }

      const projects = await db.orm.public.Project.where({
        workspaceId: currentWorkspaceId,
      }).all();

      for (const project of projects) {
        const decisions = await db.orm.public.Decision.where({
          projectId: project.id,
        }).all();

        if (decisions.length === 0) {
          await db.orm.public.Project.where({
            id: project.id,
          }).delete();
        }
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

      const remainingProjects = await db.orm.public.Project.where({
        workspaceId: currentWorkspaceId,
      }).all();

      if (remainingProjects.length === 0) {
        await db.orm.public.Workspace.where({
          id: currentWorkspaceId,
        }).delete();
      }
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

    if (memberships.length === 0 && activities.length === 0) {
      await db.orm.public.User.where({
        id: user.id,
      }).delete();
    }
  }
};

describe("Project API", () => {
  beforeAll(async () => {
    await cleanupTestData();

    const owner = await registerAndLogin(ownerUser);
    ownerUserId = owner.userId;
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
        name: "Automated Project Test Workspace",
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
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("rejects project creation without authentication", async () => {
    const response = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .send({
        name: "Unauthorized Project",
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("prevents a MEMBER from creating a project", async () => {
    const response = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        name: "Member Project",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have permission to create projects in this workspace",
    );
  });

  it("prevents an outsider from creating a project", async () => {
    const response = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({
        name: "Outsider Project",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have access to this workspace",
    );
  });

  it("allows the OWNER to create a project", async () => {
    const response = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Automated Project Test Main",
        description: "Project created by the automated integration suite.",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Project created successfully");

    expect(response.body.data.project).toMatchObject({
      name: "Automated Project Test Main",
      description: "Project created by the automated integration suite.",
      workspaceId,
    });

    projectId = response.body.data.project.id;

    expect(projectId).toEqual(expect.any(Number));
  });

  it("lists projects for a workspace member", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.currentUserRole).toBe("MEMBER");
    expect(response.body.data.projectCount).toBe(1);

    expect(response.body.data.projects[0]).toMatchObject({
      id: projectId,
      name: "Automated Project Test Main",
      workspaceId,
      decisionCount: 0,
    });
  });

  it("prevents an outsider from listing workspace projects", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have access to this workspace",
    );
  });

  it("allows a MEMBER to retrieve a project", async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.project).toMatchObject({
      id: projectId,
      name: "Automated Project Test Main",
      workspaceId,
      currentUserRole: "MEMBER",
      decisionCount: 0,
    });
  });

  it("prevents an outsider from retrieving a project", async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have access to this project",
    );
  });

  it("prevents a MEMBER from updating a project", async () => {
    const response = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        name: "Member Should Not Update",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have permission to update projects in this workspace",
    );
  });

  it("allows the OWNER to update a project", async () => {
    const response = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Automated Project Test Updated",
        description: "Updated project description.",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.project).toMatchObject({
      id: projectId,
      name: "Automated Project Test Updated",
      description: "Updated project description.",
      workspaceId,
    });
  });

  it("rejects an empty project update", async () => {
    const response = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });

  it("returns an empty decision list for a new project", async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/decisions`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.decisionCount).toBe(0);
    expect(response.body.data.decisions).toEqual([]);
  });

  it("returns an empty graph for a new project", async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/graph`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.nodeCount).toBe(0);
    expect(response.body.data.edgeCount).toBe(0);
    expect(response.body.data.nodes).toEqual([]);
    expect(response.body.data.edges).toEqual([]);
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

  it("allows an ADMIN to create a project", async () => {
    const response = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        name: "Automated Project Test Deletable",
        description: "Temporary project for delete testing.",
      });

    expect(response.status).toBe(201);

    deletableProjectId = response.body.data.project.id;

    expect(deletableProjectId).toEqual(expect.any(Number));
  });

  it("allows an ADMIN to update a project", async () => {
    const response = await request(app)
      .patch(`/api/v1/projects/${deletableProjectId}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        description: "Updated by an ADMIN during testing.",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.project.description).toBe(
      "Updated by an ADMIN during testing.",
    );
  });

  it("allows an ADMIN to delete an empty project", async () => {
    const response = await request(app)
      .delete(`/api/v1/projects/${deletableProjectId}`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Project deleted successfully");

    expect(response.body.data.project).toMatchObject({
      id: deletableProjectId,
      workspaceId,
    });
  });

  it("returns 404 after the project has been deleted", async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${deletableProjectId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Project not found");
  });
});
