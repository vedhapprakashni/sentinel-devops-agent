/**
 * Kubernetes Validation Schemas
 * Input validation for Kubernetes endpoints
 */

const { z } = require('zod');

/**
 * Namespace query validation
 */
const namespaceQuerySchema = z.object({
  namespace: z
    .string()
    .min(1, 'namespace must not be empty')
    .optional()
    .default('default')
    .describe('Kubernetes namespace'),
});

/**
 * Pod query validation
 */
const podQuerySchema = z.object({
  namespace: z
    .string()
    .min(1, 'namespace must not be empty')
    .optional()
    .default('default')
    .describe('Kubernetes namespace'),
});

/**
 * Deployment query validation
 */
const deploymentQuerySchema = z.object({
  namespace: z
    .string()
    .min(1, 'namespace must not be empty')
    .optional()
    .default('default')
    .describe('Kubernetes namespace'),
});

/**
 * Events query validation
 */
const eventsQuerySchema = z.object({
  namespace: z
    .string()
    .min(1, 'namespace must not be empty')
    .optional()
    .default('default')
    .describe('Kubernetes namespace'),
});

/**
 * Watch pods request validation
 */
const watchPodsSchema = z.object({
  namespace: z
    .string()
    .min(1, 'namespace must not be empty')
    .optional()
    .default('default')
    .describe('Kubernetes namespace to watch'),
});

module.exports = {
  namespaceQuerySchema,
  podQuerySchema,
  deploymentQuerySchema,
  eventsQuerySchema,
  watchPodsSchema,
};
