import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";
import { env } from "@/env";

const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle(queryClient, { schema });
