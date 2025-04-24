const express = require('express');
const router = express.Router();
const path = require('path');

module.exports = (db) => {
  // Rota para exibir a página inicial
  router.get('/home', (req, res) => {
    console.log('Sessão do usuário:', req.session.user); // Log para depuração
    if (!req.session.user) {
      console.error('Usuário não autenticado ao acessar /home');
      return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'views', 'home.html'));
    
    res.sendFile(path.join(__dirname, 'views', 'usuarios-online.html'));
   
  });

  return router;
};