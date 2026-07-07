const { prisma } = require('../lib/prisma');
const { ALLOWED_QUERY_TYPES } = require('../utils/user_query_email');
const { mapUserQueryToApi } = require('../utils/user_query');

const MAX_EXPLANATION_LENGTH = 5000;

async function submitUserQuery(req, res) {
  try {
    const userRole = String(req.user?.role || '').trim().toLowerCase();
    if (userRole === 'siteadmin') {
      return res.status(403).json({
        success: false,
        message: 'Site admins cannot submit user queries from this form',
      });
    }

    const typeOfQuery = String(req.body?.type_of_query || '').trim();
    const explanation = String(req.body?.explanation || '').trim();
    const userEmailId = String(req.user?.email_id || req.user?.emailId || '').trim();

    if (!userEmailId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!ALLOWED_QUERY_TYPES.has(typeOfQuery)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query type. Allowed values: Website Issue, Suggestion',
      });
    }

    if (!explanation) {
      return res.status(400).json({
        success: false,
        message: 'Please describe your issue or suggestion',
      });
    }

    if (explanation.length > MAX_EXPLANATION_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Explanation must be ${MAX_EXPLANATION_LENGTH} characters or fewer`,
      });
    }

    const created = await prisma.userQuery.create({
      data: {
        typeOfQuery,
        explanation,
        userEmailId,
        reviewed: false,
        mailSentToAdmin: false,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Your query has been submitted successfully',
      data: mapUserQueryToApi(created),
    });
  } catch (error) {
    console.error('Submit user query error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit user query',
    });
  }
}

async function getUserQueries(req, res) {
  try {
    const rows = await prisma.userQuery.findMany({
      orderBy: [
        { submittedOn: 'desc' },
        { id: 'desc' },
      ],
    });

    return res.status(200).json({
      success: true,
      data: rows.map(mapUserQueryToApi),
    });
  } catch (error) {
    console.error('Get user queries error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user queries',
    });
  }
}

async function markUserQueryReviewed(req, res) {
  try {
    const queryId = Number(req.params.id);
    if (!Number.isInteger(queryId) || queryId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query id',
      });
    }

    const reviewed = req.body?.reviewed !== false;

    const existing = await prisma.userQuery.findUnique({
      where: { id: queryId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'User query not found',
      });
    }

    const updated = await prisma.userQuery.update({
      where: { id: queryId },
      data: {
        reviewed,
        reviewedOn: reviewed ? new Date() : null,
      },
    });

    return res.status(200).json({
      success: true,
      message: reviewed ? 'Query marked as reviewed' : 'Query marked as pending review',
      data: mapUserQueryToApi(updated),
    });
  } catch (error) {
    console.error('Mark user query reviewed error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user query',
    });
  }
}

module.exports = {
  submitUserQuery,
  getUserQueries,
  markUserQueryReviewed,
};
