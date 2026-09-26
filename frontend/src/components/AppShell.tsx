import { Bell, Boxes, ClipboardList, LayoutDashboard, LogOut, MapPin, Menu, Moon, Package, Settings, SlidersHorizontal, Sun, Truck, Warehouse as WarehouseIcon, X } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { useTheme } from "../lib/theme";
import type { Notification } from "../lib/types";

const primary = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/stock", label: "Stock", icon: Boxes },
  { to: "/move-history", label: "Move history", icon: ClipboardList },
];
const operations = [
  { to: "/receipts", label: "Receipts", icon: Package },
  { to: "/deliveries", label: "Delivery", icon: Truck },
  { to: "/transfers", label: "Transfers", icon: SlidersHorizontal },
  { to: "/adjustments", label: "Adjustments", icon: ClipboardList },
];
const setup = [
  { to: "/products", label: "Products", icon: Package },
  { to: "/warehouses", label: "Warehouses", icon: WarehouseIcon },
  { to: "/locations", label: "Locations", icon: MapPin },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  useEffect(() => { api.notifications(true).then(setNotifications).catch(() => undefined); }, [location.pathname]);
  const links = (items: typeof primary) => items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><Icon size={17} /><span>{label}</span></NavLink>);
  return <div className="app-frame"><aside className={`sidebar ${mobileOpen ? "open" : ""}`}><div className="brand"><div className="brand-mark">S</div><div><strong>stocksense</strong><small>WAREHOUSE CONTROL</small></div><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={18} /></button></div><div className="sidebar-scroll"><span className="nav-label">Workspace</span>{links(primary)}<span className="nav-label nav-label-gap">Operations</span>{links(operations)}<span className="nav-label nav-label-gap">Setup</span>{links(setup)}<span className="nav-label nav-label-gap">System</span><NavLink to="/reorder-rules" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><SlidersHorizontal size={17} /><span>Reorder rules</span></NavLink><NavLink to="/audit-logs" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><ClipboardList size={17} /><span>Audit log</span></NavLink><NavLink to="/settings" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><Settings size={17} /><span>Settings</span></NavLink></div><div className="user-card"><div className="avatar">{user?.name.slice(0, 1).toUpperCase()}</div><div className="user-meta"><strong>{user?.name}</strong><span>{user?.role}</span></div><button className="icon-button" onClick={() => void logout()} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button></div></aside><div className={`mobile-overlay ${mobileOpen ? "show" : ""}`} onClick={() => setMobileOpen(false)} /><main className="main-shell"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="crumb"><span>StockSense</span><i>/</i><strong>{location.pathname === "/" ? "Dashboard" : location.pathname.slice(1).replaceAll("-", " ")}</strong></div><div className="topbar-actions"><button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button><button className={`notification-button ${noticeOpen ? "selected" : ""}`} onClick={() => setNoticeOpen(!noticeOpen)} aria-label="Notifications"><Bell size={18} />{notifications.length > 0 && <b>{notifications.length}</b>}</button>{noticeOpen && <div className="notification-popover"><div className="popover-head"><strong>Notifications</strong><span>{notifications.length} unread</span></div>{notifications.length === 0 ? <p className="popover-empty">You are all caught up.</p> : notifications.map((item) => <button className="notification-row" key={item.id} onClick={() => { void api.markNotificationRead(item.id); setNotifications((old) => old.filter((notification) => notification.id !== item.id)); }}><span className={`notification-dot ${item.severity.toLowerCase()}`} /><span><strong>{item.title}</strong><small>{item.message}</small></span></button>)}</div>}</div></header><div className="page-content"><Outlet /></div></main></div>;
}
