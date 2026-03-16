interface GooglePickerDocument {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  sizeBytes?: number;
}

interface GooglePickerCallbackData {
  action: string;
  docs?: GooglePickerDocument[];
}

interface Gapi {
  load(
    api: string,
    options: { callback: () => void; onerror?: () => void }
  ): void;
}

interface Window {
  gapi?: Gapi;
}

declare namespace google.picker {
  const Action: {
    PICKED: string;
    CANCEL: string;
  };
  const ViewId: {
    DOCS: string;
  };
  const Feature: {
    MULTISELECT_ENABLED: string;
  };
  class DocsView {
    constructor(viewId?: string);
    setIncludeFolders(include: boolean): DocsView;
    setSelectFolderEnabled(enabled: boolean): DocsView;
    setMimeTypes(mimeTypes: string): DocsView;
  }
  class PickerBuilder {
    addView(viewOrId: DocsView | string): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    setCallback(
      callback: (data: GooglePickerCallbackData) => void
    ): PickerBuilder;
    enableFeature(feature: string): PickerBuilder;
    setTitle(title: string): PickerBuilder;
    build(): { setVisible(visible: boolean): void; dispose(): void };
  }
}
