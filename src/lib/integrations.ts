/** Integration toggles (workspace.settings.integrations). ALL integrations default ON (the Config
 *  toggles were removed — integrations are just available). Defaults are applied on READ (merge), so
 *  existing workspaces without the key show enabled with no migration. */
export const DEFAULT_INTEGRATIONS: Record<string, boolean> = {
  github: true,
  telegram: true,
  ollama: true,
  webhooks: true,
};

export type IntegrationsMap = Record<string, boolean> | undefined | null;

/** The effective on/off map for the UI (defaults merged with stored). */
export function resolveIntegrations(stored: IntegrationsMap): Record<string, boolean> {
  return { ...DEFAULT_INTEGRATIONS, ...(stored ?? {}) };
}

/** Is an integration effectively enabled (respecting defaults)? Unknown ids default ON. */
export function integrationOn(stored: IntegrationsMap, id: string): boolean {
  return resolveIntegrations(stored)[id] ?? true;
}
