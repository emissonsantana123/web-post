const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // Rota para buscar o perfil do usuário logado
  router.get('/get-profile', (req, res) => {
    if (!req.session.user) return res.status(401).send('Usuário não autenticado.');
    db.get('SELECT name, photo FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
      if (err) return res.status(500).send('Erro ao buscar perfil.');
      if (!user) return res.status(404).send('Usuário não encontrado.');
      res.json(user);
    });
  });

  return router;
};