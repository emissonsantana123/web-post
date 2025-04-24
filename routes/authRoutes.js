const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const multer = require('multer');
const fs = require('fs'); // Módulo para manipulação de arquivos
const router = express.Router();

// Verifica e cria a pasta 'public/uploads' se não existir
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Pasta "uploads" criada com sucesso.');
}

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Pasta onde as fotos serão armazenadas
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Nome único para o arquivo
  }
});

// Função para validar se o arquivo é uma imagem
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true); // Aceita o arquivo
  } else {
    cb(new Error('Somente imagens são permitidas'), false); // Rejeita o arquivo
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

module.exports = (db) => {
  // Rota para exibir o formulário de login
  router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/login.html'));
  });

  // Rota para processar o login
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err || !user) {
        return res.send('<script>alert("Email ou senha incorretos!"); window.location="/";</script>');
      }
      try {
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
          return res.send('<script>alert("Email ou senha incorretos!"); window.location="/";</script>');
        }
        req.session.user = user;
        res.redirect('/home');
      } catch (error) {
        res.status(500).send('<script>alert("Erro ao verificar senha!"); window.location="/";</script>');
      }
    });
  });

  // Rota para exibir o formulário de registro
  router.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/register.html'));
  });

  // Rota para processar o registro
  router.post('/register', upload.single('photo'), async (req, res) => {
    console.log('Dados recebidos no backend:', req.body); // Log dos dados recebidos
    const { name, email, password, confirm_password, recovery_key } = req.body;

    // Validação dos campos
    if (!name || !email || !password || !confirm_password || !recovery_key) {
      console.error('Dados inválidos para registro:', { name, email, password, confirm_password, recovery_key });
      return res.status(400).send('<script>alert("Todos os campos são obrigatórios!"); window.location="/register";</script>');
    }

    if (password !== confirm_password) {
      console.error('Senhas não coincidem:', { password, confirm_password });
      return res.status(400).send('<script>alert("As senhas não coincidem!"); window.location="/register";</script>');
    }

    try {
      // Verifica se o email já existe no banco de dados
      db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
          console.error('Erro ao verificar email:', err);
          return res.status(500).send('<script>alert("Erro interno ao verificar email!"); window.location="/register";</script>');
        }
        if (user) {
          return res.status(400).send('<script>alert("Email já cadastrado!"); window.location="/register";</script>');
        }

        // Criptografa a senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Salva o caminho da foto (se houver)
        const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

        // Insere o usuário no banco de dados
        db.run(
          'INSERT INTO users (name, email, password, photo, recovery_key) VALUES (?, ?, ?, ?, ?)',
          [name, email, hashedPassword, photoPath, recovery_key],
          (err) => {
            if (err) {
              console.error('Erro ao registrar usuário:', err);
              return res.status(500).send('<script>alert("Erro ao registrar usuário!"); window.location="/register";</script>');
            }
            res.send('<script>alert("Usuário registrado com sucesso!"); window.location="/";</script>');
          }
        );
      });
    } catch (error) {
      console.error('Erro ao criptografar senha:', error);
      res.status(500).send('<script>alert("Erro interno ao registrar usuário!"); window.location="/register";</script>');
    }
  });

  // Rota para fazer logout
  router.get('/logout', (req, res) => {
    if (req.session.user) {
      console.log(`Usuário ${req.session.user.id} fez logout.`);
      req.session.destroy((err) => {
        if (err) {
          console.error('Erro ao destruir a sessão:', err);
          return res.status(500).send('<script>alert("Erro ao fazer logout!"); window.location="/";</script>');
        }
        res.clearCookie('connect.sid'); // Limpa o cookie da sessão
        res.redirect('/');
      });
    } else {
      res.redirect('/');
    }
  });

  return router;
};