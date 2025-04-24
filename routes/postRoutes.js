const express = require('express');
const multer = require('multer');
const router = express.Router();

module.exports = (db) => {
  // Configuração do multer para upload de arquivos
  const storage = multer.memoryStorage(); // Armazena o arquivo na memória como buffer
  const upload = multer({ storage: storage });

  // Rota para buscar postagens
  router.get('/get-posts', (req, res) => {
    db.all(`
      SELECT posts.*, users.name AS username, users.photo AS userphoto
      FROM posts
      JOIN users ON posts.user_id = users.id
      ORDER BY posts.created_at DESC
    `, [], (err, posts) => {
      if (err) {
        console.error('Erro ao buscar postagens:', err);
        return res.status(500).send('Erro ao buscar postagens.');
      }
      res.json(posts);
    });
  });

  // Rota para criar uma nova postagem
  router.post('/create-post', upload.single('image'), (req, res) => {
    // Verifica se o usuário está autenticado
    if (!req.session.user) {
      return res.status(401).send('Usuário não autenticado.');
    }

    const { content } = req.body;
    const image = req.file ? req.file.buffer.toString('base64') : null;

    // Validação dos dados
    if (!content) {
      return res.status(400).send('O conteúdo da postagem é obrigatório.');
    }

    // Insere a postagem no banco de dados
    db.run(
      'INSERT INTO posts (user_id, content, image) VALUES (?, ?, ?)',
      [req.session.user.id, content, image],
      (err) => {
        if (err) {
          console.error('Erro ao criar postagem:', err);
          return res.status(500).send('Erro ao criar postagem.');
        }
        res.status(200).send('Postagem criada com sucesso.');
      }
    );
  });

  return router;
};