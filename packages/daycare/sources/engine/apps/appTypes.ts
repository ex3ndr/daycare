export type AppRule = {
  text: string;
  addedBy?: string;
};

export type AppRuleSet = {
  allow: AppRule[];
  deny: AppRule[];
};

export type AppManifest = {
  name: string;
  title: string;
  description: string;
  model?: string;
  systemPrompt: string;
};

export type AppPermissions = {
  sourceIntent: string;
  rules: AppRuleSet;
};

export type AppDescriptor = {
  id: string;
  path: string;
  manifest: AppManifest;
  permissions: AppPermissions;
};

export type AppReviewDecision = {
  allowed: boolean;
  reason?: string;
};
