const express = require('express');
const router = express.Router();
const Proposal = require('../models/Proposal');
const Vote = require('../models/Vote');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

router.use(authMiddleware);

/** List proposals. Resident: with approveCount/rejectCount only. Admin: with votes array (username, vote). */
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.role === 'Admin';
    const proposals = await Proposal.find({}).sort({ createdAt: -1 }).lean();
    const result = [];

    const currentUserId = req.userId || req.username;
    for (const p of proposals) {
      const votes = await Vote.find({ proposalId: p._id }).lean();
      const approveCount = votes.filter((v) => v.vote === 'approve').length;
      const rejectCount = votes.filter((v) => v.vote === 'reject').length;

      const item = {
        id: p._id.toString(),
        title: p.title,
        description: p.description || '',
        createdBy: p.createdBy,
        createdAt: p.createdAt,
        status: p.status || 'open',
        approveCount,
        rejectCount,
      };

      const userVote = votes.find((v) => v.userId === currentUserId);
      item.userVote = userVote ? userVote.vote : null;

      if (isAdmin) {
        item.votes = votes.map((v) => ({
          username: v.username,
          vote: v.vote,
          votedAt: v.createdAt,
        }));
      }

      result.push(item);
    }

    res.set('Cache-Control', 'no-store');
    res.json(result);
  } catch (err) {
    console.error('GET /api/proposals error:', err);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

/** Get one proposal (same role-based: resident = counts only, admin = with votes). */
router.get('/:id', async (req, res) => {
  try {
    const isAdmin = req.role === 'Admin';
    const proposal = await Proposal.findById(req.params.id).lean();
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const votes = await Vote.find({ proposalId: proposal._id }).lean();
    const approveCount = votes.filter((v) => v.vote === 'approve').length;
    const rejectCount = votes.filter((v) => v.vote === 'reject').length;

    const currentUserId = req.userId || req.username;
    const userVoteDoc = votes.find((v) => v.userId === currentUserId);

    const item = {
      id: proposal._id.toString(),
      title: proposal.title,
      description: proposal.description || '',
      createdBy: proposal.createdBy,
      createdAt: proposal.createdAt,
      status: proposal.status || 'open',
      approveCount,
      rejectCount,
      userVote: userVoteDoc ? userVoteDoc.vote : null,
    };

    if (isAdmin) {
      item.votes = votes.map((v) => ({
        username: v.username,
        vote: v.vote,
        votedAt: v.createdAt,
      }));
    }

    res.json(item);
  } catch (err) {
    console.error('GET /api/proposals/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

/** Create proposal (admin only). */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const title = (req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const proposal = await Proposal.create({
      title,
      description: (req.body?.description || '').trim(),
      createdBy: req.username || 'Admin',
      status: 'open',
    });

    res.status(201).json({
      id: proposal._id.toString(),
      title: proposal.title,
      description: proposal.description || '',
      createdBy: proposal.createdBy,
      createdAt: proposal.createdAt,
      status: proposal.status,
      approveCount: 0,
      rejectCount: 0,
      votes: [],
    });
  } catch (err) {
    console.error('POST /api/proposals error:', err);
    res.status(500).json({ error: 'Failed to create proposal' });
  }
});

/** Vote on proposal (approve or reject). One vote per user per proposal; cannot vote again. */
router.post('/:id/vote', async (req, res) => {
  try {
    const proposalId = req.params.id;
    const vote = req.body?.vote === 'reject' ? 'reject' : 'approve';

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status === 'closed') return res.status(400).json({ error: 'Voting is closed for this proposal' });

    const userId = req.userId || req.username;
    const existing = await Vote.findOne({ proposalId, userId });
    if (existing) {
      return res.status(409).json({
        error: 'You have already voted on this proposal.',
        code: 'ALREADY_VOTED',
        userVote: existing.vote,
      });
    }

    await Vote.create({
      proposalId,
      userId,
      username: req.username || 'User',
      vote,
    });

    const votes = await Vote.find({ proposalId }).lean();
    res.json({
      approveCount: votes.filter((v) => v.vote === 'approve').length,
      rejectCount: votes.filter((v) => v.vote === 'reject').length,
      userVote: vote,
    });
  } catch (err) {
    console.error('POST /api/proposals/:id/vote error:', err);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

/** Delete proposal (admin only). */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const proposal = await Proposal.findByIdAndDelete(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    await Vote.deleteMany({ proposalId: req.params.id });
    res.json({ id: req.params.id });
  } catch (err) {
    console.error('DELETE /api/proposals/:id error:', err);
    res.status(500).json({ error: 'Failed to delete proposal' });
  }
});

/** Close/reopen proposal (admin only). */
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const status = req.body?.status === 'closed' ? 'closed' : 'open';
    const proposal = await Proposal.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ id: proposal._id.toString(), status });
  } catch (err) {
    console.error('PATCH /api/proposals/:id error:', err);
    res.status(500).json({ error: 'Failed to update proposal' });
  }
});

module.exports = router;
