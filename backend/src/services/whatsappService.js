const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { supabase } = require('../config/database');
const aiService = require('./aiService');

// Multi-tenant session state maps keying on workspaceId
const sockets = new Map(); // workspaceId -> sock
const connectionStatuses = new Map(); // workspaceId -> status
const qrCodeDatas = new Map(); // workspaceId -> qrCodeData
const connectedUsers = new Map(); // workspaceId -> connectedUser
const reconnectAttemptsMap = new Map(); // workspaceId -> attemptsCount

const SESSION_DIR = path.join(__dirname, '../../whatsapp_auth_info');

// Cache to store the unique IDs of messages sent by our bot to prevent message loops
const sentMessageIds = new Set();

// Active debounce timers per customer JID to prevent double-responses on consecutive messages
const activeDebounceTimers = new Map();

// Lock set to prevent concurrent AI processing for the same customer
const processingLocks = new Set();

/**
 * Migration: Move legacy single session files into the default workspace folder
 */
const migrateLegacySession = () => {
  const defaultWpId = '11111111-1111-1111-1111-111111111111';
  const targetDir = path.join(SESSION_DIR, defaultWpId);
  const legacyCredsPath = path.join(SESSION_DIR, 'creds.json');

  if (fs.existsSync(legacyCredsPath)) {
    console.log('[WhatsApp Service] Migrating legacy session credentials to default workspace folder...');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const files = fs.readdirSync(SESSION_DIR);
    for (const file of files) {
      const sourcePath = path.join(SESSION_DIR, file);
      // Move only files to avoid moving the targetDir inside itself recursively
      if (fs.statSync(sourcePath).isFile()) {
        const destPath = path.join(targetDir, file);
        fs.renameSync(sourcePath, destPath);
      }
    }
    console.log('[WhatsApp Service] Legacy credentials migrated successfully!');
  }
};

// Auto-run migration at start
migrateLegacySession();

/**
 * Resolves a customer record in the database by phone number in a robust way
 */
const findCustomerByPhone = async (workspaceId, rawPhone) => {
  try {
    const digits = rawPhone.replace(/\D/g, '');
    if (!digits) return null;

    const possibleNumbers = [digits, `+${digits}`];
    
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      const ddd = digits.slice(2, 4);
      const rest = digits.slice(4);
      
      if (digits.length === 13 && rest.startsWith('9')) {
        const withoutNine = '55' + ddd + rest.slice(1);
        possibleNumbers.push(withoutNine, `+${withoutNine}`);
      } else if (digits.length === 12) {
        const withNine = '55' + ddd + '9' + rest;
        possibleNumbers.push(withNine, `+${withNine}`);
      }
    }

    const orConditions = [];
    possibleNumbers.forEach(num => {
      orConditions.push(`phone.eq.${num}`, `whatsapp.eq.${num}`);
    });

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, metadata')
      .eq('workspace_id', workspaceId)
      .or(orConditions.join(','))
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[WhatsApp Service] Error finding customer by phone:', error.message);
    }
    return data;
  } catch (err) {
    console.error('[WhatsApp Service] Unexpected error in findCustomerByPhone:', err.message);
    return null;
  }
};

/**
 * Initializes and starts a real WhatsApp connection socket for a specific workspace
 */
const connectToWhatsApp = async (workspaceId) => {
  try {
    if (!workspaceId) {
      console.warn('[WhatsApp Service] Cannot connect to WhatsApp: workspaceId is missing.');
      return;
    }

    const activeSock = sockets.get(workspaceId);
    if (activeSock && (currentStatus === 'connected' || currentStatus === 'connecting')) {
      console.log(`[WhatsApp Service] Workspace ${workspaceId} already has an active socket. Skipping init.`);
      return;
    }

    console.log(`[WhatsApp Service] Initializing WhatsApp connection for Workspace ${workspaceId}...`);
    connectionStatuses.set(workspaceId, 'connecting');
    qrCodeDatas.set(workspaceId, null);

    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    const workspaceSessionDir = path.join(SESSION_DIR, workspaceId);

    // 1. Load multi-file auth credentials
    const { state, saveCreds } = await useMultiFileAuthState(workspaceSessionDir);

    // 2. Initialize WASocket using Baileys default stable version and standard browser agent
    // to guarantee 100% stable connections, avoiding 405 Method Not Allowed error, and 
    // ensuring the QR displayed on screen is in perfect sync with WhatsApp's servers.
    const sock = makeWASocket({
      auth: state,
      browser: ['Windows', 'Chrome', '10.0.19045'], // Highly compatible standard browser option
      printQRInTerminal: false,
      defaultQueryTimeoutMs: undefined
    });

    sockets.set(workspaceId, sock);

    // 3. Listen to connection updates
    sock.ev.on('connection.update', async (update) => {
      // Avoid race conditions: if this socket is no longer the active one for the workspace, ignore!
      if (sockets.get(workspaceId) !== sock) {
        console.log(`[WhatsApp Service] Ignoring connection.update for old/inactive socket of Workspace ${workspaceId}`);
        return;
      }
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[WhatsApp Service] New QR Code generated for Workspace ${workspaceId}!`);
        try {
          const qrDataUrl = await qrcode.toDataURL(qr);
          qrCodeDatas.set(workspaceId, qrDataUrl);
        } catch (err) {
          console.error(`[WhatsApp Service] Failed to convert QR code to base64 Data URL for Workspace ${workspaceId}:`, err);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : null;

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const shouldReconnect = !isLoggedOut;

        console.log(`[WhatsApp Service] Connection closed for Workspace ${workspaceId}. Code: ${statusCode || 'unknown'}. Reconnect: ${shouldReconnect}`);

        // Remove from active sockets map since this socket is now dead
        if (sockets.get(workspaceId) === sock) {
          sockets.delete(workspaceId);
        }

        connectedUsers.set(workspaceId, null);

        if (shouldReconnect) {
          const attempts = (reconnectAttemptsMap.get(workspaceId) || 0) + 1;
          reconnectAttemptsMap.set(workspaceId, attempts);

          if (attempts <= 8) {
            // Keep status as 'connecting' so the UI keeps showing the QR panel
            connectionStatuses.set(workspaceId, 'connecting');
            // Preserve the current QR code so it stays visible during reconnect.
            // Baileys will emit a new 'qr' event with a fresh QR when it's ready,
            // which will overwrite this. We only clear if QR was never set.
            const currentQr = qrCodeDatas.get(workspaceId);
            if (!currentQr) {
              qrCodeDatas.set(workspaceId, null); // already null, no-op
            }
            // (if currentQr is set, keep it so user still sees it)

            const delay = attempts <= 3 ? 2000 : 5000;
            console.log(`[WhatsApp Service] Reconnecting Workspace ${workspaceId} attempt #${attempts} in ${delay}ms...`);
            setTimeout(() => connectToWhatsApp(workspaceId), delay);
          } else {
            console.warn(`[WhatsApp Service] Max reconnect attempts reached for Workspace ${workspaceId}. Giving up.`);
            connectionStatuses.set(workspaceId, 'disconnected');
            qrCodeDatas.set(workspaceId, null);
          }
        } else {
          console.log(`[WhatsApp Service] Logged out from WhatsApp for Workspace ${workspaceId}. Clearing session...`);
          connectionStatuses.set(workspaceId, 'disconnected');
          qrCodeDatas.set(workspaceId, null);
          clearSession(workspaceId);
        }
      } else if (connection === 'open') {
        console.log(`[WhatsApp Service] WhatsApp connection successfully established for Workspace ${workspaceId}! 🎉`);
        connectionStatuses.set(workspaceId, 'connected');
        qrCodeDatas.set(workspaceId, null);
        reconnectAttemptsMap.set(workspaceId, 0);
        connectedUsers.set(workspaceId, sock.user);
      }
    });

    // 4. Save credentials state changes
    sock.ev.on('creds.update', () => {
      if (sockets.get(workspaceId) !== sock) return;
      saveCreds();
    });

    // 5. Handle incoming messages in real-time (isolated in closure per workspaceId)
    sock.ev.on('messages.upsert', async (m) => {
      if (sockets.get(workspaceId) !== sock) return;
      try {
        if (m.type !== 'notify') {
          return;
        }

        console.log(`[WhatsApp Service - Workspace ${workspaceId}] Received messages.upsert event:`, JSON.stringify(m, null, 2));
        const msg = m.messages[0];
        if (!msg) return;

        const jid = msg.key.remoteJid;
        if (!jid || (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid'))) {
          console.log(`[WhatsApp Service - Workspace ${workspaceId}] Skipping non-user JID: ${jid}`);
          return;
        }

        const textBody = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || 
                         msg.message?.imageMessage?.caption || 
                         msg.message?.videoMessage?.caption || 
                         '';

        let isMedia = false;
        let contentText = textBody;
        if (!contentText) {
          isMedia = true;
          if (msg.message?.audioMessage) {
            contentText = '[Áudio]';
          } else if (msg.message?.imageMessage) {
            contentText = '[Imagem]';
          } else if (msg.message?.videoMessage) {
            contentText = '[Vídeo]';
          } else if (msg.message?.stickerMessage) {
            contentText = '[Sticker]';
          } else if (msg.message?.documentMessage) {
            contentText = '[Documento]';
          } else if (msg.message?.contactMessage || msg.message?.contactsArrayMessage) {
            contentText = '[Contato]';
          } else if (msg.message?.locationMessage) {
            contentText = '[Localização]';
          } else {
            // Ignore system messages, protocol messages, or other unsupported types
            console.log(`[WhatsApp Service - Workspace ${workspaceId}] Skipping unsupported empty message protocol type.`);
            return;
          }
        }

        if (msg.key.id && sentMessageIds.has(msg.key.id)) {
          console.log(`[WhatsApp Service - Workspace ${workspaceId}] Skipping message ${msg.key.id} because it was sent by our system.`);
          return;
        }

        let customerPhone = jid.split('@')[0];
        if (jid.endsWith('@lid') && msg.key.remoteJidAlt && msg.key.remoteJidAlt.endsWith('@s.whatsapp.net')) {
          customerPhone = msg.key.remoteJidAlt.split('@')[0];
        }

        const selfJid = sock.user?.id ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : null;
        const selfLid = sock.user?.id ? (sock.user.id.split(':')[0] + '@lid') : null;
        const isSelfChat = (selfJid && (jid === selfJid || jid === sock.user.id)) || (selfLid && jid === selfLid);

        // A. Get or Create Customer in database under this specific workspaceId
        let customer = await findCustomerByPhone(workspaceId, customerPhone);

        if (!customer) {
          const isOutbound = msg.key.fromMe && !isSelfChat;
          const defaultName = `WhatsApp User (${customerPhone.slice(-4)})`;
          const customerName = isSelfChat
            ? 'Você (WhatsApp)'
            : (isOutbound ? defaultName : (msg.pushName || defaultName));

          const { data: newCustomer } = await supabase
            .from('customers')
            .insert({
              workspace_id: workspaceId,
              name: customerName,
              phone: customerPhone,
              whatsapp: customerPhone,
              tags: isSelfChat ? ['self-chat'] : ['whatsapp-web'],
              metadata: {}
            })
            .select()
            .single();
          customer = newCustomer;
          console.log(`[WhatsApp Service - Workspace ${workspaceId}] Created new customer entry: ${customer.id}`);
        }

        // B. Get or Create Conversation thread (look for ACTIVE ones under this workspaceId)
        let { data: conversation } = await supabase
          .from('conversations')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('customer_id', customer.id)
          .eq('channel', 'whatsapp')
          .eq('status', 'active')
          .maybeSingle();

        if (!conversation) {
          const { data: newConversation } = await supabase
            .from('conversations')
            .insert({
              workspace_id: workspaceId,
              customer_id: customer.id,
              channel: 'whatsapp',
              status: 'active',
              sentiment_score: 0.5,
              last_message_at: new Date()
            })
            .select()
            .single();
          conversation = newConversation;
          console.log(`[WhatsApp Service - Workspace ${workspaceId}] Started new conversation thread: ${conversation.id}`);
        }

        // Check if the message is outbound (sent by agent/admin from physical phone)
        if (msg.key.fromMe && !isSelfChat) {
          console.log(`[WhatsApp Service - Workspace ${workspaceId}] Logging outbound message from phone to customer [${customerPhone}]: "${contentText}"`);
          
          await supabase.from('messages').insert({
            conversation_id: conversation.id,
            sender_type: 'agent',
            content: contentText
          });

          // Reply from physical phone (mobile) -> pause AI for 6 hours (360 minutes)
          const pauseDuration = 360;
          const pausedUntil = new Date(Date.now() + pauseDuration * 60 * 1000);
          console.log(`[WhatsApp Service - Workspace ${workspaceId}] Customer thread [${customerPhone}] PAUSED until ${pausedUntil.toISOString()} due to manual outbound message from physical phone.`);

          const currentMetadata = customer.metadata || {};
          const updatedMetadata = { ...currentMetadata, ai_paused_until: pausedUntil.toISOString() };

          await supabase
            .from('customers')
            .update({ metadata: updatedMetadata })
            .eq('id', customer.id);

          await supabase
            .from('conversations')
            .update({ last_message_at: new Date() })
            .eq('id', conversation.id);
            
          return;
        }

        // Save physical inbound message to DB first
        console.log(`[WhatsApp Service - Workspace ${workspaceId}] Logging inbound message from [${customerPhone}]: "${contentText}"`);
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          sender_type: 'customer',
          content: contentText
        });

        // If it's an inbound media message, we do not trigger AI (AI cannot process media, and human will handle it)
        if (isMedia) {
          console.log(`[WhatsApp Service - Workspace ${workspaceId}] Inbound message is media (${contentText}), skipping AI agent response generation.`);
          
          await supabase
            .from('conversations')
            .update({ last_message_at: new Date() })
            .eq('id', conversation.id);
            
          return;
        }

        // Trigger background automation workflow
        try {
          const automationService = require('./automationService');
          automationService.trigger('messages.incoming', {
            message: {
              content: textBody,
              sender_type: 'customer',
              channel: 'whatsapp'
            },
            customer: {
              id: customer.id,
              name: customer.name,
              phone: customerPhone
            },
            conversation_id: conversation.id
          }, workspaceId);
        } catch (autoErr) {
          console.error(`[WhatsApp Service - Workspace ${workspaceId}] Automation trigger error:`, autoErr.message);
        }

        await supabase
          .from('conversations')
          .update({ last_message_at: new Date() })
          .eq('id', conversation.id);

        const debounceKey = `${workspaceId}_${jid}`;

        // Debounce logic: Clear any active response timer for this customer
        if (activeDebounceTimers.has(debounceKey)) {
          clearTimeout(activeDebounceTimers.get(debounceKey));
          activeDebounceTimers.delete(debounceKey);
        }

        let isFirstMessage = true;
        try {
          const { count, error: countErr } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversation.id);
            
          if (!countErr && count !== null) {
            isFirstMessage = (count <= 1);
          }
        } catch (err) {
          console.error(`[WhatsApp Service - Workspace ${workspaceId}] Error querying message count:`, err.message);
        }

        const debounceDelay = isFirstMessage ? 10000 : 4000;

        // Create a new timer to wait before answering
        const timer = setTimeout(async () => {
          try {
            activeDebounceTimers.delete(debounceKey);

            // Acquire processing lock — skip if another timer is already processing for this customer
            if (processingLocks.has(debounceKey)) {
              console.log(`[WhatsApp Service - Workspace ${workspaceId}] Skipping: AI is already processing for ${customerPhone}`);
              return;
            }
            processingLocks.add(debounceKey);

            console.log(`[WhatsApp Service - Workspace ${workspaceId}] Debounce timer fired. Generating AI reply for ${customerPhone}...`);

            const { data: latestCustomer } = await supabase
              .from('customers')
              .select('metadata, name')
              .eq('id', customer.id)
              .maybeSingle();

            const customerMetadata = latestCustomer?.metadata || {};
            const isAiDisabled = customerMetadata.is_ai_disabled === true;
            const isAiPaused = customerMetadata.ai_paused_until && new Date(customerMetadata.ai_paused_until) > new Date();

            if (isAiDisabled || isAiPaused) {
              console.log(`[WhatsApp Service - Workspace ${workspaceId}] Skipping AI reply: AI is ${isAiDisabled ? 'disabled' : 'paused'}.`);
              processingLocks.delete(debounceKey);
              return;
            }

            // Fetch the last AI message timestamp in this conversation
            const { data: lastAiMsg } = await supabase
              .from('messages')
              .select('created_at')
              .eq('conversation_id', conversation.id)
              .eq('sender_type', 'ai')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            // Fetch ALL customer messages since the last AI reply (or all if no AI reply yet)
            let customerMsgsQuery = supabase
              .from('messages')
              .select('content, created_at')
              .eq('conversation_id', conversation.id)
              .eq('sender_type', 'customer')
              .order('created_at', { ascending: true });

            if (lastAiMsg?.created_at) {
              customerMsgsQuery = customerMsgsQuery.gt('created_at', lastAiMsg.created_at);
            }

            const { data: pendingMessages } = await customerMsgsQuery;

            if (!pendingMessages || pendingMessages.length === 0) {
              console.log(`[WhatsApp Service - Workspace ${workspaceId}] No pending customer messages found for ${customerPhone}, skipping.`);
              processingLocks.delete(debounceKey);
              return;
            }

            // Consolidate all pending messages into a single text
            const consolidatedText = pendingMessages.map(m => m.content).join('\n');
            console.log(`[WhatsApp Service - Workspace ${workspaceId}] Consolidated ${pendingMessages.length} message(s) for AI: "${consolidatedText}"`);

            // G. Process via AI Agent pipeline
            const aiResult = await aiService.processIncomingMessage(consolidatedText, workspaceId, conversation.id, {
              id: customer.id,
              name: latestCustomer?.name || customer.name,
              phone: customerPhone
            });

            // H. Save AI outbound reply to DB
            await supabase.from('messages').insert({
              conversation_id: conversation.id,
              sender_type: 'ai',
              content: aiResult.reply,
              intent: aiResult.intent,
              sentiment: aiResult.sentiment,
              entities: aiResult.entities
            });

            // I. Send reply back to customer's WhatsApp JID
            console.log(`[WhatsApp Service - Workspace ${workspaceId}] Sending AI reply: "${aiResult.reply}" to ${jid}`);
            const sentMsg = await sock.sendMessage(jid, { text: aiResult.reply });

            if (sentMsg?.key?.id) {
              sentMessageIds.add(sentMsg.key.id);
              if (sentMessageIds.size > 1000) {
                const firstKey = sentMessageIds.values().next().value;
                sentMessageIds.delete(firstKey);
              }
            }

            // J. Update conversation metadata
            await supabase
              .from('conversations')
              .update({
                last_message_at: new Date(),
                sentiment_score: aiResult.sentiment
              })
              .eq('id', conversation.id);

            console.log(`[WhatsApp Service - Workspace ${workspaceId}] AI reply processed successfully for ${customerPhone}!`);
          } catch (timerErr) {
            console.error(`[WhatsApp Service - Workspace ${workspaceId}] Error in debounce timer:`, timerErr);
          } finally {
            processingLocks.delete(debounceKey);
          }
        }, debounceDelay);

        activeDebounceTimers.set(debounceKey, timer);

      } catch (err) {
        console.error(`[WhatsApp Service - Workspace ${workspaceId}] Error in messages.upsert handler:`, err);
      }
    });

  } catch (err) {
    console.error(`[WhatsApp Service] Connection init crash for Workspace ${workspaceId}:`, err);
    connectionStatuses.set(workspaceId, 'disconnected');
  }
};

/**
 * Sends an outbound text body directly to a JID phone number under a specific workspace
 */
const sendMessageJid = async (workspaceId, phone, textBody) => {
  if (!workspaceId) return false;
  const sock = sockets.get(workspaceId);
  const status = connectionStatuses.get(workspaceId);

  if (status !== 'connected' || !sock) {
    console.warn(`[WhatsApp Service] Socket is offline for Workspace ${workspaceId}, cannot send outbound message.`);
    return false;
  }

  try {
    const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    const sentMsg = await sock.sendMessage(jid, { text: textBody });
    
    if (sentMsg?.key?.id) {
      sentMessageIds.add(sentMsg.key.id);
      if (sentMessageIds.size > 1000) {
        const firstKey = sentMessageIds.values().next().value;
        sentMessageIds.delete(firstKey);
      }
    }
    
    return true;
  } catch (err) {
    console.error(`[WhatsApp Service] Outbound message failed for Workspace ${workspaceId}:`, err);
    return false;
  }
};

/**
 * Disconnects socket and clears authentication folders for a specific workspace
 */
const clearSession = (workspaceId) => {
  if (!workspaceId) return;
  try {
    const sock = sockets.get(workspaceId);
    if (sock) {
      sock.end();
      sockets.delete(workspaceId);
    }

    connectionStatuses.set(workspaceId, 'disconnected');
    qrCodeDatas.set(workspaceId, null);
    connectedUsers.set(workspaceId, null);

    const workspaceSessionDir = path.join(SESSION_DIR, workspaceId);
    if (fs.existsSync(workspaceSessionDir)) {
      console.log(`[WhatsApp Service] Deleting credentials session folder for Workspace ${workspaceId}...`);
      fs.rmSync(workspaceSessionDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`[WhatsApp Service] Clear Session Error for Workspace ${workspaceId}:`, err);
  }
};

/**
 * Fetches status for a specific workspace
 */
const getStatus = (workspaceId) => {
  if (!workspaceId) {
    return { status: 'disconnected', qrCode: null, user: null };
  }
  return {
    status: connectionStatuses.get(workspaceId) || 'disconnected',
    qrCode: qrCodeDatas.get(workspaceId) || null,
    user: connectedUsers.get(workspaceId) || null
  };
};

/**
 * Automatically scans the SESSION_DIR and starts connections for all existing workspaces
 */
const initAllSessions = async () => {
  try {
    if (!fs.existsSync(SESSION_DIR)) {
      return;
    }

    console.log('[WhatsApp Service] Scanning for existing multi-tenant session directories...');
    const files = fs.readdirSync(SESSION_DIR);
    for (const file of files) {
      const fullPath = path.join(SESSION_DIR, file);
      if (fs.statSync(fullPath).isDirectory()) {
        const workspaceId = file;
        console.log(`[WhatsApp Service] Found existing session directory for Workspace ${workspaceId}. Auto-connecting...`);
        connectToWhatsApp(workspaceId).catch(err => {
          console.error(`[WhatsApp Service] Error in auto-connecting Workspace ${workspaceId}:`, err.message);
        });
      }
    }
  } catch (err) {
    console.error('[WhatsApp Service] Error scanning existing sessions:', err.message);
  }
};

/**
 * Forces a fresh QR Code generation by clearing the existing session and reconnecting.
 * Use this when the user explicitly wants to scan a new QR code.
 */
const forceNewQrCode = async (workspaceId) => {
  if (!workspaceId) return;

  console.log(`[WhatsApp Service] Force-new QR requested for Workspace ${workspaceId}. Clearing existing session...`);

  // 1. Close existing socket if any
  const existingSock = sockets.get(workspaceId);
  if (existingSock) {
    try { existingSock.end(); } catch (_) {}
    sockets.delete(workspaceId);
  }

  // 2. Delete session files so Baileys generates a fresh QR
  const workspaceSessionDir = path.join(SESSION_DIR, workspaceId);
  if (fs.existsSync(workspaceSessionDir)) {
    fs.rmSync(workspaceSessionDir, { recursive: true, force: true });
    console.log(`[WhatsApp Service] Session directory cleared for Workspace ${workspaceId}.`);
  }

  // 3. Reset state maps
  connectionStatuses.set(workspaceId, 'disconnected');
  qrCodeDatas.set(workspaceId, null);
  connectedUsers.set(workspaceId, null);
  reconnectAttemptsMap.set(workspaceId, 0);

  // 4. Start fresh connection (will generate QR since no session files exist)
  await connectToWhatsApp(workspaceId);
};

module.exports = {
  connectToWhatsApp,
  forceNewQrCode,
  sendMessageJid,
  clearSession,
  getStatus,
  initAllSessions
};
