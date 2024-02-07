const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const port = 3000;

const BINLIST_API_URL = 'https://raw.githubusercontent.com/iannuttall/binlist-data/master/binlist-data.csv';
const SECRET_KEY = 'tokenauth'; // Substitua por uma chave secreta mais segura em um ambiente de produção
const TOKEN_FILE_PATH = path.join(__dirname, 'tokens.json'); // Caminho do arquivo para armazenar tokens e emails

let cardList = [];
let tokensData = {};

async function fetchCardList() {
  try {
    const response = await axios.get(BINLIST_API_URL);
    const data = response.data.split('\n');
    
    for (const row of data) {
      const columns = row.split(',');
      const cardInfo = {
        BIN: columns[0],
        Brand: columns[1],
        Type: columns[2],
        // Inclua os demais campos conforme necessário
      };
      cardList.push(cardInfo);
    }
  } catch (error) {
    console.error('Error fetching card list:', error);
  }
}

// Inicializa a lista de cartões ao iniciar o servidor
fetchCardList();

// Carrega dados de tokens do arquivo JSON ou cria o arquivo se não existir
async function loadTokensData() {
  try {
    await fs.access(TOKEN_FILE_PATH);
    const fileData = await fs.readFile(TOKEN_FILE_PATH, 'utf-8');
    tokensData = JSON.parse(fileData);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Cria o arquivo se não existir
      await saveTokensData();
    } else {
      console.error('Error loading tokens data:', error);
    }
  }
}

// Salva dados de tokens no arquivo JSON
async function saveTokensData() {
  try {
    await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify(tokensData, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving tokens data:', error);
  }
}

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1]; // Extrai o token Bearer
  
    if (!token) {
      console.error('Token missing');
      return res.status(401).json({ error: 'Token missing' });
    }
  
    console.log('Received token:', token); // Adicione esta linha para imprimir o token no console
  
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) {
        console.error('Token verification failed:', err.message);
        return res.status(403).json({ error: 'Token verification failed', message: err.message });
      }
      req.user = user;
      next();
    });
  };
  
  

// Carrega dados de tokens ao iniciar o servidor
loadTokensData();

app.use(express.json());

app.post('/criar-token', async (req, res) => {
    const { email } = req.body;
  
    // Verifica se a chave fornecida no header é válida
    const authHeader = req.header('Authorization');
    const providedSecretKey = authHeader && authHeader.split(' ')[1];
  
    if (providedSecretKey !== SECRET_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
  
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
  
    // Gera um novo token usando a mesma chave secreta
    const newToken = jwt.sign({ email }, SECRET_KEY);
  
    // Salva o novo token e seu email nos dados
    tokensData[email] = newToken;
  
    // Salva os dados atualizados no arquivo
    await saveTokensData();
  
    res.json({ token: newToken });
  });
  

  app.post('/delete-token', async (req, res) => {
    const { email } = req.body;
  
    // Verifica se a chave fornecida no header é válida
    const authHeader = req.header('Authorization');
    const providedSecretKey = authHeader && authHeader.split(' ')[1];
  
    if (providedSecretKey !== SECRET_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
  
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
  
    // Deleta o token associado ao email
    delete tokensData[email];
  
    // Salva os dados atualizados no arquivo
    await saveTokensData();
  
    res.json({ message: 'Token deleted successfully' });
  });
  

  const MAX_REQUESTS_PER_DAY = 500;

  const requestCounts = {}; // Armazena o número de solicitações por token por dia
  
  app.get('/cardInfo/:cardNumber', authenticateToken, (req, res) => {
    const cardNumber = req.params.cardNumber;
  
    // Extrai os primeiros 6 dígitos do número do cartão
    const bin = cardNumber.slice(0, 6);
  
    // Verifica o número máximo de solicitações permitidas por dia para o token atual
    const userToken = req.header('Authorization').split(' ')[1];
    const userRequestKey = `${userToken}_${new Date().toISOString().split('T')[0]}`;
  
    if (!requestCounts[userRequestKey]) {
      requestCounts[userRequestKey] = 0;
    }
  
    if (requestCounts[userRequestKey] >= MAX_REQUESTS_PER_DAY) {
      return res.status(429).json({ error: 'Too many requests for today' });
    }
    

    // Atualiza o número de solicitações para o token atual
    requestCounts[userRequestKey]++;
  
    // Encontra o bin correspondente na lista
    const cardInfo = cardList.find((card) => card.BIN === bin);
  
    if (cardInfo) {
      res.json(cardInfo);
    } else {
      res.status(404).json({ error: 'Card not found' });
    }
  });

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});