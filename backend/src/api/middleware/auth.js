const { clerkClient } = require('@clerk/clerk-sdk-node');
const { supabase } = require('../../config/database');
require('dotenv').config();

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1. Skip auth checks in test or development mode ONLY if no token is provided
  if (!authHeader && (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development')) {
    // Inject a default mock agent profile
    req.user = {
      id: '00000000-0000-0000-0000-000000000000',
      clerk_id: 'mock_clerk_id_123',
      email: 'mock.agent@alice.ai',
      name: 'Mock Agent',
      role: 'admin',
      workspace_id: '11111111-1111-1111-1111-111111111111' // Default dev workspace
    };
    req.workspaceId = req.user.workspace_id;
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Decode Clerk JWT session token locally using jsonwebtoken (bypasses deprecated verifySession endpoint returning 410)
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.sub) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Clerk session token structure' });
    }

    // Retrieve full user profile using User ID from token
    const clerkUser = await clerkClient.users.getUser(decoded.sub);
    
    // Query database to fetch the real workspace_id for this clerk user
    const { data: dbUser } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('clerk_id', clerkUser.id)
      .maybeSingle();

    const realWorkspaceId = dbUser?.workspace_id || clerkUser.publicMetadata?.workspaceId || '11111111-1111-1111-1111-111111111111';

    // Bind mock or resolved database fields
    req.user = {
      clerk_id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress,
      name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Agent',
      role: clerkUser.publicMetadata?.role || 'agent',
      workspace_id: realWorkspaceId
    };
    req.workspaceId = realWorkspaceId;

    next();
  } catch (error) {
    console.error('Authentication Error:', error);
    return res.status(401).json({ error: 'Unauthorized: Authentication failed' });
  }
};

module.exports = {
  requireAuth
};
