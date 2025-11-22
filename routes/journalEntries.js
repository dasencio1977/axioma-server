const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
    getJournalEntries,
    createJournalEntry,
    getJournalEntryById,
    updateJournalEntry
} = require('../controllers/journalEntryController');

router.use(authMiddleware);

router.route('/')
    .get(getJournalEntries)
    .post(createJournalEntry);

router.route('/:id')
    .get(getJournalEntryById)
    .put(updateJournalEntry);

module.exports = router;