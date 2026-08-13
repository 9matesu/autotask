import { z } from 'zod';

export const AutotaskConfigSchema = z.object({
  repository: z.string().default('.'),
  opencode: z.object({
    command: z.string().default('opencode'),
    agent: z.enum(['build', 'plan']).default('build'),
    model: z.string().nullable().default(null),
    useServer: z.boolean().default(false),
    autoApprove: z.boolean().default(false),
  }).default({}),
  queue: z.object({
    concurrency: z.number().int().min(1).max(1).default(1),
    autoStart: z.boolean().default(false),
  }).default({}),
  retry: z.object({
    enabled: z.boolean().default(true),
    maxAttempts: z.number().int().min(1).default(3),
    initialBackoffSeconds: z.number().min(1).default(5),
    maxBackoffSeconds: z.number().min(5).default(300),
    backoffMultiplier: z.number().min(1).default(2),
    jitter: z.boolean().default(true),
    respectRetryAfter: z.boolean().default(true),
  }).default({}),
  monitoring: z.object({
    idleTimeoutSeconds: z.number().int().min(10).default(300),
    hardTimeoutSeconds: z.number().int().min(30).default(1800),
  }).default({}),
  context: z.object({
    autoCompact: z.boolean().default(true),
  }).default({}),
  git: z.object({
    autoCommit: z.boolean().default(true),
    commitPrefix: z.string().default('agent: complete task'),
    postTaskCommand: z.string().nullable().default(null),
  }).default({}),
  providerPolicy: z.object({
    rateLimitBackoff: z.boolean().default(true),
    initialBackoffSeconds: z.number().default(10),
    maxBackoffSeconds: z.number().default(300),
    respectRetryAfter: z.boolean().default(true),
  }).default({}),
});

export type AutotaskConfig = z.infer<typeof AutotaskConfigSchema>;
export type AutotaskConfigInput = z.input<typeof AutotaskConfigSchema>;
