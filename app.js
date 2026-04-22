const express = require('express');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors'); // ← NOUVEAU

const app = express();

// ─────────────────────────────────────────
// CORS : doit être AVANT tout le reste
// ─────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ─────────────────────────────────────────
// Configuration Swagger
// ─────────────────────────────────────────
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'API Bancaire Teresa - ICT304',
      version: '1.0.0',
      description: 'Système de gestion de comptes avec tests de sécurité et audit.',
    },
    servers: [
      { url: 'https://api-bancaire-teresa.onrender.com', description: 'Serveur Production' },
      { url: 'http://localhost:3000', description: 'Serveur Local' },
    ],
    schemes: ['https', 'http'], // ← NOUVEAU
  },
  apis: ['./app.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// ← MODIFIÉ : ajout de validatorUrl: null pour désactiver le validateur externe
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
  swaggerOptions: {
    validatorUrl: null,
  }
}));

// ← NOUVEAU : expose le JSON brut (utile pour debug)
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocs);
});

// ─────────────────────────────────────────
// Base de données en mémoire
// ─────────────────────────────────────────
let comptes = [];
let transactions = [];

/**
 * @swagger
 * /comptes:
 *   post:
 *     summary: Créer un nouveau compte
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               titulaire:
 *                 type: string
 *               soldeInitial:
 *                 type: number
 *     responses:
 *       201:
 *         description: Compte créé avec succès
 */
app.post('/comptes', (req, res) => {
    const { titulaire, soldeInitial } = req.body;
    if (!titulaire || titulaire.trim() === '') {
        return res.status(400).json({ erreur: "Le champ 'titulaire' est obligatoire." });
    }
    const solde = soldeInitial || 0;
    const nouveauCompte = {
        id: comptes.length + 1,
        titulaire: titulaire.trim(),
        solde,
        creeLe: new Date().toISOString()
    };
    comptes.push(nouveauCompte);

    if (solde > 0) {
        transactions.push({
            id: transactions.length + 1,
            compteId: nouveauCompte.id,
            type: 'depot',
            montant: solde,
            soldeApres: solde,
            description: 'Dépôt initial',
            date: new Date().toISOString()
        });
    }
    res.status(201).json(nouveauCompte);
});

/**
 * @swagger
 * /comptes:
 *   get:
 *     summary: Liste tous les comptes
 *     responses:
 *       200:
 *         description: Succès
 */
app.get('/comptes', (req, res) => {
    res.json(comptes);
});

/**
 * @swagger
 * /comptes/{id}/depot:
 *   post:
 *     summary: Faire un dépôt (Test Positif)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               montant:
 *                 type: number
 *     responses:
 *       200:
 *         description: Dépôt réussi
 */
app.post('/comptes/:id/depot', (req, res) => {
    const id = parseInt(req.params.id);
    const { montant } = req.body;
    const compte = comptes.find(c => c.id === id);

    if (!compte) return res.status(404).json({ erreur: "Compte non trouvé." });
    if (!montant || montant <= 0) return res.status(400).json({ erreur: "Montant invalide." });

    compte.solde += montant;

    transactions.push({
        id: transactions.length + 1,
        compteId: id,
        type: 'depot',
        montant: montant,
        soldeApres: compte.solde,
        description: 'Dépôt manuel',
        date: new Date().toISOString()
    });

    res.json({ message: "Dépôt réussi", nouveauSolde: compte.solde });
});

/**
 * @swagger
 * /comptes/{id}/retrait:
 *   post:
 *     summary: Faire un retrait (Vérification de sécurité)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               montant:
 *                 type: number
 *     responses:
 *       200:
 *         description: Retrait réussi
 *       400:
 *         description: Solde insuffisant (Échec du test de sécurité)
 */
app.post('/comptes/:id/retrait', (req, res) => {
    const id = parseInt(req.params.id);
    const { montant } = req.body;
    const compte = comptes.find(c => c.id === id);

    if (!compte) return res.status(404).json({ erreur: "Compte non trouvé." });

    // SÉCURITÉ : Vérification du solde pour éviter le découvert
    if (compte.solde < montant) {
        return res.status(400).json({ erreur: "Solde insuffisant" });
    }

    compte.solde -= montant;

    transactions.push({
        id: transactions.length + 1,
        compteId: id,
        type: 'retrait',
        montant: montant,
        soldeApres: compte.solde,
        description: 'Retrait manuel',
        date: new Date().toISOString()
    });

    res.json({ message: "Retrait réussi", nouveauSolde: compte.solde });
});

/**
 * @swagger
 * /comptes/{id}/transactions:
 *   get:
 *     summary: Historique des transactions (Audit)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Liste des transactions trouvée
 */
app.get('/comptes/:id/transactions', (req, res) => {
    const historique = transactions.filter(t => t.compteId === parseInt(req.params.id));
    res.json(historique);
});

/**
 * @swagger
 * /comptes/{id}:
 *   delete:
 *     summary: Supprimer un compte (Solde doit être à 0)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Compte supprimé
 *       400:
 *         description: Impossible de supprimer un compte avec un solde positif
 */
app.delete('/comptes/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = comptes.findIndex(c => c.id === id);

    if (index === -1) return res.status(404).json({ erreur: "Compte non trouvé." });
    if (comptes[index].solde > 0) return res.status(400).json({ erreur: "Solde non nul. Videz le compte avant suppression." });

    comptes.splice(index, 1);
    res.json({ message: "Compte supprimé avec succès." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🏦 Serveur lancé sur le port ${PORT}`);
});