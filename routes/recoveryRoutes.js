const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // Rota para exibir o formulário de recuperação de senha
  router.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/forgot-password.html'));
  });

  // Rota para verificar a resposta da pergunta de segurança
  router.post('/verify-security-question', (req, res) => {
    const { email, securityAnswer } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
      if (err || !user) {
        return res.status(400).send('<script>alert("Email não encontrado!"); window.location="/forgot-password";</script>');
      }
      if (user.recovery_key !== securityAnswer) {
        return res.status(400).send('<script>alert("Resposta incorreta!"); window.location="/forgot-password";</script>');
      }
      const resetToken = Math.random().toString(36).substring(2, 15);
      req.session.resetToken = resetToken;
      req.session.userIdForReset = user.id;
      res.redirect(`/reset-password?token=${resetToken}`);
    });
  });

  return router;
};