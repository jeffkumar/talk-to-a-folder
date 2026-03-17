/**
 * Delete specific users by email and all their related data.
 * Usage: npx tsx scripts/delete-users-by-email.ts email1@example.com email2@example.com
 *
 * Loads .env.local; set USE_LOCAL_DB=true to run against local Postgres.
 */
import { config } from "dotenv";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  chat,
  document,
  feedbackRequest,
  integrationConnection,
  message,
  passwordResetToken,
  project,
  projectDoc,
  projectInvitation,
  projectUser,
  stream,
  suggestion,
  task,
  usageLog,
  user,
  vote,
  waitlistRequest,
} from "../lib/db/schema";

config({ path: ".env.local" });

const useLocalDb = process.env.USE_LOCAL_DB === "true";
const localPostgresUrl =
  process.env.LOCAL_POSTGRES_URL ?? "postgresql://localhost:5432/flowchat";
const postgresUrl = useLocalDb ? localPostgresUrl : process.env.POSTGRES_URL;

if (!postgresUrl) {
  throw new Error("POSTGRES_URL or LOCAL_POSTGRES_URL is not set");
}

const client = postgres(postgresUrl, { max: 1 });
const db = drizzle(client);

const emailsToDelete = process.argv.slice(2).map((e) => e.trim().toLowerCase());
if (emailsToDelete.length === 0) {
  console.error(
    "Usage: npx tsx scripts/delete-users-by-email.ts <email1> [email2 ...]"
  );
  process.exit(1);
}

async function deleteUsersByEmail() {
  console.log("Finding users:", emailsToDelete);

  const usersToDelete = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(
      sql`LOWER(${user.email}) IN (${sql.join(
        emailsToDelete.map((e) => sql`${e}`),
        sql`, `
      )})`
    );

  if (usersToDelete.length === 0) {
    console.log("No matching users found.");
    await client.end();
    return;
  }

  const userIds = usersToDelete.map((u) => u.id);
  const emailsExact = usersToDelete.map((u) => u.email);

  console.log(
    `Found ${usersToDelete.length} user(s) to delete:`,
    usersToDelete.map((u) => u.email)
  );

  const chats = await db
    .select({ id: chat.id })
    .from(chat)
    .where(inArray(chat.userId, userIds));
  const chatIds = chats.map((c) => c.id);

  const projectsOwned = await db
    .select({ id: project.id })
    .from(project)
    .where(inArray(project.createdBy, userIds));
  const projectIds = projectsOwned.map((p) => p.id);

  const documents = await db
    .select({ id: document.id, createdAt: document.createdAt })
    .from(document)
    .where(inArray(document.userId, userIds));

  console.log(
    `  Chats: ${chatIds.length}, Projects: ${projectIds.length}, Documents: ${documents.length}`
  );

  if (chatIds.length > 0) {
    await db.delete(usageLog).where(inArray(usageLog.chatId, chatIds));
    console.log("  Deleted usage log rows");
    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));
  }
  await db.delete(usageLog).where(inArray(usageLog.userId, userIds));
  if (chatIds.length > 0) {
    await db.delete(chat).where(inArray(chat.id, chatIds));
  }

  for (const doc of documents) {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, doc.id),
          eq(suggestion.documentCreatedAt, doc.createdAt)
        )
      );
  }
  await db.delete(document).where(inArray(document.userId, userIds));

  if (projectIds.length > 0) {
    await db.delete(task).where(inArray(task.projectId, projectIds));
    await db
      .delete(projectDoc)
      .where(inArray(projectDoc.projectId, projectIds));
  }
  await db.delete(task).where(inArray(task.assigneeId, userIds));
  await db.delete(projectUser).where(inArray(projectUser.userId, userIds));
  for (const e of emailsExact) {
    await db.delete(projectInvitation).where(eq(projectInvitation.email, e));
  }
  if (projectIds.length > 0) {
    await db.delete(project).where(inArray(project.id, projectIds));
  }

  await db
    .delete(feedbackRequest)
    .where(inArray(feedbackRequest.userId, userIds));
  await db
    .delete(integrationConnection)
    .where(inArray(integrationConnection.userId, userIds));
  await db
    .delete(passwordResetToken)
    .where(inArray(passwordResetToken.userId, userIds));
  for (const e of emailsExact) {
    await db.delete(waitlistRequest).where(eq(waitlistRequest.email, e));
  }

  const deleted = await db
    .delete(user)
    .where(inArray(user.id, userIds))
    .returning({ email: user.email });

  console.log(
    `\nDeleted ${deleted.length} user(s):`,
    deleted.map((r) => r.email).join(", ")
  );
  await client.end();
  console.log("Done.");
}

deleteUsersByEmail().catch((err) => {
  console.error(err);
  process.exit(1);
});
