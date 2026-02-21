import { Type, type Static } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { Jobs } from "./jobs.js";

// --- Schemas ---

const enqueueSchema = Type.Object(
  {
    type: Type.String({
      minLength: 1,
      description: "Job type identifier for routing to the appropriate handler"
    }),
    payload: Type.Optional(
      Type.Unknown({ description: "Serializable data to pass to the job handler" })
    ),
    priority: Type.Optional(
      Type.Number({
        minimum: 0,
        description: "Job priority (0=highest, default=5). Lower numbers run first"
      })
    ),
    maxAttempts: Type.Optional(
      Type.Number({
        minimum: 1,
        description: "Maximum retry attempts before marking job as dead (default=3)"
      })
    ),
    runAfter: Type.Optional(
      Type.Number({
        description: "Unix timestamp (ms) to delay execution until. Default is immediate"
      })
    )
  },
  { additionalProperties: false }
);

const cancelSchema = Type.Object(
  {
    jobId: Type.String({ minLength: 1, description: "ID of the job to cancel" })
  },
  { additionalProperties: false }
);

const getSchema = Type.Object(
  {
    jobId: Type.String({ minLength: 1, description: "ID of the job to retrieve" })
  },
  { additionalProperties: false }
);

const listSchema = Type.Object(
  {
    status: Type.Optional(
      Type.Union([
        Type.Literal("pending"),
        Type.Literal("running"),
        Type.Literal("completed"),
        Type.Literal("failed"),
        Type.Literal("dead")
      ], { description: "Filter by job status" })
    ),
    type: Type.Optional(Type.String({ minLength: 1, description: "Filter by job type" })),
    limit: Type.Optional(Type.Number({ minimum: 1, description: "Maximum number of jobs to return" }))
  },
  { additionalProperties: false }
);

type EnqueueJobArgs = Static<typeof enqueueSchema>;
type CancelJobArgs = Static<typeof cancelSchema>;
type GetJobArgs = Static<typeof getSchema>;
type ListJobArgs = Static<typeof listSchema>;

// --- Result Schemas ---

const jobEnqueueResultSchema = Type.Object(
  {
    summary: Type.String(),
    jobId: Type.String(),
    type: Type.String(),
    priority: Type.Number()
  },
  { additionalProperties: false }
);

type JobEnqueueResult = Static<typeof jobEnqueueResultSchema>;

const jobEnqueueReturns: ToolResultContract<JobEnqueueResult> = {
  schema: jobEnqueueResultSchema,
  toLLMText: (result) => result.summary
};

const jobCancelResultSchema = Type.Object(
  {
    summary: Type.String(),
    jobId: Type.String(),
    cancelled: Type.Boolean()
  },
  { additionalProperties: false }
);

type JobCancelResult = Static<typeof jobCancelResultSchema>;

const jobCancelReturns: ToolResultContract<JobCancelResult> = {
  schema: jobCancelResultSchema,
  toLLMText: (result) => result.summary
};

const jobGetResultSchema = Type.Object(
  {
    summary: Type.String(),
    jobId: Type.String(),
    found: Type.Boolean()
  },
  { additionalProperties: false }
);

type JobGetResult = Static<typeof jobGetResultSchema>;

const jobGetReturns: ToolResultContract<JobGetResult> = {
  schema: jobGetResultSchema,
  toLLMText: (result) => result.summary
};

const jobListResultSchema = Type.Object(
  {
    summary: Type.String(),
    recordCount: Type.Number()
  },
  { additionalProperties: false }
);

type JobListResult = Static<typeof jobListResultSchema>;

const jobListReturns: ToolResultContract<JobListResult> = {
  schema: jobListResultSchema,
  toLLMText: (result) => result.summary
};

// --- Tool Builders ---

export function buildJobEnqueueTool(jobs: Jobs): ToolDefinition {
  return {
    tool: {
      name: "job_enqueue",
      description:
        "Enqueue a background job for durable execution. Jobs persist across restarts and support automatic retry with backoff.",
      parameters: enqueueSchema
    },
    returns: jobEnqueueReturns,
    execute: async (args, toolContext, toolCall) => {
      const payload = args as EnqueueJobArgs;
      const job = await jobs.enqueue({
        type: payload.type,
        payload: payload.payload,
        priority: payload.priority,
        maxAttempts: payload.maxAttempts,
        runAfter: payload.runAfter,
        agentId: toolContext.agent.id
      });

      const summary = `Enqueued job ${job.id} of type "${job.type}" with priority ${job.priority}.`;
      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: summary }],
        details: {
          jobId: job.id,
          type: job.type,
          status: job.status,
          priority: job.priority,
          maxAttempts: job.maxAttempts,
          runAfter: job.runAfter
        },
        isError: false,
        timestamp: Date.now()
      };

      return {
        toolMessage,
        typedResult: {
          summary,
          jobId: job.id,
          type: job.type,
          priority: job.priority
        }
      };
    }
  };
}

export function buildJobCancelTool(jobs: Jobs): ToolDefinition {
  return {
    tool: {
      name: "job_cancel",
      description: "Cancel a pending job. Only pending jobs can be cancelled.",
      parameters: cancelSchema
    },
    returns: jobCancelReturns,
    execute: async (args, _toolContext, toolCall) => {
      const payload = args as CancelJobArgs;
      const cancelled = await jobs.cancel(payload.jobId);

      const summary = cancelled
        ? `Cancelled job ${payload.jobId}.`
        : `Could not cancel job ${payload.jobId} (not found or not pending).`;
      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: summary }],
        details: { jobId: payload.jobId, cancelled },
        isError: false,
        timestamp: Date.now()
      };

      return {
        toolMessage,
        typedResult: {
          summary,
          jobId: payload.jobId,
          cancelled
        }
      };
    }
  };
}

export function buildJobGetTool(jobs: Jobs): ToolDefinition {
  return {
    tool: {
      name: "job_get",
      description: "Get details of a specific job by ID.",
      parameters: getSchema
    },
    returns: jobGetReturns,
    execute: async (args, _toolContext, toolCall) => {
      const payload = args as GetJobArgs;
      const job = await jobs.get(payload.jobId);

      const summary = job
        ? `Job ${job.id}: ${job.type} (${job.status})`
        : `Job ${payload.jobId} not found.`;
      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: summary }],
        details: job ?? null,
        isError: false,
        timestamp: Date.now()
      };

      return {
        toolMessage,
        typedResult: {
          summary,
          jobId: payload.jobId,
          found: job !== null
        }
      };
    }
  };
}

export function buildJobListTool(jobs: Jobs): ToolDefinition {
  return {
    tool: {
      name: "job_list",
      description: "List jobs with optional filtering by status or type.",
      parameters: listSchema
    },
    returns: jobListReturns,
    execute: async (args, _toolContext, toolCall) => {
      const payload = args as ListJobArgs;
      const jobList = await jobs.list({
        status: payload.status,
        type: payload.type,
        limit: payload.limit
      });
      const counts = await jobs.countByStatus();
      const total = Object.values(counts).reduce((a, b) => a + b, 0);

      const summary = `Found ${jobList.length} jobs (${counts.pending} pending, ${counts.running} running, ${total} total).`;
      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: summary }],
        details: {
          jobs: jobList.map((job) => ({
            id: job.id,
            type: job.type,
            status: job.status,
            priority: job.priority,
            attempts: job.attempts,
            createdAt: job.createdAt
          })),
          counts
        },
        isError: false,
        timestamp: Date.now()
      };

      return {
        toolMessage,
        typedResult: {
          summary,
          recordCount: jobList.length
        }
      };
    }
  };
}
