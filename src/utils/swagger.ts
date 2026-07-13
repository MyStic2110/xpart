import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodSchema } from "zod";

interface SchemaOptions {
  tags?: string[];
  summary?: string;
  description?: string;
  body?: ZodSchema;
  querystring?: ZodSchema;
  params?: ZodSchema;
  response?: Record<number | string, ZodSchema>;
}

/**
 * Helper to build Fastify OpenAPI route schemas from Zod validation schemas.
 * Returns an object with the `{ schema }` key ready to be spread into route options.
 */
export function schemaDoc({
  tags,
  summary,
  description,
  body,
  querystring,
  params,
  response,
}: SchemaOptions) {
  const schema: any = {};
  
  if (tags) schema.tags = tags;
  if (summary) schema.summary = summary;
  if (description) schema.description = description;

  const cleanSchema = (s: ZodSchema) => {
    const jsonSchema = zodToJsonSchema(s, { target: "openApi3" }) as any;
    // Strip redundant top-level properties if present
    if (jsonSchema) {
      delete jsonSchema["$schema"];
      delete jsonSchema["additionalProperties"];
    }
    return jsonSchema;
  };

  if (body) schema.body = cleanSchema(body);
  if (querystring) schema.querystring = cleanSchema(querystring);
  if (params) schema.params = cleanSchema(params);
  
  if (response) {
    schema.response = {};
    for (const [code, resSchema] of Object.entries(response)) {
      schema.response[code] = cleanSchema(resSchema);
    }
  }

  return { schema };
}
