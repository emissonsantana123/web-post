const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');


// Inicialização do Express
const app = express();
const PORT = 3000;

// Configuração do SQLite
const db = new sqlite3.Database('./database.db');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.get('/get-profile', (req, res) => {
  console.log('Sessão do usuário:', req.session.user); // Log para depuração
  if (!req.session.user) {
    console.error('Usuário não autenticado ao acessar /get-profile');
    return res.status(401).send('Usuário não autenticado.');
  }
  db.get('SELECT name, photo FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
    if (err) {
      console.error('Erro ao buscar perfil:', err);
      return res.status(500).send('Erro ao buscar perfil.');
    }
    if (!user) {
      console.error('Usuário não encontrado no banco de dados.');
      return res.status(404).send('Usuário não encontrado.');
    }
    res.json(user);
  });
});
// Conjunto para rastrear usuários online
const activeUsers = new Set();

// Criação do servidor HTTP e Socket.IO
const server = http.createServer(app);
const io = new Server(server);

// Middleware para adicionar/remover usuários online
app.use((req, res, next) => {
  if (req.session.user) {
    activeUsers.add(req.session.user.id);
    console.log(`Usuário ${req.session.user.id} adicionado ao conjunto de usuários online.`);
    io.emit('update-active-users');
  }
  next();
});

// Criar tabelas no banco de dados
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      photo TEXT,
      recovery_key TEXT
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela users:', err);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela posts:', err);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela comments:', err);
  });
});

// Importar as rotas modulares
const authRoutes = require('./routes/authRoutes')(db);
const postRoutes = require('./routes/postRoutes')(db);
const commentRoutes = require('./routes/commentRoutes')(db);
const userRoutes = require('./routes/userRoutes')(db);
const recoveryRoutes = require('./routes/recoveryRoutes')(db);

// Usar as rotas modulares
app.use('/', authRoutes);
app.use('/posts', postRoutes);
app.use('/comments', commentRoutes);
app.use('/profile', userRoutes);
app.use('/recovery', recoveryRoutes);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Rota padrão
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/home', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});
app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'forgot-password.html'));
});
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'reset-password.html'));
});

// Rota GET para carregar a página de recuperação de senha
app.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar usuário.' });
    }

    if (!user) {
      return res.status(400).json({ error: 'Email não encontrado.' });
    }

    res.status(200).json({ message: 'Email encontrado. Prossiga para a próxima etapa.' });
  });
});

// Rota GET para carregar a página de verificação da pergunta de segurança
app.get('/verify-security-question', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'verify-security-question.html'));
});

// Rota POST para verificar a resposta da pergunta de segurança
app.post('/verify-security-question', (req, res) => {
  const { email, securityAnswer } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar usuário.' });
    }

    if (!user) {
      return res.status(400).json({ error: 'Email não encontrado.' });
    }

    if (user.recovery_key !== securityAnswer) {
      return res.status(400).json({ error: 'Resposta incorreta.' });
    }

    const token = Math.random().toString(36).substring(2, 15); // Simula um token
    res.status(200).json({ token });
  });
});

// Rota GET para carregar a página de redefinição de senha
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'reset-password.html'));
});
// Rota POST para redefinir a senha
app.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;

  // Validação dos dados recebidos
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
  }

  // Simulação de validação do token (você pode armazenar tokens no banco de dados)
  db.get('SELECT * FROM users WHERE reset_token = ?', [token], (err, user) => {
    if (err) {
      console.error('Erro ao buscar usuário pelo token:', err);
      return res.status(500).json({ error: 'Erro ao processar sua solicitação.' });
    }

    if (!user) {
      return res.status(400).json({ error: 'Token inválido ou expirado.' });
    }

    // Atualiza a senha do usuário no banco de dados
    db.run('UPDATE users SET password = ?, reset_token = NULL WHERE id = ?', [newPassword, user.id], (err) => {
      if (err) {
        console.error('Erro ao atualizar senha:', err);
        return res.status(500).json({ error: 'Erro ao redefinir senha.' });
      }

      res.status(200).json({ message: 'Senha redefinida com sucesso!' });
    });
  });
});
//cria post
app.post('/create-post', multer().single('image'), (req, res) => {
  const { content } = req.body;
  const image = req.file ? req.file.buffer.toString('base64') : null;
  db.run('INSERT INTO posts (user_id, content, image) VALUES (?, ?, ?)', [req.session.user.id, content, image], (err) => {
    if (err) return res.status(500).send('Erro ao criar postagem.');
    io.emit('new-post');
    res.status(200).send('Postagem criada com sucesso.');
  });
});
app.get('/get-posts', (req, res) => {
  db.all(`
    SELECT posts.*, users.name AS username, users.photo AS userphoto
    FROM posts
    JOIN users ON posts.user_id = users.id
    ORDER BY posts.created_at DESC
  `, [], (err, posts) => {
    if (err) {
      console.error('Erro ao executar consulta SQL:', err); // Log de depuração
      return res.status(500).send('Erro ao buscar postagens.');
    }
    console.log('Postagens encontradas:', posts); // Log de depuração
    res.json(posts);
  });
});


//processo de criação ou recuperação de comentários
app.post('/create-comment', (req, res) => {
  console.log('Dados recebidos no backend:', req.body); // Log dos dados recebidos
  const { postId, content } = req.body;
  if (!postId || !content) {
    console.error('Dados inválidos para criar comentário:', { postId, content });
    return res.status(400).send('Dados inválidos para criar comentário.');
  }
  if (!req.session.user) {
    console.error('Usuário não autenticado ao tentar criar comentário.');
    return res.status(401).send('Usuário não autenticado.');
  }
  db.run(
    'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
    [postId, req.session.user.id, content],
    (err) => {
      if (err) {
        console.error('Erro ao inserir comentário no banco de dados:', err);
        return res.status(500).send('Erro ao criar comentário.');
      }
      res.status(200).send('Comentário criado com sucesso.');
    }
  );
});


//rota de postagens
app.get('/get-comments/:postId', (req, res) => {
  const { postId } = req.params;
  if (!Number.isInteger(Number(postId))) {
    return res.status(400).send('ID de postagem inválido.');
  }
  db.all(`
    SELECT comments.*, users.name AS username, users.photo AS userphoto
    FROM comments
    JOIN users ON comments.user_id = users.id
    WHERE comments.post_id = ?
    ORDER BY comments.created_at DESC
  `, [postId], (err, comments) => {
    if (err) return res.status(500).send('Erro ao buscar comentários.');
    res.json(comments);
  });
});
// Middleware para lidar com rotas não encontradas
app.use((req, res) => {
  console.error(`Rota não encontrada: ${req.method} ${req.url}`);
  res.status(404).send('<h1>Página não encontrada</h1>');
});


// Inicialização do servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});