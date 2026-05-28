# Alice - Troubleshooting Guide 🔍

This guide outlines common deployment errors, database connection bugs, and integration failures, along with their step-by-step resolution pathways.

---

## 💾 1. Database & Migrations

### Bug: `match_knowledge_base RPC missing`
- **Symptom**: The AI service works but cannot search vector embedding articles, falling back to basic text queries.
- **Cause**: The pgvector similarity search matching database function is not registered in the schema.
- **Fix**: Open the **SQL Editor** on your Supabase dashboard and run the matching RPC function:
```sql
CREATE OR REPLACE FUNCTION match_knowledge_base (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_workspace_id uuid
)
RETURNS TABLE (
  id uuid,
  title varchar,
  content text,
  category varchar,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE kb.workspace_id = filter_workspace_id
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## ⚡ 2. Redis & Queues (Bull)

### Bug: `Redis ECONNREFUSED`
- **Symptom**: Telemetry shows persistent connection failures on port `6379`.
- **Cause**: Redis server is inactive on localhost, or docker network configurations are blocking loopback calls.
- **Fix**:
  1. If running manually outside Docker: Make sure your Redis server is running (`sudo systemctl start redis`).
  2. If running via Docker Compose: Verify that `REDIS_URL` in backend environment points to `redis://redis:6379` (referencing compose service hostname) instead of `127.0.0.1`.

---

## 🔌 3. Meta API Webhooks

### Bug: `Signature mismatch in webhook post`
- **Symptom**: Incoming customer WhatsApp messages are logged but rejected with `401 Unauthorized` status.
- **Cause**: `META_WEBHOOK_VERIFY_TOKEN` in `.env` is incorrect or missing.
- **Fix**: Match `META_WEBHOOK_VERIFY_TOKEN` exactly to the Verification Token registered on your Facebook Developer dashboard.
