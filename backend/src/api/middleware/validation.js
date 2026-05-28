const validate = (schema) => (req, res, next) => {
  try {
    // If schema defines body, query, or params, parse each, otherwise parse request body directly
    const parseTarget = {};
    if (schema.body) parseTarget.body = req.body;
    if (schema.query) parseTarget.query = req.query;
    if (schema.params) parseTarget.params = req.params;

    const targetToValidate = Object.keys(parseTarget).length > 0 ? parseTarget : req.body;
    const parsed = (schema.body || schema.query || schema.params)
      ? schema.safeParse(parseTarget)
      : schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation Failed',
        details: parsed.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    // Replace inputs with parsed inputs
    if (schema.body || schema.query || schema.params) {
      if (parsed.data.body) req.body = parsed.data.body;
      if (parsed.data.query) req.query = parsed.data.query;
      if (parsed.data.params) req.params = parsed.data.params;
    } else {
      req.body = parsed.data;
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  validate
};
