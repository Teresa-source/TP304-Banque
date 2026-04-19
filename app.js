const express = require('express');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
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
      description: 'Système de gestion de comptes et transactions bancaires.',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Serveur Local' },
    ],
  },
  apis: ['./app.js'], 
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

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
 *         description: Compte créé
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
 * /comptes/{id}:
 *   get:
 *     summary: Détails d'un compte
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Succès
 */
app.get('/comptes/:id', (req, res) => {
    const compte = comptes.find(c => c.id === parseInt(req.params.id));
    if (!compte) return res.status(404).json({ erreur: "Compte non trouvé." });
    res.json(compte);
});

/**
 * @swagger
 * /comptes/{id}/depot:
 *   post:
 *     summary: Faire un dépôt
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
    const compte = comptes.find(c => c.id === parseInt(req.params.id));
    if (!compte) return res.status(404).json({ erreur: "Compte non trouvé." });
    const { montant } = req.body;
    compte.solde += montant;
    res.json({ message: "Dépôt réussi", nouveauSolde: compte.solde });
});

/**
 * @swagger
 * /comptes/{id}/retrait:
 *   post:
 *     summary: Faire un retrait
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
 */
app.post('/comptes/:id/retrait', (req, res) => {
    const compte = comptes.find(c => c.id === parseInt(req.params.id));
    if (!compte) return res.status(404).json({ erreur: "Compte non trouvé." });
    const { montant } = req.body;
    if (compte.solde < montant) return res.status(400).json({ erreur: "Solde insuffisant" });
    compte.solde -= montant;
    res.json({ message: "Retrait réussi", nouveauSolde: compte.solde });
});

/**
 * @swagger
 * /comptes/{id}/transactions:
 *   get:
 *     summary: Historique des transactions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Succès
 */
app.get('/comptes/:id/transactions', (req, res) => {
    const historique = transactions.filter(t => t.compteId === parseInt(req.params.id));
    res.json(historique);
});

/**
 * @swagger
 * /comptes/{id}:
 *   delete:
 *     summary: Supprimer un compte
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Supprimé
 */
app.delete('/comptes/:id', (req, res) => {
    const index = comptes.findIndex(c => c.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ erreur: "Compte non trouvé." });
    if (comptes[index].solde > 0) return res.status(400).json({ erreur: "Solde non nul" });
    comptes.splice(index, 1);
    res.json({ message: "Compte supprimé" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🏦 Serveur lancé sur http://localhost:${PORT}`);
    console.log(`📖 Swagger : http://localhost:${PORT}/api-docs`);
});