export type RlmWorkerResumeOptions = { returnValue: unknown } | { exception: { type: string; message: string } };

export type RlmWorkerLimits = {
    maxDurationSecs: number;
    maxMemory: number;
    maxRecursionDepth: number;
    maxAllocations: number;
};

export type RlmWorkerRequest =
    | {
          id: string;
          type: "start";
          payload: {
              code: string;
              preamble: string;
              externalFunctions: string[];
              limits: RlmWorkerLimits;
          };
      }
    | {
          id: string;
          type: "resume";
          payload: {
              snapshot: string;
              options: RlmWorkerResumeOptions;
          };
      };

export type RlmWorkerSerializedError = {
    kind: "syntax" | "runtime" | "typing" | "internal";
    message: string;
    details?: string;
};

export type RlmWorkerResponse =
    | {
          id: string;
          ok: true;
          progress:
              | {
                    type: "snapshot";
                    snapshot: string;
                    functionName: string;
                    args: unknown[];
                    kwargs: Record<string, unknown>;
                    printOutput: string[];
                }
              | {
                    type: "complete";
                    output: unknown;
                    printOutput: string[];
                };
      }
    | {
          id: string;
          ok: false;
          error: RlmWorkerSerializedError;
      };
