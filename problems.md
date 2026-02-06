To help you identify potential problems in your Prisma schema for a PostgreSQL setup, I have analyzed your project structure, `hooks.server.ts`, and `CLAUDE.md`.

Since you are using **Prisma with PostgreSQL**, here are the potential problems and architectural pitfalls to watch out for:

### 1. The Soft Delete "Invisible Data" Problem
Your `CLAUDE.md` specifies that "All models have `deletedAt: DateTime?`" and "Queries filter out soft-deleted records by default."
*   **Problem**: Prisma does **not** filter out soft-deleted records by default. You must remember to add `where: { deletedAt: null }` to every single `findMany`, `findUnique`, and relation include.
*   **Risk**: Forgetting this in a financial module could lead to incorrect balance calculations (e.g., including a deleted "Income" record in a total sum).
*   **Solution**: Consider using a [Prisma Middleware](https://www.prisma.io/docs/concepts/components/prisma-client/middleware) or the newer [Prisma Client Extensions](https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions) to automatically filter out records where `deletedAt` is not null.

### 2. Referential Integrity vs. Soft Deletes
*   **Problem**: PostgreSQL foreign key constraints (`ON DELETE CASCADE`) are designed for hard deletes. If you soft-delete a `Client`, its related `Projects` will still exist and appear "active" in the database unless you manually cascade the soft-delete in your application logic.
*   **Risk**: "Orphaned" records that point to a deleted parent, causing UI errors when trying to navigate from a Project to its (now "hidden") Client.

### 3. Enum Management Complexity
Your project uses a hybrid approach: `EnumType` and `EnumValue` tables (dynamic) alongside standard PostgreSQL enums (likely for static things like Roles).
*   **Problem**: Prisma does not support "Dynamic Enums" natively as TypeScript types.
*   **Risk**: You will lose type safety when working with `EnumValue` strings. If a developer typos `"active"` as `"atcive"` in a query, Prisma won't catch it at compile time.
*   **Solution**: Ensure your `src/lib/server/enums.ts` utility generates helper objects or const assertions to maintain type safety.

### 4. Concurrent Prisma Client Instances
In your `hooks.server.ts`, you import `prisma` from `$lib/server/prisma`.
*   **Problem**: In SvelteKit's development mode (Vite), hot module reloading can cause multiple instances of the Prisma Client to be instantiated, eventually exhausting the PostgreSQL connection pool.
*   **Solution**: Ensure your `$lib/server/prisma.ts` uses the global variable pattern:

<llm-snippet-file>src/lib/server/prisma.ts</llm-snippet-file>
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 5. Performance of the Session Validation Hook
In `hooks.server.ts`, you are performing a database lookup on **every single request** to validate the user:
```typescript
const user = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { id: true, deletedAt: true }
});
```
*   **Problem**: This adds latency to every page load and API call.
*   **Risk**: If your PostgreSQL database is under heavy load, the entire UI will feel sluggish.
*   **Solution**: Use a caching layer (like Redis) for session validation or only perform this check when the session is first created or on sensitive actions.

### 6. Audit Log Table Growth
*   **Problem**: If you log `oldValues` and `newValues` for every change in a busy system, the `AuditLog` table will quickly become the largest table in your database.
*   **Risk**: Slowing down the database and increasing storage costs.
*   **Solution**: Ensure you have a proper indexing strategy on `entityId` and `createdAt` in your `schema.prisma`.

### 7. Money Handling (Precision)
Your project involves Finances (Income/Expenses).
*   **Problem**: PostgreSQL `REAL` or `DOUBLE PRECISION` should **never** be used for money. Prisma's `Float` maps to these.
*   **Solution**: Always use the `Decimal` type in `schema.prisma` (which maps to PostgreSQL `NUMERIC`/`DECIMAL`) for any financial amounts to avoid floating-point rounding errors.

```prisma
model Income {
  id     String  @id @default(cuid())
  amount Decimal @db.Decimal(19, 4) // Example: 19 digits total, 4 after decimal
}
```

### 8. Case Sensitivity in Search
*   **Problem**: PostgreSQL `LIKE` or `CONTAINS` queries in Prisma are case-sensitive by default.
*   **Risk**: Searching for "John" won't find "john".
*   **Solution**: Use the `mode: 'insensitive'` property in your Prisma queries:
```typescript
prisma.client.findMany({
  where: { name: { contains: 'searchQuery', mode: 'insensitive' } }
})
```

kotlin.Unit

