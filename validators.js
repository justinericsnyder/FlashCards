const Joi = require('joi');

const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  displayName: Joi.string().max(100).allow('', null),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const fetchPageSchema = Joi.object({
  url: Joi.string().uri().required(),
});

const generateCardsSchema = Joi.object({
  sections: Joi.array().items(Joi.object({ heading: Joi.string().required(), content: Joi.array().items(Joi.string()).required() })).min(1).required(),
  count: Joi.number().integer().min(1).max(50).optional(),
  difficulty: Joi.string().valid('beginner','intermediate','advanced').optional(),
  url: Joi.string().uri().optional(),
});

module.exports = {
  signupSchema, loginSchema, fetchPageSchema, generateCardsSchema,
  validate(schema, data) {
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
    if (error) throw error;
    return value;
  }
};
