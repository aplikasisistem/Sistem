/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { LoginScreen } from './components/LoginScreen';
import { Navbar } from './components/Navbar';
import { PosView } from './components/pos/PosView';
import { HistoryView } from './components/pos/HistoryView';
import { GudangView } from './components/gudang/GudangView';
import { SupplierView } from './components/gudang/SupplierView';
import { KasbonView } from './components/kasbon/KasbonView';
import { AdminDashboardView } from './components/admin/AdminDashboardView';
import { ReportsView } from './components/admin/ReportsView';
import { ShiftModal } from './components/pos/ShiftModal';

const MainContent: React.FC = () => {
  const { currentUser } = useStore();
  const [currentTab, setCurrentTab] = useState<string>('pos');
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Set appropriate starting tab based on user role
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'gudang') {
      setCurrentTab('gudang');
    } else {
      setCurrentTab('pos');
    }
  }, [currentUser?.id, currentUser?.role]);

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white pb-12">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
      />

      <main className="flex-1">
        {currentTab === 'pos' && <PosView />}
        {currentTab === 'history' && <HistoryView />}
        {currentTab === 'kasbon' && <KasbonView />}
        {currentTab === 'gudang' && <GudangView />}
        {currentTab === 'supplier' && <SupplierView />}
        {currentTab === 'overview' && (
          <AdminDashboardView
            initialTab="overview"
            onTabChange={(tab) => setCurrentTab(tab === 'prices' ? 'master-price' : tab)}
          />
        )}
        {currentTab === 'master-price' && (
          <AdminDashboardView
            initialTab="prices"
            onTabChange={(tab) => setCurrentTab(tab === 'prices' ? 'master-price' : tab)}
          />
        )}
        {currentTab === 'expenses' && (
          <AdminDashboardView
            initialTab="expenses"
            onTabChange={(tab) => setCurrentTab(tab === 'prices' ? 'master-price' : tab)}
          />
        )}
        {currentTab === 'users' && (
          <AdminDashboardView
            initialTab="users"
            onTabChange={(tab) => setCurrentTab(tab === 'prices' ? 'master-price' : tab)}
          />
        )}
        {currentTab === 'reports' && <ReportsView />}
      </main>

      <ShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <MainContent />
    </StoreProvider>
  );
}

