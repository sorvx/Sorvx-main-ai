import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import * as fs from 'fs';

config({
  path: ".env.local",
});

const ca = fs.readFileSync('ca.crt').toString();

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./lib/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    connectionString: process.env.POSTGRES_URL!,
    ssl: {
      ca,
      rejectUnauthorized: true
    }
  }
});
