export type SourceType = "docs" | "tasks";

export function namespacesForSourceTypes(
  sourceTypes: SourceType[] | undefined,
  projectId?: string | null,
  isDefaultProject = false
): string[] {
  const requested =
    Array.isArray(sourceTypes) && sourceTypes.length > 0
      ? sourceTypes
      : (["docs"] as const);

  const docsNs =
    isDefaultProject || !projectId
      ? "_synergy_docsv2"
      : `_synergy_${projectId}_docsv2`;
  const tasksNs =
    isDefaultProject || !projectId
      ? "_synergy_tasksv1"
      : `_synergy_${projectId}_tasksv1`;

  const namespaces: string[] = [];

  for (const type of requested) {
    if (type === "docs") {
      namespaces.push(docsNs);
    }
    if (type === "tasks") {
      namespaces.push(tasksNs);
    }
  }

  if (namespaces.length === 0) {
    return [docsNs];
  }

  return namespaces;
}

export function inferSourceTypeFromNamespace(
  namespace: string
): SourceType | null {
  if (namespace.endsWith("_docs") || namespace.endsWith("_docsv2")) {
    return "docs";
  }
  if (namespace.endsWith("_tasksv1")) {
    return "tasks";
  }
  return null;
}
