import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  deleteProjectById,
  getProjectByIdForUser,
  getProjectDocsByProjectId,
  getProjectRole,
  markProjectDocDeleting,
  updateProjectMetadata,
  updateProjectName,
} from "@/lib/db/queries";
import {
  BUILT_IN_NOTE_LABELS,
  type NoteLabelDefinition,
} from "@/lib/db/schema";
import {
  inferSourceTypeFromNamespace,
  namespacesForSourceTypes,
} from "@/lib/rag/source-routing";
import { deleteByFilterFromTurbopuffer } from "@/lib/rag/turbopuffer";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const { projectId } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const project = await getProjectByIdForUser({
      projectId,
      userId: session.user.id,
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get noteLabels from metadata, or return built-in defaults
    const metadata = project.metadata as Record<string, unknown> | null;
    const noteLabels: NoteLabelDefinition[] =
      (metadata?.noteLabels as NoteLabelDefinition[]) ?? BUILT_IN_NOTE_LABELS;

    return NextResponse.json({
      project: {
        ...project,
        noteLabels,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get project",
      },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const { projectId } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const role = await getProjectRole({ projectId, userId: session.user.id });
    if (!role) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { noteLabels, name } = body as {
      noteLabels?: NoteLabelDefinition[];
      name?: string;
    };

    // Handle name update
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (trimmedName.length === 0 || trimmedName.length > 200) {
        return NextResponse.json(
          { error: "Name must be between 1 and 200 characters" },
          { status: 400 }
        );
      }

      const updatedProject = await updateProjectName({
        projectId,
        name: trimmedName,
      });

      return NextResponse.json({ project: updatedProject });
    }

    if (noteLabels !== undefined) {
      // Validate noteLabels structure
      if (!Array.isArray(noteLabels)) {
        return NextResponse.json(
          { error: "noteLabels must be an array" },
          { status: 400 }
        );
      }

      // Ensure built-in labels are always present
      const builtInNames = new Set(BUILT_IN_NOTE_LABELS.map((l) => l.name));
      const customLabels = noteLabels.filter((l) => !builtInNames.has(l.name));
      const mergedLabels = [...BUILT_IN_NOTE_LABELS, ...customLabels];

      await updateProjectMetadata({
        projectId,
        metadata: { noteLabels: mergedLabels },
      });

      return NextResponse.json({ noteLabels: mergedLabels });
    }

    const { defaultEmailAgentId } = body as { defaultEmailAgentId?: string | null };
    if (defaultEmailAgentId !== undefined) {
      const project = await getProjectByIdForUser({ projectId, userId: session.user.id });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      const existingMetadata = (project.metadata as Record<string, unknown>) ?? {};
      await updateProjectMetadata({
        projectId,
        metadata: { ...existingMetadata, defaultEmailAgentId },
      });
      return NextResponse.json({ defaultEmailAgentId });
    }

    return NextResponse.json({ error: "No update provided" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update project",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const { projectId } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const role = await getProjectRole({ projectId, userId: session.user.id });
    if (!role) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await getProjectByIdForUser({
      projectId,
      userId: session.user.id,
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete default project" },
        { status: 400 }
      );
    }

    // 1. Fetch all docs and mark them as deleting in DB
    const docs = await getProjectDocsByProjectId({ projectId: project.id });
    await Promise.all(
      docs.map((doc) => markProjectDocDeleting({ docId: doc.id }))
    );

    // 2. Delete Turbopuffer namespaces
    const namespaces = namespacesForSourceTypes(
      ["docs"],
      project.id,
      project.isDefault
    );

    await Promise.all(
      namespaces.map(async (namespace) => {
        if (!namespace) return;
        try {
          const inferredSourceType = inferSourceTypeFromNamespace(namespace);
          if (!inferredSourceType) return;
          await deleteByFilterFromTurbopuffer({
            namespace,
            // Avoid `null` comparisons (Turbopuffer FiltersInput rejects them).
            // In per-project namespaces, this matches all rows for that source type.
            filters: ["sourceType", "Eq", inferredSourceType],
          });
        } catch (error) {
          console.warn(
            `Failed to delete namespace ${namespace} for project ${projectId}`,
            error
          );
        }
      })
    );

    // 3. Delete files from Vercel Blob
    const blobUrls = docs
      .map((d) => d.blobUrl)
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    if (blobUrls.length > 0) {
      try {
        await Promise.all(blobUrls.map((url) => del(url)));
      } catch (error) {
        console.warn(`Failed to delete blobs for project ${projectId}`, error);
      }
    }

    // 4. Finally, delete project and its data from DB
    await deleteProjectById({ projectId, userId: session.user.id });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete project",
      },
      { status: 400 }
    );
  }
}
