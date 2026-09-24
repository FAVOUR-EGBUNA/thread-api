import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { db } from "../src/prisma/db.js";

const ownerUser = {
  name: "Workspace Test Owner",
  email: "workspace-owner-test@thread.dev",
  password: "Test1234!",
};

const memberUser = {
  name: "Workspace Test Member",
  email: "workspace-member-test@thread.dev",
  password: "Test1234!",
};

const outsiderUser = {
  name: "Workspace Test Outsider",
  email: "workspace-outsider-test@thread.dev",
  password: "Test1234!",
};

let ownerToken = "";
let memberToken = "";
let outsiderToken = "";

let ownerUserId = 0;
let memberUserId = 0;
let outsiderUserId = 0;

let workspaceId = 0;
let ownerMembershipId = 0;
let memberMembershipId = 0;

const testEmails = [ownerUser.email, memberUser.email, outsiderUser.email];

const deleteUserIfSafe = async (email: string) => {
  const user = await db.orm.public.User.where({
    email,
  }).first();

  if (!user) {
    return;
  }

  const memberships = await db.orm.public.WorkspaceMember.where({
    userId: user.id,
  }).all();

  const activities = await db.orm.public.ActivityLog.where({
    userId: user.id,
  }).all();

  if (memberships.length > 0 || activities.length > 0) {
    return;
  }

  await db.orm.public.User.where({
    id: user.id,
  }).delete();
};

const cleanupTestData = async () => {
  const testUsers = [];

  for (const email of testEmails) {
    const user = await db.orm.public.User.where({
      email,
    }).first();

    if (user) {
      testUsers.push(user);
    }
  }

  const testUserIds = testUsers.map((user) => user.id);

  if (testUserIds.length > 0) {
    const ownedMemberships = await db.orm.public.WorkspaceMember.where(
      (membership) => membership.userId.in(testUserIds),
    ).all();

    const possibleWorkspaceIds = [
      ...new Set(ownedMemberships.map((membership) => membership.workspaceId)),
    ];

    for (const possibleWorkspaceId of possibleWorkspaceIds) {
      const workspace = await db.orm.public.Workspace.where({
        id: possibleWorkspaceId,
      }).first();

      if (
        !workspace ||
        !workspace.name.startsWith("Automated Workspace Test")
      ) {
        continue;
      }

      const activities = await db.orm.public.ActivityLog.where({
        workspaceId: possibleWorkspaceId,
      }).all();

      for (const activity of activities) {
        await db.orm.public.ActivityLog.where({
          id: activity.id,
        }).delete();
      }

      const memberships = await db.orm.public.WorkspaceMember.where({
        workspaceId: possibleWorkspaceId,
      }).all();

      for (const membership of memberships) {
        await db.orm.public.WorkspaceMember.where({
          id: membership.id,
        }).delete();
      }

      const projects = await db.orm.public.Project.where({
        workspaceId: possibleWorkspaceId,
      }).all();

      if (projects.length === 0) {
        await db.orm.public.Workspace.where({
          id: possibleWorkspaceId,
        }).delete();
      }
    }
  }

  for (const email of testEmails) {
    await deleteUserIfSafe(email);
  }
};

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

describe("Workspace API", () => {
  beforeAll(async () => {
    await cleanupTestData();

    const owner = await registerAndLogin(ownerUser);
    ownerUserId = owner.userId;
    ownerToken = owner.token;

    const member = await registerAndLogin(memberUser);
    memberUserId = member.userId;
    memberToken = member.token;

    const outsider = await registerAndLogin(outsiderUser);
    outsiderUserId = outsider.userId;
    outsiderToken = outsider.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("rejects workspace access without authentication", async () => {
    const response = await request(app).get("/api/v1/workspaces");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("creates a workspace and makes the creator OWNER", async () => {
    const response = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Automated Workspace Test",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.workspace).toMatchObject({
      name: "Automated Workspace Test",
    });

    workspaceId = response.body.data.workspace.id;

    expect(workspaceId).toEqual(expect.any(Number));

    const membership = await db.orm.public.WorkspaceMember.where({
      userId: ownerUserId,
      workspaceId,
    }).first();

    expect(membership).not.toBeNull();
    expect(membership?.role).toBe("OWNER");

    ownerMembershipId = membership!.id;
  });

  it("lists the owner's workspace", async () => {
    const response = await request(app)
      .get("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);

    const workspace = response.body.data.workspaces.find(
      (item: { id: number }) => item.id === workspaceId,
    );

    expect(workspace).toMatchObject({
      id: workspaceId,
      name: "Automated Workspace Test",
      role: "OWNER",
      memberCount: 1,
      projectCount: 0,
    });
  });

  it("allows the owner to retrieve the workspace", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.workspace).toMatchObject({
      id: workspaceId,
      name: "Automated Workspace Test",
      currentUserRole: "OWNER",
      memberCount: 1,
      projectCount: 0,
    });
  });

  it("prevents an outsider from accessing the workspace", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "You do not have access to this workspace",
    );
  });

  it("allows the owner to rename the workspace", async () => {
    const response = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Automated Workspace Test Updated",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.workspace.name).toBe(
      "Automated Workspace Test Updated",
    );
  });

  it("allows the owner to add a member", async () => {
    const response = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        email: memberUser.email,
        role: "MEMBER",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.member).toMatchObject({
      role: "MEMBER",
      user: {
        id: memberUserId,
        name: memberUser.name,
        email: memberUser.email,
      },
    });

    memberMembershipId = response.body.data.member.id;

    expect(memberMembershipId).toEqual(expect.any(Number));
  });

  it("rejects adding the same member twice", async () => {
    const response = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        email: memberUser.email,
        role: "MEMBER",
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "This user is already a member of the workspace",
    );
  });

  it("allows a MEMBER to read the workspace members", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.currentUserRole).toBe("MEMBER");
    expect(response.body.data.memberCount).toBe(2);
  });

  it("prevents a MEMBER from adding workspace members", async () => {
    const response = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        email: outsiderUser.email,
        role: "MEMBER",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have permission to add workspace members",
    );
  });

  it("allows the owner to promote a MEMBER to ADMIN", async () => {
    const response = await request(app)
      .patch(
        `/api/v1/workspaces/${workspaceId}/members/${memberMembershipId}/role`,
      )
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        role: "ADMIN",
      });

    expect(response.status).toBe(200);

    expect(response.body.data.member).toMatchObject({
      id: memberMembershipId,
      previousRole: "MEMBER",
      role: "ADMIN",
    });
  });

  it("allows an ADMIN to add a MEMBER", async () => {
    const response = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        email: outsiderUser.email,
        role: "MEMBER",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.member.role).toBe("MEMBER");
  });

  it("prevents changing the OWNER role", async () => {
    const response = await request(app)
      .patch(
        `/api/v1/workspaces/${workspaceId}/members/${ownerMembershipId}/role`,
      )
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        role: "ADMIN",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "The workspace owner's role cannot be changed through this endpoint",
    );
  });

  it("allows the owner to remove the ADMIN", async () => {
    const response = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/members/${memberMembershipId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.member).toMatchObject({
      id: memberMembershipId,
      previousRole: "ADMIN",
    });
  });

  it("prevents the owner from removing themselves", async () => {
    const response = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/members/${ownerMembershipId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You cannot remove yourself through this endpoint",
    );
  });

  it("keeps the outsider user account intact", async () => {
    const user = await db.orm.public.User.where({
      id: outsiderUserId,
    }).first();

    expect(user).not.toBeNull();
    expect(user?.email).toBe(outsiderUser.email);
  });
});
