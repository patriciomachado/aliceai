const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../../config/database');
const { validate } = require('../middleware/validation');
const { z } = require('zod');
const { openai } = require('../../config/llm');

const kbSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  is_published: z.boolean().default(true)
});

/**
 * GET /api/knowledge-base
 * Fetch knowledge base article lists
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = supabase
      .from('knowledge_base')
      .select('*')
      .eq('workspace_id', req.workspaceId);

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data: articles, error } = await query;
    if (error) throw error;

    res.json(articles);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/knowledge-base/:id
 * Retrieve article details
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: article, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .single();

    if (error || !article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(article);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/knowledge-base
 * Create dynamic article
 */
router.post('/', requireAuth, validate(kbSchema), async (req, res, next) => {
  try {
    const { title, content, category, tags, is_published } = req.body;

    let embedding = null;
    try {
      if (process.env.OPENAI_API_KEY) {
        const embRes = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: `${title}\n${content}`
        });
        embedding = embRes.data[0].embedding;
      }
    } catch (embErr) {
      console.warn('[Knowledge Base Route] Failed to calculate vector embedding:', embErr.message);
    }

    const { data: article, error } = await supabase
      .from('knowledge_base')
      .insert({
        workspace_id: req.workspaceId,
        title,
        content,
        category,
        tags,
        embedding,
        is_published
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(article);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/knowledge-base/:id
 * Update article content
 */
router.put('/:id', requireAuth, validate(kbSchema), async (req, res, next) => {
  try {
    const { title, content, category, tags, is_published } = req.body;

    let embedding = null;
    try {
      if (process.env.OPENAI_API_KEY) {
        const embRes = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: `${title}\n${content}`
        });
        embedding = embRes.data[0].embedding;
      }
    } catch (embErr) {
      console.warn('[Knowledge Base Route] Failed to calculate vector embedding:', embErr.message);
    }

    const { data: article, error } = await supabase
      .from('knowledge_base')
      .update({
        title,
        content,
        category,
        tags,
        embedding,
        is_published
      })
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId)
      .select()
      .single();

    if (error || !article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(article);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/knowledge-base/:id
 * Remove article from database
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspaceId);

    if (error) throw error;
    res.json({ success: true, message: 'Article deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
