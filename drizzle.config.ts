import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({
  path: ".env.local",
});

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
      rejectUnauthorized: false // Allow self-signed certificates
    }
  }
});
