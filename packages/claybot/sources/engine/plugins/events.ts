export type PluginEventInput = {
  type: string;
  payload?: unknown;
};

export type PluginEvent = PluginEventInput & {
  id: string;
  pluginId: string;
  instanceId: string;
  createdAt: string;
};

export type PluginEventSource = {
  pluginId: string;
  instanceId: string;
};
