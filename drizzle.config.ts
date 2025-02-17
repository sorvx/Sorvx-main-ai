import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import * as fs from 'fs';

config({
  path: ".env.local",
});

const ca = fs.readFileSync('ca.crt').toString();

// Parse connection string
const parseConnectionString = (url: string) => {
  const regex = /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/;
  const matches = url.match(regex);
  
  if (!matches) {
    throw new Error('Invalid connection string format');
  }

  const [, user, password, host, port, database] = matches;
  
  return {
    user,
    password,
    host,
    port: parseInt(port, 10),
    database
  };
};

const dbConfig = parseConnectionString(process.env.POSTGRES_URL!);

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./lib/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    ...dbConfig,
    ssl: {
      ca,
      rejectUnauthorized: true
    }
  }
});
