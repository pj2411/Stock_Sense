import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/Ui";
import { useAuth } from "./lib/auth";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { StockPage } from "./pages/Stock";
import { ProductsPage, SetupPage } from "./pages/Catalog";
import { OperationsPage } from "./pages/Operations";
import { AuditLogsPage, MoveHistoryPage, ReorderRulesPage, SettingsPage } from "./pages/SystemPages";

function ProtectedRoutes() { const { user, loading } = useAuth(); if (loading) return <LoadingState />; if (!user) return <Navigate to="/login" replace />; return <AppShell />; }

export function App() { return <Routes><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedRoutes />}><Route path="/" element={<DashboardPage />} /><Route path="/stock" element={<StockPage />} /><Route path="/move-history" element={<MoveHistoryPage />} /><Route path="/receipts" element={<OperationsPage type="receipts" />} /><Route path="/deliveries" element={<OperationsPage type="deliveries" />} /><Route path="/transfers" element={<OperationsPage type="transfers" />} /><Route path="/adjustments" element={<OperationsPage type="adjustments" />} /><Route path="/products" element={<ProductsPage />} /><Route path="/warehouses" element={<SetupPage resource="warehouses" />} /><Route path="/locations" element={<SetupPage resource="locations" />} /><Route path="/suppliers" element={<SetupPage resource="suppliers" />} /><Route path="/reorder-rules" element={<ReorderRulesPage />} /><Route path="/audit-logs" element={<AuditLogsPage />} /><Route path="/settings" element={<SettingsPage />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>; }
