const { createHandler } = require('@vercel/node');
const jwt = require('jsonwebtoken');
const { kv } = require('@vercel/kv');

const SECRET_KEY = 'tokenauth'; // Substitua por uma chave secreta mais segura em um ambiente de produção
const TOKENS_NAMESPACE = 'tokens';

const handler = createHandler();

handler.use((req, res, next) => {
  // Adicione a sua lógica de middleware de autenticação aqui, se necessário
  next();
});

handler.post('/criar-token', async (req, res) => {
  const { email } = req.body;

  // Verifica se a chave fornecida no header é válida
  const authHeader = req.headers['authorization'];
  const providedSecretKey = authHeader && authHeader.split(' ')[1];

  if (providedSecretKey !== SECRET_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Gera um novo token usando a mesma chave secreta
  const newToken = jwt.sign({ email }, SECRET_KEY);

  // Salva o novo token no KV
  await kv.put(`${TOKENS_NAMESPACE}:${email}`, newToken);

  res.json({ token: newToken });
});

handler.get('/cardInfo/:cardNumber', authenticateToken, async (req, res) => {
  const cardNumber = req.params.cardNumber;

  // Extrai os primeiros 6 dígitos do número do cartão
  const bin = cardNumber.slice(0, 6);

  // Adapte conforme necessário para buscar informações do cartão no seu caso
  // Pode ser necessário fazer uma chamada à sua lista de cartões ou a uma API externa
  const cardInfo = { /* Obtenha informações do cartão conforme necessário */ };

  if (cardInfo) {
    res.json(cardInfo);
  } else {
    res.status(404).json({ error: 'Card not found' });
  }
});

module.exports = handler;
