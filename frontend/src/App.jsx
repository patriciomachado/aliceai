import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Layout/Sidebar';
import Welcome from './components/Welcome';

// Import Pages (Module Components)
import Dashboard from './components/Dashboard';
import Inbox from './components/Inbox';
import Customers from './components/Customers';
import Products from './components/Products';
import Services from './components/Services';
import Orders from './components/Orders';
import Appointments from './components/Appointments';
import KnowledgeBase from './components/KnowledgeBase';
import Automations from './components/Automations';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import Team from './components/Team';

import Widget from './components/Common/Widget';

// Initialize TanStack React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

const ClerkTokenGate = ({ children }) => {
  const { getToken } = useAuth();

  React.useEffect(() => {
    const syncToken = async () => {
      try {
        const token = await getToken();
        if (token) {
          localStorage.setItem('clerk_token', token);
        } else {
          localStorage.removeItem('clerk_token');
        }
      } catch (err) {
        console.error('Error syncing Clerk token:', err);
      }
    };

    syncToken();
    // Refresh token periodically (every 50 seconds since Clerk tokens expire in 60s)
    const interval = setInterval(syncToken, 50000);
    return () => clearInterval(interval);
  }, [getToken]);

  return children;
};

const AppLayout = ({ children }) => {
  return (
    <div className="flex w-screen h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 h-screen overflow-y-auto p-8 relative flex flex-col gap-6">
        {children}
        <Widget />
      </main>
    </div>
  );
};

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_ZGFybGluZy1zcG9uZ2UtNzUuY2xlcmsuYWNjb3VudHMuZGV2JA';

const App = () => {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <SignedIn>
            <ClerkTokenGate>
              <Router>
                <Routes>
                  {/* Fullscreen standalone POS / Kitchen display monitor */}
                  <Route path="/orders-only" element={<Orders standalone={true} />} />

                  {/* Standard workspace dashboard panels nested in AppLayout */}
                  <Route path="/*" element={
                    <AppLayout>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/inbox" element={<Inbox />} />
                        <Route path="/customers" element={<Customers />} />
                        <Route path="/products" element={<Products />} />
                        <Route path="/services" element={<Services />} />
                        <Route path="/orders" element={<Orders />} />
                        <Route path="/appointments" element={<Appointments />} />
                        <Route path="/knowledge-base" element={<KnowledgeBase />} />
                        <Route path="/automations" element={<Automations />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/team" element={<Team />} />
                      </Routes>
                    </AppLayout>
                  } />
                </Routes>
              </Router>
            </ClerkTokenGate>
          </SignedIn>
          <SignedOut>
            <Welcome />
          </SignedOut>
        </AppProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
};

export default App;
