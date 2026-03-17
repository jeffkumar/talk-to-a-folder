import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { projectInvitation, projectUser, user } from "../lib/db/schema";

config({
  path: ".env.local",
});

const runFix = async () => {
  const useLocalDb = process.env.USE_LOCAL_DB === "true";
  const localPostgresUrl =
    process.env.LOCAL_POSTGRES_URL ?? "postgresql://localhost:5432/flowchat";
  const postgresUrl = useLocalDb ? localPostgresUrl : process.env.POSTGRES_URL;

  if (!postgresUrl) {
    throw new Error("POSTGRES_URL is not defined");
  }

  const connection = postgres(postgresUrl, { max: 1 });
  const db = drizzle(connection);

  console.log(
    "🔍 Finding orphaned invitations (invitations for users who already exist)...\n"
  );

  const orphanedInvitations = await db
    .select({
      invitationId: projectInvitation.id,
      projectId: projectInvitation.projectId,
      email: projectInvitation.email,
      role: projectInvitation.role,
      userId: user.id,
      userName: user.name,
    })
    .from(projectInvitation)
    .innerJoin(
      user,
      eq(
        sql`LOWER(TRIM(${projectInvitation.email}))`,
        sql`LOWER(TRIM(${user.email}))`
      )
    );

  if (orphanedInvitations.length === 0) {
    console.log(
      "✅ No orphaned invitations found. All invitations are for users who don't exist yet."
    );
    await connection.end();
    process.exit(0);
  }

  console.log(`Found ${orphanedInvitations.length} orphaned invitation(s):\n`);
  for (const inv of orphanedInvitations) {
    console.log(
      `  - ${inv.email} (${inv.userName ?? "no name"}) → project ${inv.projectId} as ${inv.role}`
    );
  }
  console.log();

  console.log("⏳ Converting invitations to project memberships...\n");

  const now = new Date();
  let converted = 0;
  let skipped = 0;

  for (const inv of orphanedInvitations) {
    try {
      await db
        .insert(projectUser)
        .values({
          projectId: inv.projectId,
          userId: inv.userId,
          role: inv.role,
          createdAt: now,
        })
        .onConflictDoNothing({
          target: [projectUser.projectId, projectUser.userId],
        });

      await db
        .delete(projectInvitation)
        .where(eq(projectInvitation.id, inv.invitationId));

      converted++;
      console.log(`  ✅ ${inv.email} added to project ${inv.projectId}`);
    } catch (error) {
      skipped++;
      console.log(
        `  ⚠️  Skipped ${inv.email} for project ${inv.projectId}: ${error}`
      );
    }
  }

  console.log(
    `\n✅ Done! Converted ${converted} invitation(s), skipped ${skipped}.`
  );
  await connection.end();
  process.exit(0);
};

runFix().catch((err) => {
  console.error("❌ Fix failed");
  console.error(err);
  process.exit(1);
});
