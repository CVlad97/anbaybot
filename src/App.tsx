import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import WalletsPage from './pages/WalletsPage';
import SignalsPage from './pages/SignalsPage';
import TradersPage from './pages/TradersPage';
import StrategiesPage from './pages/StrategiesPage';
import AutoTradePage from './pages/AutoTradePage';
import AIPage from './pages/AIPage';
import ConsolePage from './pages/ConsolePage';
import TransactionsPage from './pages/TransactionsPage';
import SafetyPage from './pages/SafetyPage';
import OrchestrationPage from './pages/OrchestrationPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/wallets" element={<WalletsPage />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/traders" element={<TradersPage />} />
          <Route path="/strategies" element={<StrategiesPage />} />
          <Route path="/auto-trade" element={<AutoTradePage />} />
          <Route path="/ai" element={<AIPage />} />
          <Route path="/orchestration" element={<OrchestrationPage />} />
          <Route path="/console" element={<ConsolePage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/safety" element={<SafetyPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
