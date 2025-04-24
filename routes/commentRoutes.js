const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // Rota para buscar comentários de uma postagem
  router.get('/get-comments/:postId', (req, res) => {
    const { postId } = req.params;

    // Validação do postId
    if (!postId || isNaN(postId)) {
      console.error('ID de postagem inválido:', postId);
      return res.status(400).send('ID de postagem inválido.');
    }

    db.all(
      `
        SELECT comments.*, users.name AS username, users.photo AS userphoto
        FROM comments
        JOIN users ON comments.user_id = users.id
        WHERE comments.post_id = ?
        ORDER BY comments.created_at ASC
      `,
      [postId],
      (err, comments) => {
        if (err) {
          console.error('Erro ao buscar comentários:', err);
          return res.status(500).send('Erro ao buscar comentários.');
        }
        res.json(comments);
      }
    );
  });

  // Rota para criar um novo comentário
  router.post('/create-comment', (req, res) => {
    const { postId, content } = req.body;

    // Validação dos dados recebidos
    if (!postId || !content) {
      console.error('Dados inválidos para criar comentário:', { postId, content });
      return res.status(400).send('Dados inválidos para criar comentário.');
    }

    // Verifica se o usuário está autenticado
    if (!req.session || !req.session.user) {
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

  return router;
};