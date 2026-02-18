import { Suspense } from "react";

import AgentDetailClient from "./agentDetailClient";

export default function AgentPage() {
  return (
    <Suspense fallback={null}>
      <AgentDetailClient />
    </Suspense>
  );
}
