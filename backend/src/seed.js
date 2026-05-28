const { supabase } = require('./config/database');

async function seed() {
  console.log('🏁 Starting Supabase database seeding for Alice Platform...');

  try {
    // 1. Seed Workspace
    const workspaceId = '11111111-1111-1111-1111-111111111111';
    const { data: workspaceExists } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .single();

    if (!workspaceExists) {
      console.log('🌱 Inserting default workspace...');
      const { error: wsError } = await supabase
        .from('workspaces')
        .insert({
          id: workspaceId,
          name: 'Alice Workspace',
          slug: 'alice-workspace',
          settings: { theme: 'dark', language: 'pt-BR' }
        });
      if (wsError) throw wsError;
    } else {
      console.log('✅ Default workspace already exists.');
    }

    // 2. Seed Default User (Agent)
    const userId = '00000000-0000-0000-0000-000000000000';
    const { data: userExists } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!userExists) {
      console.log('🌱 Inserting default agent user...');
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          clerk_id: 'mock_clerk_id_123',
          email: 'mock.agent@alice.ai',
          name: 'Mock Agent',
          role: 'admin',
          workspace_id: workspaceId
        });
      if (userError) throw userError;
    } else {
      console.log('✅ Default agent user already exists.');
    }

    // 3. Seed Default Customer
    const customerId = '22222222-2222-2222-2222-222222222222';
    const { data: customerExists } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .single();

    if (!customerExists) {
      console.log('🌱 Inserting demo customer...');
      const { error: custError } = await supabase
        .from('customers')
        .insert({
          id: customerId,
          workspace_id: workspaceId,
          name: 'Alice Demo User',
          email: 'demo.user@gmail.com',
          phone: '+15556544094',
          whatsapp: '+15556544094',
          lifetime_value: 1250.00,
          tags: ['VIP', 'WhatsApp-Active']
        });
      if (custError) throw custError;
    } else {
      console.log('✅ Demo customer already exists.');
    }

    // 4. Seed Active Conversation Thread
    const conversationId = '33333333-3333-3333-3333-333333333333';
    const { data: convExists } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .single();

    if (!convExists) {
      console.log('🌱 Inserting active conversation thread...');
      const { error: convError } = await supabase
        .from('conversations')
        .insert({
          id: conversationId,
          workspace_id: workspaceId,
          customer_id: customerId,
          channel: 'whatsapp',
          status: 'active',
          assigned_to: userId,
          sentiment_score: 0.85
        });
      if (convError) throw convError;

      // 5. Seed Historical Messages
      console.log('🌱 Seeding historical messages...');
      const { error: msgError } = await supabase
        .from('messages')
        .insert([
          {
            conversation_id: conversationId,
            sender_type: 'customer',
            content: 'Olá! Como funciona a plataforma Alice?',
            intent: 'greeting',
            sentiment: 0.8
          },
          {
            conversation_id: conversationId,
            sender_type: 'ai',
            content: 'Olá! A Alice é uma plataforma inteligente que automatiza o seu atendimento conectando IA diretamente ao seu WhatsApp e CRM. Como posso te ajudar hoje?',
            intent: 'explain_platform',
            sentiment: 0.9
          }
        ]);
      if (msgError) throw msgError;
    } else {
      console.log('✅ Demo conversation and messages already exist.');
    }

    // 6. Seed Demo Products
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (productCount === 0) {
      console.log('🌱 Seeding demo products...');
      const { error: prodError } = await supabase
        .from('products')
        .insert([
          {
            workspace_id: workspaceId,
            name: 'Plano Premium Mensal',
            description: 'Acesso completo a todas as automações e IA ilimitada.',
            price: 199.00,
            stock: 9999,
            category: 'Assinatura',
            sku: 'PREM-SUB-M'
          },
          {
            workspace_id: workspaceId,
            name: 'Consultoria Personalizada',
            description: '1 hora de setup e desenvolvimento de automações dedicadas.',
            price: 350.00,
            stock: 45,
            category: 'Serviço',
            sku: 'CONS-DEV-1H'
          },
          {
            workspace_id: workspaceId,
            name: 'Licença WhatsApp API Adicional',
            description: 'Conecte um número extra do WhatsApp à mesma conta.',
            price: 79.90,
            stock: 120,
            category: 'Addon',
            sku: 'WA-ADDON-API'
          }
        ]);
      if (prodError) throw prodError;
    } else {
      console.log('✅ Products already seeded.');
    }

    // 7. Seed Demo Orders
    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (orderCount === 0) {
      console.log('🌱 Seeding demo orders...');
      const { error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            workspace_id: workspaceId,
            customer_id: customerId,
            total_amount: 199.00,
            status: 'confirmed',
            payment_method: 'credit_card',
            payment_status: 'completed'
          },
          {
            workspace_id: workspaceId,
            customer_id: customerId,
            total_amount: 350.00,
            status: 'pending',
            payment_method: 'pix',
            payment_status: 'pending'
          }
        ]);
      if (orderError) throw orderError;
    } else {
      console.log('✅ Orders already seeded.');
    }

    // 8. Seed Appointments
    const { count: apptCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (apptCount === 0) {
      console.log('🌱 Seeding demo calendar appointments...');
      const today = new Date().toISOString().split('T')[0];
      const tomorrowObj = new Date();
      tomorrowObj.setDate(tomorrowObj.getDate() + 1);
      const tomorrow = tomorrowObj.toISOString().split('T')[0];

      const { error: apptError } = await supabase
        .from('appointments')
        .insert([
          {
            workspace_id: workspaceId,
            customer_id: customerId,
            service_type: 'Reunião de Onboarding',
            scheduled_date: today,
            scheduled_time: '14:00:00',
            duration_minutes: 45,
            status: 'confirmed',
            notes: 'Reunião inicial para alinhar fluxos de IA da Alice.'
          },
          {
            workspace_id: workspaceId,
            customer_id: customerId,
            service_type: 'Revisão Técnica de Fluxo',
            scheduled_date: tomorrow,
            scheduled_time: '10:30:00',
            duration_minutes: 60,
            status: 'scheduled',
            notes: 'Ajustar prompts e conectar base de dados oficial.'
          }
        ]);
      if (apptError) throw apptError;
    } else {
      console.log('✅ Appointments already seeded.');
    }

    // 9. Seed Knowledge Base Articles
    const { count: kbCount } = await supabase
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (kbCount === 0) {
      console.log('🌱 Seeding knowledge base articles...');
      const { error: kbError } = await supabase
        .from('knowledge_base')
        .insert([
          {
            workspace_id: workspaceId,
            title: 'Como funciona a integração com WhatsApp?',
            content: 'A integração da Alice com o WhatsApp é feita por meio da API Oficial Cloud da Meta. Ao conectar seu token de acesso permanente e seu ID da conta comercial nas configurações da Alice, o sistema valida automaticamente o Webhook. Toda mensagem recebida no WhatsApp do cliente aciona a inteligência artificial, que responde instantaneamente com base no conhecimento de sua base e produtos.',
            category: 'Suporte',
            tags: ['whatsapp', 'meta', 'webhook'],
            is_published: true
          },
          {
            workspace_id: workspaceId,
            title: 'Configurações de Pagamento da Alice',
            content: 'Nosso sistema aceita pagamentos via Cartão de Crédito, PIX, Boleto e WhatsApp Pay. Os checkouts são criados e validados dinamicamente por meio do módulo Stripe. Caso ocorra uma compra bem-sucedida, nosso webhook atualiza o status do pedido para "completado" e notifica a inteligência artificial para que envie o comprovante diretamente ao canal do cliente.',
            category: 'Financeiro',
            tags: ['pagamento', 'stripe', 'pix'],
            is_published: true
          }
        ]);
      if (kbError) throw kbError;
    } else {
      console.log('✅ Knowledge base articles already seeded.');
    }

    // 10. Seed Automations
    const { count: autoCount } = await supabase
      .from('automations')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (autoCount === 0) {
      console.log('🌱 Seeding default automations...');
      const { error: autoError } = await supabase
        .from('automations')
        .insert([
          {
            workspace_id: workspaceId,
            name: 'Resposta Automática do WhatsApp',
            trigger_event: 'messages.incoming',
            conditions: { channel: 'whatsapp' },
            actions: [
              { type: 'ai_response', params: { model: 'gemini-2.5-pro' } }
            ],
            is_active: true
          },
          {
            workspace_id: workspaceId,
            name: 'Notificar Comprovante de Compra',
            trigger_event: 'orders.completed',
            conditions: { payment_status: 'completed' },
            actions: [
              { type: 'send_message', params: { text: 'Seu pagamento foi confirmado! Obrigado pela compra.' } }
            ],
            is_active: true
          }
        ]);
      if (autoError) throw autoError;
    } else {
      console.log('✅ Automations already seeded.');
    }

    console.log('🎉 Supabase database seeded successfully! All tables populated.');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  }
}

seed();
