const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 21469;

const BINLIST_API_URL = 'https://raw.githubusercontent.com/iannuttall/binlist-data/master/binlist-data.csv';
const SECRET_KEY = 'tokenauth'; // Substitua por uma chave secreta mais segura em um ambiente de produção
const TOKEN_FILE_PATH = path.join(__dirname, 'tokens.json');
const IMAGES_PATH = path.join(__dirname, 'imgs');

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
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.error('Token missing');
    return res.status(401).json({ error: 'Token missing' });
  }

  console.log('Received token:', token);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      console.error('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Token verification failed', message: err.message });
    }
    req.user = user;
    next();
  });
};

// Servir arquivos estáticos da pasta "images"
app.use('/imgs', express.static(IMAGES_PATH));

// Carrega dados de tokens ao iniciar o servidor
loadTokensData();

app.get('/cardInfo/:cardNumber', authenticateToken, (req, res) => {
  const cardNumber = req.params.cardNumber;
  const bin = cardNumber.slice(0, 6);

  const userToken = req.header('Authorization').split(' ')[1];
  const userRequestKey = `${userToken}_${new Date().toISOString().split('T')[0]}`;

  // Lógica para encontrar o bin correspondente na lista
  const cardInfo = cardList.find((card) => card.BIN === bin);

  if (cardInfo) {
    // Lógica para mapear a resposta "imageLight" com base na marca (brand)
    let imageLight;
    const brandImageMapping = {
      VISA: 'visa.png',
      MASTERCARD: 'master.png',
      DISCOVER: 'discover.png',
      'AMERICAN EXPRESS': 'amex.png',
      ELO: 'elo.png',
      // Adicione mais mapeamentos conforme necessário
    };

    if (brandImageMapping[cardInfo.Brand]) {
      imageLight = `https://apis.flowcodeacademy.com.br/imgs/${brandImageMapping[cardInfo.Brand]}`;
    } else {
      imageLight = 'https://apis.flowcodeacademy.com.br/imgs/empty.png';
    }

    // Lógica para mapear a resposta "imageDark" com base na marca (brand)
    let imageDark;
    const brandImageDarkMapping = {
      VISA: 'visadark.png',
      DISCOVER: 'discoverdark.png',
      MASTERCARD: 'masterdark.png',
      'AMERICAN EXPRESS': 'amexdark.png',
      ELO: 'elodark.png',
      // Adicione mais mapeamentos conforme necessário
    };

    if (brandImageDarkMapping[cardInfo.Brand]) {
      imageDark = `https://apis.flowcodeacademy.com.br/imgs/${brandImageDarkMapping[cardInfo.Brand]}`;
    } else {
      imageDark = 'https://apis.flowcodeacademy.com.br/imgs/emptydark.png';
    }

    res.json({
      bin: cardInfo.BIN,
      bandeira: cardInfo.Brand,
      tipo: cardInfo.Type,
      imageLight,
      imageDark,
    });
  } else {
    // Se o bin não for encontrado, retorna as marcas padrão com base nos primeiros dígitos do BIN
    let defaultBrand;

    if (bin.startsWith('4')) {
      defaultBrand = 'VISA';
    } else if (bin.startsWith('5')) {
      defaultBrand = 'MASTERCARD';
    } else if (bin.startsWith('6')) {
      defaultBrand = 'DISCOVER';
    } else if (bin.startsWith('3')) {
      defaultBrand = 'AMERICAN EXPRESS';
    } else {
      defaultBrand = 'VISA'; // Caso não corresponda a nenhum padrão, retorna VISA como padrão
    }

    res.json({
      bin,
      bandeira: defaultBrand,
      tipo: 'Desconhecido',
      imageLight: `https://apis.flowcodeacademy.com.br/imgs/${defaultBrand.toLowerCase()}.png`,
      imageDark: `https://apis.flowcodeacademy.com.br/imgs/${defaultBrand.toLowerCase()}dark.png`,
    });
  }
});

//começa aqui o codigo novo

app.use(express.json());

// Endpoint para criar um token
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
  const newToken = jwt.sign({ email, uniqueId: uuidv4() }, SECRET_KEY);

  // Salva o novo token e seu email nos dados
  tokensData[email] = newToken;

  // Salva os dados atualizados no arquivo
  await saveTokensData();

  res.json({ token: newToken });
});

// Endpoint para excluir um token
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

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
