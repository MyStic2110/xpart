import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";
import { env } from "@/env";

const poolMax = process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 25;
const queryClient = postgres(env.DATABASE_URL, { max: poolMax });
export const db = drizzle(queryClient, { schema });
