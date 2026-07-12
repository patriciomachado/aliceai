/**
 * Budget / Quote Sanitizer
 * --------------------------------------------------------------
 * Catches any price or model mention in the AI reply that is NOT
 * present in the official catalog (products + services) and rewrites
 * the offending content with a polite "not registered" message.
 *
 * This is the deterministic, server-side backstop for the system
 * prompt rules. The prompt alone is not enough because models
 * (especially smaller ones like Haiku) will still occasionally
 * hallucinate prices when the customer asks for a quote.
 *
 * Public API:
 *   sanitizeReply(reply, productsList, servicesList, customerMessage)
 *   -> { reply, wasSanitized, violations: [...] }
 *
 * Behavior:
 *   - Any "R$" or "reais" mention not present (within tolerance) in
 *     productsList/servicesList is REMOVED and replaced with a
 *     fallback line.
 *   - Any device model mention (iPhone X, Samsung Y, etc.) that
 *     lacks a matching service entry is replaced with a fallback
 *     line — the agent must NOT quote a price for an unregistered
 *     model.
 *   - If the entire reply is composed of prohibited quotes, the
 *     function returns a fully sanitized fallback so the customer
 *     is never sent an empty or invalid message.
 */

const PRICE_REGEX = /R\$\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/gi;
const BRL_WORD_REGEX = /\b(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)\s*reais\b/gi;

// Common device model patterns the customer may ask about
const MODEL_PATTERNS = [
  /\biphone\s*\d{1,2}\s*(?:pro\s*max|pro|plus|mini)?\b/gi,
  /\bipad\s*(?:pro|air|mini)?\s*\d?\b/gi,
  /\bsamsung\s*(?:galaxy\s*)?(?:s|a|m|z|note)?\s*\d{1,3}\s*(?:plus|ultra|fe)?\b/gi,
  /\bmotorola\s*(?:moto\s*)?[a-z]?\s*\d{1,3}\s*(?:plus|ultra)?\b/gi,
  /\bxiaomi\s*(?:redmi|mi)?\s*\d{1,3}\s*(?:pro|plus|ultra)?\b/gi,
  /\bgalaxy\s*[a-z]?\s*\d{1,3}\b/gi
];

const FALLBACK_LINE =
  'Não possuo esse valor/Modelo cadastrado no meu sistema no momento. Vou transferir você para um colaborador humano que poderá verificar e passar o orçamento correto. 🙂';

const TOLERANCE = 0.05; // 5% — aceita pequenas variações de formatação

const parseBRL = (raw) => {
  if (!raw) return NaN;
  // Normalize Brazilian format: "1.200,50" -> 1200.50 ; "350,00" -> 350.00
  let cleaned = String(raw).replace(/\s/g, '');
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

const buildCatalogPriceSet = (productsList, servicesList) => {
  const set = new Set();
  for (const p of productsList || []) {
    if (p && p.price !== null && p.price !== undefined) {
      set.add(Number(p.price));
    }
  }
  for (const s of servicesList || []) {
    if (s && s.price !== null && s.price !== undefined) {
      set.add(Number(s.price));
    }
  }
  return set;
};

const isPriceInCatalog = (rawPrice, catalogSet) => {
  const n = parseBRL(rawPrice);
  if (!Number.isFinite(n)) return true; // if we can't parse, don't punish — let other validators catch it
  for (const catalogPrice of catalogSet) {
    if (Math.abs(catalogPrice - n) <= Math.max(0.5, catalogPrice * TOLERANCE)) {
      return true;
    }
  }
  return false;
};

const detectModelsInText = (text) => {
  const found = new Set();
  if (!text) return [];
  for (const pattern of MODEL_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) matches.forEach((m) => found.add(m.trim().toLowerCase()));
  }
  return Array.from(found);
};

const modelHasMatchingService = (model, servicesList) => {
  if (!servicesList || servicesList.length === 0) return false;
  const m = model.toLowerCase();
  return servicesList.some((s) => {
    const name = (s.name || '').toLowerCase();
    const desc = (s.description || '').toLowerCase();
    // Match if the model (or a key part of it) appears in the service name/description
    const tokens = m.split(/\s+/).filter((t) => t.length >= 2);
    return tokens.some((t) => name.includes(t) || desc.includes(t));
  });
};

/**
 * Sanitizes the AI reply by removing/redacting any price or device model
 * mention that is not backed by an entry in the workspace catalog.
 *
 * @param {string} reply - The raw assistant text from the LLM
 * @param {Array}  productsList - Catalog of products loaded from Supabase
 * @param {Array}  servicesList - Catalog of services loaded from Supabase
 * @param {string} [customerMessage] - The original user message (for context)
 * @returns {{ reply: string, wasSanitized: boolean, violations: string[] }}
 */
const sanitizeReply = (reply, productsList, servicesList, customerMessage = '') => {
  const violations = [];
  if (!reply || typeof reply !== 'string') {
    return { reply: '', wasSanitized: false, violations: [] };
  }

  let sanitized = reply;
  const catalogSet = buildCatalogPriceSet(productsList, servicesList);

  // 1. Validate "R$ ..." prices
  sanitized = sanitized.replace(PRICE_REGEX, (match, rawPrice) => {
    if (isPriceInCatalog(rawPrice, catalogSet)) {
      return match; // keep — this price is registered
    }
    violations.push(`unauthorized_price:${match}`);
    return '[PREÇO_REMOVIDO]';
  });

  // 2. Validate "X reais" mentions
  sanitized = sanitized.replace(BRL_WORD_REGEX, (match, rawPrice) => {
    if (isPriceInCatalog(rawPrice, catalogSet)) {
      return match;
    }
    violations.push(`unauthorized_price_text:${match}`);
    return '[PREÇO_REMOVIDO]';
  });

  // 3. Detect device model mentions without a matching service
  //    (only enforced if the customer asked about a model OR the reply
  //    itself references a model — the agent shouldn't invent model
  //    compatibility either)
  const customerModels = detectModelsInText(customerMessage);
  const replyModels = detectModelsInText(sanitized);
  const allModels = Array.from(new Set([...customerModels, ...replyModels]));

  for (const model of allModels) {
    if (!modelHasMatchingService(model, servicesList)) {
      const modelRegex = new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      if (modelRegex.test(sanitized)) {
        violations.push(`unregistered_model:${model}`);
      }
    }
  }

  // 4. If we left [PREÇO_REMOVIDO] placeholders, clean up surrounding
  //    punctuation/whitespace left behind by the removal, so we don't
  //    ship sentences like "fica em torno de . Quer agendar?".
  if (sanitized.includes('[PREÇO_REMOVIDO]')) {
    // Step A: target specific multi-word connector phrases that
    // introduced the removed price (e.g. "em torno de [PREÇO_REMOVIDO]"
    // -> "em torno de"). We only match these explicit phrases, never
    // lone articles like "o"/"a" — those are protected.
    sanitized = sanitized.replace(
      /\b(em\s+torno\s+de|por\s+volta\s+de|cerca\s+de|aproximadament[ea]\s+de?|a\s+partir\s+de|média\s+de|em\s+média\s+de|ficar\s+em|fica\s+em|custo\s+de|valor\s+de|preço\s+de|tabela\s+de|or[çc]amento\s+de|uns?\s+|umas?\s+)\[PREÇO_REMOVIDO\]/gi,
      '$1'
    );

    // Step B: drop the token itself along with any punctuation glued to it
    sanitized = sanitized.replace(/\[PREÇO_REMOVIDO\][\s,.;:!?]*/g, ' ');

    // Step C: clean up artifacts
    sanitized = sanitized.replace(/[ \t]{2,}/g, ' ');
    sanitized = sanitized.replace(/\s*,\s*,/g, ',');
    sanitized = sanitized.replace(/\.\s*\./g, '.');
    sanitized = sanitized.replace(/:\s*:/g, ':');

    // Step D: trim orphan prepositions at the end of a sentence and
    // at the start of a line. We do NOT touch inline prepositions
    // because that would damage legitimate sentences.
    sanitized = sanitized.replace(/[ \t]+(de|em|por|para|a|o|e|do|da|no|na)[ \t]*([.!?])/g, '$2');
    sanitized = sanitized.replace(/(^|[\.\!\?])\s+(de|em|por|para|a|o|e|do|da|no|na)\s+/g, '$1 ');

    // Final whitespace + line break cleanup
    sanitized = sanitized.replace(/[ \t]{2,}/g, ' ');
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
    sanitized = sanitized.trim();

    // If the reply no longer contains ANY price mention, append a clear
    // fallback so the customer is not left hanging.
    if (!/R\$/i.test(sanitized) && !/\d+\s*reais/i.test(sanitized)) {
      // Only append if there was a price violation — we don't want to
      // spam fallback when other rules triggered.
      if (violations.some((v) => v.startsWith('unauthorized_price'))) {
        // Check if the fallback is already there
        if (!/cadastrado no meu sistema/i.test(sanitized)) {
          sanitized = `${sanitized}\n\n${FALLBACK_LINE}`;
        }
      }
    }
  }

  // 5. If the customer asked about a specific model that has no
  //    registered service AND the agent is clearly trying to quote
  //    something for it, force the fallback even if no R$ was found
  //    (defensive — catches cases like "fica em torno de X" or
  //    "geralmente custa Y" without explicit R$).
  if (customerModels.length > 0 && servicesList && servicesList.length > 0) {
    const customerHasUnregisteredModel = customerModels.some(
      (m) => !modelHasMatchingService(m, servicesList)
    );
    const replyHintsAtPrice = /\b(ficar|custa|valor|orçamento|preço|tabela|aproximad)/i.test(sanitized);
    if (customerHasUnregisteredModel && replyHintsAtPrice && !/cadastrado no meu sistema/i.test(sanitized)) {
      violations.push('unregistered_model_price_hint');
      sanitized = `${sanitized}\n\n${FALLBACK_LINE}`;
    }
  }

  return {
    reply: sanitized,
    wasSanitized: violations.length > 0,
    violations
  };
};

module.exports = {
  sanitizeReply,
  // Exposed for unit testing
  _internal: {
    parseBRL,
    isPriceInCatalog,
    detectModelsInText,
    modelHasMatchingService,
    PRICE_REGEX,
    MODEL_PATTERNS
  }
};
