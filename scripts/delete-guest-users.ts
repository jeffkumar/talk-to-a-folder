import { config } from "dotenv";
import { and, eq, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  chat,
  document,
  feedbackRequest,
  integrationConnection,
  message,
  project,
  projectDoc,
  stream,
  suggestion,
  user,
  vote,
} from "../lib/db/schema";

config({ path: ".env.local" });

const postgresUrl = process.env.POSTGRES_URL;
if (!postgresUrl) {
  throw new Error("POSTGRES_URL is not set");
}

const client = postgres(postgresUrl, { max: 1 });
const db = drizzle(client);

async function deleteGuestUsers() {
  console.log("Finding guest users...");

  // Find all guest users
  const guestUsers = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(like(user.email, "guest-%"));

  console.log(`Found ${guestUsers.length} guest users`);

  if (guestUsers.length === 0) {
    console.log("No guest users to delete");
    await client.end();
    return;
  }

  const guestUserIds = guestUsers.map((u) => u.id);

  // Find all chats by guest users
  const guestChats = await db
    .select({ id: chat.id })
    .from(chat)
    .where(inArray(chat.userId, guestUserIds));

  const guestChatIds = guestChats.map((c) => c.id);
  console.log(`Found ${guestChatIds.length} chats to delete`);

  // Find all projects by guest users
  const guestProjects = await db
    .select({ id: project.id })
    .from(project)
    .where(inArray(project.createdBy, guestUserIds));

  const guestProjectIds = guestProjects.map((p) => p.id);
  console.log(`Found ${guestProjectIds.length} projects to delete`);

  // Find all documents by guest users
  const guestDocuments = await db
    .select({ id: document.id, createdAt: document.createdAt })
    .from(document)
    .where(inArray(document.userId, guestUserIds));

  console.log(`Found ${guestDocuments.length} documents to delete`);

  // Delete in order of dependencies
  console.log("\nDeleting related data...");

  // 1. Delete votes for guest chats
  if (guestChatIds.length > 0) {
    const _votesDeleted = await db
      .delete(vote)
      .where(inArray(vote.chatId, guestChatIds));
    console.log("Deleted votes");
  }

  // 2. Delete messages for guest chats
  if (guestChatIds.length > 0) {
    const _messagesDeleted = await db
      .delete(message)
      .where(inArray(message.chatId, guestChatIds));
    console.log("Deleted messages");
  }

  // 3. Delete streams for guest chats
  if (guestChatIds.length > 0) {
    const _streamsDeleted = await db
      .delete(stream)
      .where(inArray(stream.chatId, guestChatIds));
    console.log("Deleted streams");
  }

  // 4. Delete chats
  if (guestChatIds.length > 0) {
    const _chatsDeleted = await db
      .delete(chat)
      .where(inArray(chat.id, guestChatIds));
    console.log("Deleted chats");
  }

  // 5. Delete suggestions for guest documents
  if (guestDocuments.length > 0) {
    for (const doc of guestDocuments) {
      await db
        .delete(suggestion)
        .where(
          and(
            eq(suggestion.documentId, doc.id),
            eq(suggestion.documentCreatedAt, doc.createdAt)
          )
        );
    }
    console.log("Deleted suggestions");
  }

  // 6. Delete documents
  if (guestDocuments.length > 0) {
    const _docsDeleted = await db
      .delete(document)
      .where(inArray(document.userId, guestUserIds));
    console.log("Deleted documents");
  }

  // 7. Delete project docs for guest projects
  if (guestProjectIds.length > 0) {
    const _projectDocsDeleted = await db
      .delete(projectDoc)
      .where(inArray(projectDoc.projectId, guestProjectIds));
    console.log("Deleted project docs");
  }

  // 8. Delete projects
  if (guestProjectIds.length > 0) {
    const _projectsDeleted = await db
      .delete(project)
      .where(inArray(project.id, guestProjectIds));
    console.log("Deleted projects");
  }

  // 9. Delete feedback requests
  const _feedbackDeleted = await db
    .delete(feedbackRequest)
    .where(inArray(feedbackRequest.userId, guestUserIds));
  console.log("Deleted feedback requests");

  // 10. Delete integration connections
  const _integrationsDeleted = await db
    .delete(integrationConnection)
    .where(inArray(integrationConnection.userId, guestUserIds));
  console.log("Deleted integration connections");

  // 11. Finally delete the guest users
  const usersDeleted = await db
    .delete(user)
    .where(inArray(user.id, guestUserIds))
    .returning();

  console.log(`\nDeleted ${usersDeleted.length} guest users`);

  await client.end();
  console.log("\nDone!");
}

deleteGuestUsers().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
