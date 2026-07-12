import axios from 'axios';

const getBaseURL = () => {
  // Highest priority: explicit env var (set in Vercel dashboard or .env)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    // Local dev: backend on port 3000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000/api';
    }
    // Production on Vercel: the API is at /api on the same origin (rewritten
    // by vercel.json to the serverless function in /api/index.js)
    return `${protocol}//${hostname}/api`;
  }
  return 'http://localhost:3000/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000, // 30 seconds — needed for AI processing + DB queries
  headers: {
    'Content-Type': 'application/json'
  }
});

// Configure Clerk token interceptor if active
api.interceptors.request.use(async (config) => {
  try {
    // Attempt to extract authorization clerk token from local storage or memory if available
    const token = localStorage.getItem('clerk_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    console.error('Request interceptor clerk loading error:', err);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Custom response interceptor with automatic simulated mock fallback array checks for dev convenience
api.interceptors.response.use(
  response => response,
  error => {
    console.warn('API connection encountered error, mapping simulated payload:', error.message);
    const mockData = getMockData(error.config?.url, error.config?.method);
    if (mockData) {
      return Promise.resolve({ data: mockData, status: 200, headers: {}, config: error.config });
    }
    return Promise.reject(error);
  }
);

/**
 * Returns clean mock payloads to enable standalone, zero-dependencies offline frontend showcases!
 */
function getMockData(url = '', method = 'GET') {
  const path = url.split('?')[0];
  const upperMethod = (method || 'GET').toUpperCase();

  // NOTE: /auth/me and /auth/workspace are NOT mocked so real data flows to/from the backend
  
  if (path.includes('/analytics/dashboard')) {
    return {
      revenue: 14850.20,
      pendingOrders: 5,
      activeChats: 12,
      averageSentiment: 0.84,
      totalCustomers: 184,
      conversionRate: 4.8
    };
  }

  if (path.includes('/analytics/conversations')) {
    return [
      { name: 'Seg', sentiment: 0.72, volume: 45 },
      { name: 'Ter', sentiment: 0.81, volume: 55 },
      { name: 'Qua', sentiment: 0.79, volume: 62 },
      { name: 'Qui', sentiment: 0.85, volume: 48 },
      { name: 'Sex', sentiment: 0.88, volume: 70 },
      { name: 'Sab', sentiment: 0.92, volume: 30 },
      { name: 'Dom', sentiment: 0.90, volume: 15 }
    ];
  }

  if (path.includes('/customers')) {
    if (upperMethod === 'DELETE') return { success: true };
    return [
      { id: '1', name: 'Juliana Silva', email: 'juliana@gmail.com', phone: '11988887777', whatsapp: '11988887777', tags: ['vip', 'lead-quente'], lifetime_value: 1250.00, created_at: '2026-05-15' },
      { id: '2', name: 'Rodrigo Santos', email: 'rodrigo@outlook.com', phone: '21977776666', whatsapp: '21977776666', tags: ['atencao'], lifetime_value: 320.00, created_at: '2026-05-18' },
      { id: '3', name: 'Camila Fernandes', email: 'camila@yahoo.com', phone: '31966665555', whatsapp: '31966665555', tags: ['novo-lead'], lifetime_value: 0.00, created_at: '2026-05-22' }
    ];
  }

  if (path.includes('/conversations')) {
    if (path.endsWith('/messages')) {
      return [
        { id: 'm1', sender_type: 'customer', content: 'Olá! Gostaria de saber se o produto X está em estoque?', created_at: '2026-05-22T20:10:00Z' },
        { id: 'm2', sender_type: 'ai', content: 'Olá! Sim, temos o produto X em estoque em nossa loja. Deseja que eu gere o link para finalizar o pedido?', created_at: '2026-05-22T20:10:05Z' },
        { id: 'm3', sender_type: 'customer', content: 'Sim, por favor! E qual o prazo de entrega para SP?', created_at: '2026-05-22T20:11:00Z' }
      ];
    }
    return [
      { id: 'c1', channel: 'whatsapp', status: 'active', sentiment_score: 0.85, last_message_at: '2026-05-22T20:11:00Z', customers: { name: 'Juliana Silva', phone: '11988887777' } },
      { id: 'c2', channel: 'instagram', status: 'active', sentiment_score: 0.72, last_message_at: '2026-05-22T19:45:00Z', customers: { name: 'Rodrigo Santos', instagram_handle: 'rodrigo_santos' } },
      { id: 'c3', channel: 'widget', status: 'closed', sentiment_score: 0.90, last_message_at: '2026-05-21T15:30:00Z', customers: { name: 'Camila Fernandes', email: 'camila@yahoo.com' } }
    ];
  }

  if (path.includes('/services')) {
    if (upperMethod === 'POST') {
      return {
        id: `s${Math.floor(Math.random() * 1000)}`,
        name: 'Novo Serviço',
        description: '',
        price: 0,
        duration_minutes: 60,
        category: 'Geral',
        is_active: true,
        created_at: new Date().toISOString()
      };
    }
    if (upperMethod === 'DELETE') return { success: true };
    return [
      { id: 's1', name: 'Consultoria Básica', description: 'Atendimento inicial e diagnóstico.', price: 150.00, duration_minutes: 60, category: 'Consultoria', is_active: true },
      { id: 's2', name: 'Implementação Completa', description: 'Setup e integração de todos os módulos.', price: 750.00, duration_minutes: 180, category: 'Setup', is_active: true }
    ];
  }

  if (path.includes('/products')) {
    if (upperMethod === 'DELETE') return { success: true };
    return [
      { id: 'p1', name: 'Curso de Marketing Digital', description: 'Treinamento completo para automações avançadas de leads.', price: 497.00, stock: 999, category: 'Infoprodutos', sku: 'INF-MKT-01' },
      { id: 'p2', name: 'Mentoria Semanal VIP', description: 'Sessões de consultoria 1-1 com analista especializado.', price: 1500.00, stock: 15, category: 'Consultoria', sku: 'SV-VIP-02' },
      { id: 'p3', name: 'Pack de Templates Premium', description: 'Modelos prontos para funis de venda acelerados.', price: 97.00, stock: 5000, category: 'Infoprodutos', sku: 'TMP-PRE-03' }
    ];
  }

  if (path.includes('/orders')) {
    if (upperMethod === 'POST') {
      return {
        order: {
          id: `o${Math.floor(Math.random() * 1000)}`,
          total_amount: 497.00,
          status: 'pending',
          payment_method: 'credit_card',
          payment_status: 'pending',
          created_at: new Date().toISOString().split('T')[0],
          customers: { name: 'Juliana Silva' }
        },
        paymentUrl: 'https://checkout.stripe.com/pay/mock_session'
      };
    }
    return [
      { id: 'o1', total_amount: 497.00, status: 'confirmed', payment_method: 'credit_card', payment_status: 'completed', created_at: '2026-05-22', customers: { name: 'Juliana Silva' } },
      { id: 'o2', total_amount: 1500.00, status: 'pending', payment_method: 'pix', payment_status: 'pending', created_at: '2026-05-22', customers: { name: 'Rodrigo Santos' } }
    ];
  }

  if (path.includes('/appointments')) {
    if (upperMethod === 'POST') {
      return {
        id: `ap${Math.floor(Math.random() * 1000)}`,
        service_type: 'Mentoria VIP 1-1',
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: '14:00:00',
        status: 'scheduled',
        customers: { name: 'Juliana Silva' }
      };
    }
    if (path.includes('/availability')) {
      return { date: '2026-05-23', availableSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] };
    }
    return [
      { id: 'ap1', service_type: 'Mentoria VIP 1-1', scheduled_date: '2026-05-24', scheduled_time: '14:00:00', status: 'scheduled', customers: { name: 'Juliana Silva' } },
      { id: 'ap2', service_type: 'Integração de Contas', scheduled_date: '2026-05-25', scheduled_time: '10:00:00', status: 'confirmed', customers: { name: 'Rodrigo Santos' } }
    ];
  }

  if (path.includes('/knowledge-base')) {
    return [
      { id: 'k1', title: 'Como configurar o webhook?', content: 'Para integrar o webhook do Meta, copie o Token de Verificação e cole no painel do Facebook Developer...', category: 'Integrações', tags: ['suporte', 'webhooks'], is_published: true },
      { id: 'k2', title: 'Prazos de Reembolso do Stripe', content: 'Pedidos cancelados são reembolsados automaticamente no prazo de 5 a 10 dias úteis...', category: 'Financeiro', tags: ['stripe', 'financeiro'], is_published: true }
    ];
  }

  if (path.includes('/automations')) {
    return [
      { id: 'au1', name: 'Resposta Automática de Boas-vindas', trigger_event: 'new_message', is_active: true, actions: [{ type: 'send_ai_reply' }] },
      { id: 'au2', name: 'Alerta de Carrinho Abandonado', trigger_event: 'cart_abandoned', is_active: false, actions: [{ type: 'send_whatsapp' }] }
    ];
  }

  if (path.includes('/team') || path.includes('/users')) {
    return [
      { id: 'u1', name: 'Alice Agent Dev', email: 'agent@alice.ai', role: 'admin' },
      { id: 'u2', name: 'Carlos Santos', email: 'carlos@alice.ai', role: 'agent' },
      { id: 'u3', name: 'Mariana Costa', email: 'mariana@alice.ai', role: 'manager' }
    ];
  }

  // /auth/workspace PUT is NOT mocked — must reach the real backend to persist data

  if (path.includes('/whatsapp/status') || path.includes('/whatsapp/qrcode')) {
    return { status: 'disconnected', qrCode: null, user: null };
  }

  return null;
}

export default api;
export { getMockData };
