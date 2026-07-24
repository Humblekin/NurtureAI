import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import AuthLayout from '../features/auth/AuthLayout';
import Login from '../features/auth/Login';
import Register from '../features/auth/Register';
import ForgotPassword from '../features/auth/ForgotPassword';
import DashboardRouter from '../features/dashboard/DashboardRouter';
import AuthGuard from '../features/auth/AuthGuard';
import MotherList from '../features/mothers/MotherList';
import MotherForm from '../features/mothers/MotherForm';
import MotherProfile from '../features/mothers/MotherProfile';
import ChildList from '../features/children/ChildList';
import ChildForm from '../features/children/ChildForm';
import ChildProfile from '../features/children/ChildProfile';
import VisitList from '../features/visits/VisitList';
import VisitForm from '../features/visits/VisitForm';
import ReferralList from '../features/referrals/ReferralList';
import ReferralForm from '../features/referrals/ReferralForm';
import AminaChat from '../features/amina/AminaChat';
import SettingsPage from '../features/settings/SettingsPage';
import MotherHealth from '../features/health/MotherHealth';
import AppointmentList from '../features/health/AppointmentList';
import ReportsPage from '../features/reports/ReportsPage';
import AdminUsers from '../features/admin/AdminUsers';
import AdminFacilities from '../features/admin/AdminFacilities';
import AdminArchive from '../features/admin/AdminArchive';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: 'dashboard',
        element: (
          <AuthGuard>
            <DashboardRouter />
          </AuthGuard>
        )
      },
      // Mothers
      {
        path: 'mothers',
        element: (
          <AuthGuard allowedRoles={['chw', 'nurse', 'doctor', 'admin']}>
            <MotherList />
          </AuthGuard>
        )
      },
      {
        path: 'mothers/new',
        element: (
          <AuthGuard allowedRoles={['chw', 'nurse', 'doctor', 'admin']}>
            <MotherForm />
          </AuthGuard>
        )
      },
      {
        path: 'mothers/:id/edit',
        element: (
          <AuthGuard allowedRoles={['chw', 'nurse', 'doctor', 'admin']}>
            <MotherForm />
          </AuthGuard>
        )
      },
      {
        path: 'mothers/:id',
        element: (
          <AuthGuard allowedRoles={['chw', 'nurse', 'doctor', 'admin']}>
            <MotherProfile />
          </AuthGuard>
        )
      },
      // Children
      {
        path: 'children',
        element: (
          <AuthGuard allowedRoles={['mother', 'chw', 'nurse', 'doctor', 'admin']}>
            <ChildList />
          </AuthGuard>
        )
      },
      {
        path: 'children/new',
        element: (
          <AuthGuard allowedRoles={['chw', 'nurse', 'doctor', 'admin']}>
            <ChildForm />
          </AuthGuard>
        )
      },
      {
        path: 'children/:id/edit',
        element: (
          <AuthGuard allowedRoles={['chw', 'nurse', 'doctor', 'admin']}>
            <ChildForm />
          </AuthGuard>
        )
      },
      {
        path: 'children/:id',
        element: (
          <AuthGuard allowedRoles={['mother', 'chw', 'nurse', 'doctor', 'admin']}>
            <ChildProfile />
          </AuthGuard>
        )
      },
      // Visits
      {
        path: 'visits',
        element: (
          <AuthGuard allowedRoles={['chw', 'nurse', 'doctor', 'admin']}>
            <VisitList />
          </AuthGuard>
        )
      },
      {
        path: 'visits/new',
        element: (
          <AuthGuard allowedRoles={['chw', 'nurse', 'doctor', 'admin']}>
            <VisitForm />
          </AuthGuard>
        )
      },
      {
        path: 'visits/:id/edit',
        element: (
          <AuthGuard allowedRoles={['chw', 'nurse', 'doctor', 'admin']}>
            <VisitForm />
          </AuthGuard>
        )
      },
      // Referrals
      {
        path: 'referrals',
        element: (
          <AuthGuard allowedRoles={['chw', 'nurse', 'doctor', 'admin']}>
            <ReferralList />
          </AuthGuard>
        )
      },
      {
        path: 'referrals/new',
        element: (
          <AuthGuard allowedRoles={['chw', 'nurse', 'doctor', 'admin']}>
            <ReferralForm />
          </AuthGuard>
        )
      },
      // Amina AI - all roles
      {
        path: 'amina',
        element: (
          <AuthGuard>
            <AminaChat />
          </AuthGuard>
        )
      },
      // Settings - all roles
      {
        path: 'settings',
        element: (
          <AuthGuard>
            <SettingsPage />
          </AuthGuard>
        )
      },
      // Mother Health
      {
        path: 'health',
        element: (
          <AuthGuard allowedRoles={['mother']}>
            <MotherHealth />
          </AuthGuard>
        )
      },
      // Appointments (Nurse/Doctor)
      {
        path: 'appointments',
        element: (
          <AuthGuard allowedRoles={['nurse', 'doctor', 'admin']}>
            <AppointmentList />
          </AuthGuard>
        )
      },
      // Reports (Nurse/Doctor/Admin/District Officer)
      {
        path: 'reports',
        element: (
          <AuthGuard allowedRoles={['nurse', 'doctor', 'admin', 'district_officer']}>
            <ReportsPage />
          </AuthGuard>
        )
      },
      // Admin - Users
      {
        path: 'admin/users',
        element: (
          <AuthGuard allowedRoles={['admin']}>
            <AdminUsers />
          </AuthGuard>
        )
      },
      // Admin - Facilities
      {
        path: 'admin/facilities',
        element: (
          <AuthGuard allowedRoles={['admin', 'district_officer']}>
            <AdminFacilities />
          </AuthGuard>
        )
      },
      // Admin - Archive
      {
        path: 'admin/archive',
        element: (
          <AuthGuard allowedRoles={['admin']}>
            <AdminArchive />
          </AuthGuard>
        )
      },
    ]
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/auth/login" replace />
      },
      {
        path: 'login',
        element: <Login />
      },
      {
        path: 'register',
        element: <Register />
      },
      {
        path: 'forgot-password',
        element: <ForgotPassword />
      }
    ]
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
]);

export default router;
