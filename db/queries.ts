import "server-only";

import { genSaltSync, hashSync } from "bcrypt-ts";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as fs from 'fs';
import { writeFileSync, existsSync } from 'fs';

import { user, chat, User, reservation } from "./schema";

// Add this near the top of the file
const CA_CERT = `-----BEGIN CERTIFICATE-----
MIIETTCCArWgAwIBAgIUMVFwAcPyApGsBLG6qiEEuo9xfS8wDQYJKoZIhvcNAQEM
BQAwQDE+MDwGA1UEAww1YjljYTBiMTItN2Y2My00YWQ3LTg0YTMtMjliZDkwNDhm
OWI0IEdFTiAxIFByb2plY3QgQ0EwHhcNMjUwMjEzMDUyMzQyWhcNMzUwMjExMDUy
MzQyWjBAMT4wPAYDVQQDDDViOWNhMGIxMi03ZjYzLTRhZDctODRhMy0yOWJkOTA0
OGY5YjQgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
AYoCggGBAPSbG8uy/BfmoEGs2i4NydoWj/aQIe8qEi9ZzBppvNCHWv/jid7Xb6D3
4kkxKchQAU2/50E5VJ5UwtFHjUSOtDUOzhJkaiHlCNkzVkaDmkvpbA5IIVB1hmmK
6ew+WDnm4BDu+WeqoWpC932QmWs+uqR0WzNacJ1du4IIUfFiVhclpAiJeKiwMv0I
KXbe3uw+EOtXnjViZyxg0F0gF5lkMSmFz3/BVCrUzgv0yJ4kpk8gOIP9X3LCrzwA
MIZd55JxMq+nX2cWnj1C5H3fSh8V12GkGkmrX+4kCblNMCufdGE9cgfq9wXApcd/
ERNkSCAa/gzP1OO4xKSuxKy3esS/JQxCZFc8J3ANJKwomR11pARoxHXIQLaY8YH5
a3+OcN94HFzhmEm9oItnYyqK1vv/S6Rpr7EuSGvbbAIqwnEYBmgFl0N4WbsNFkSB
cJ2Y3wSPIzK9262/UjM6eIvhMCWz5T81yhLQibBV6BNG9pphuq5whr2cUtCDshft
FbSKDbnIFQIDAQABoz8wPTAdBgNVHQ4EFgQUS3WgE5tkK7KnmFE66KzeqoV6gaAw
DwYDVR0TBAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGB
ANCXeqSPd33rpgMtYD8NoMpx1FSAse7UILYAO2nNZ8RHhEzVKjP2unZ8kW53ShwC
ydJiv+zPI+zLRGiX2fzQXG/mByqLslx+XtO0zeTDIoRId+YnfNJPasKuU7xQbafR
CHfsVOWq+yY/tpTMrAfPQv3eh7635vpD6WJwGYKYu2ElIw5LBcPenk1vagHaxTZf
3TxusBb7uutN+kiZGxOjmUqdRMQ8STJOV/Q1kx/IOIzWN/k8m9juI+ASKUnKZ8SR
mWIWCM09JEY+YxhEzHGAZXG41Me1XKJAy0L9IqI9KiQjK3uzahEtHi7ZQUmN9qGn
hAKfFeBICMho5jgSRcQgzZvHgOe/ybF5bLQz47WxbZe1JDiqgXOuZQ5uw3cHxeNj
y5j+Zh5rqXUL6GgEkQMhM7ICh1iVXSHZzEK552DupZ0jPPh+L68UqHhiqdqeCBE6
9KgV1smuotoqY6NP2a13ZWX7z0pI0wZaulo6HUSZG6vF4Pjf3iC586BnjGl5DRye
rA==
-----END CERTIFICATE-----`;

// Create ca.crt if it doesn't exist
if (!existsSync('ca.crt')) {
  try {
    writeFileSync('ca.crt', CA_CERT);
    console.log('✅ Created ca.crt file');
  } catch (error) {
    console.error('❌ Failed to create ca.crt:', error);
    process.exit(1);
  }
}

// Read the CA certificate
const ca = fs.readFileSync('ca.crt').toString();

// Modify the verifyConnection function to use sql template literal
async function verifyConnection() {
  try {
    const sql = postgres(process.env.POSTGRES_URL!, {
      ssl: {
        ca,
        rejectUnauthorized: true
      },
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10
    });
    
    await sql`SELECT 1`;
    console.log('✅ Database connection verified');
    await sql.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Configure the PostgreSQL client with SSL
const client = postgres(process.env.POSTGRES_URL!, {
  ssl: {
    rejectUnauthorized: false // Allow self-signed certificates
  },
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10
});

export const db = drizzle(client);

// Only verify connection in development
if (process.env.NODE_ENV === 'development') {
  verifyConnection().catch(console.error);
}

// Add error type utility
type DatabaseError = {
  message: string;
  code?: string;
  detail?: string;
};

// Update error logging utility
const logError = (operation: string, error: unknown) => {
  const dbError = error as DatabaseError;
  console.error(`Database ${operation} failed:`, {
    message: dbError.message,
    code: dbError.code,
    detail: dbError.detail
  });
};

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error: unknown) {
    logError('getUser', error);
    // Rethrow with more context
    if (error instanceof Error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }
    throw new Error('Failed to get user: Unknown error');
  }
}

export async function createUser(email: string, password: string) {
  let salt = genSaltSync(10);
  let hash = hashSync(password, salt);

  try {
    const result = await db.insert(user).values({ email, password: hash });
    return result;
  } catch (error: unknown) {
    logError('createUser', error);
    const dbError = error as DatabaseError;
    // Handle unique constraint violation
    if (dbError.code === '23505') {
      throw new Error('User already exists');
    }
    throw new Error(`Failed to create user: ${dbError.message || 'Unknown error'}`);
  }
}

export async function saveChat({
  id,
  messages,
  userId,
}: {
  id: string;
  messages: any;
  userId: string;
}) {
  try {
    const selectedChats = await db.select().from(chat).where(eq(chat.id, id));

    if (selectedChats.length > 0) {
      return await db
        .update(chat)
        .set({
          messages: JSON.stringify(messages),
        })
        .where(eq(chat.id, id));
    }

    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      messages: JSON.stringify(messages),
      userId,
    });
  } catch (error: unknown) {
    logError('saveChat', error);
    if (error instanceof Error) {
      throw new Error(`Failed to save chat: ${error.message}`);
    }
    throw new Error('Failed to save chat: Unknown error');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error("Failed to delete chat by id from database");
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(chat)
      .where(eq(chat.userId, id))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    console.error("Failed to get chats by user from database");
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error("Failed to get chat by id from database");
    throw error;
  }
}

export async function createReservation({
  id,
  userId,
  details,
}: {
  id: string;
  userId: string;
  details: any;
}) {
  return await db.insert(reservation).values({
    id,
    createdAt: new Date(),
    userId,
    hasCompletedPayment: false,
    details: JSON.stringify(details),
  });
}

export async function getReservationById({ id }: { id: string }) {
  const [selectedReservation] = await db
    .select()
    .from(reservation)
    .where(eq(reservation.id, id));

  return selectedReservation;
}

export async function updateReservation({
  id,
  hasCompletedPayment,
}: {
  id: string;
  hasCompletedPayment: boolean;
}) {
  return await db
    .update(reservation)
    .set({
      hasCompletedPayment,
    })
    .where(eq(reservation.id, id));
}
