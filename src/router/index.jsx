import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import AuthLayout from '../features/auth/AuthLayout';
import Login from '../features/auth/Login';
import Register from '../features/auth/Register';
import ForgotPassword from '../features/auth/ForgotPassword';
import RoleRedirect from '../features/auth/RoleRedirect';
import AuthGuard from '../features/auth/AuthGuard';
import MotherDashboard from '../features/dashboard/MotherDashboard';
import CHWDashboard from '../features/dashboard/CHWDashboard';
import NurseDashboard from '../features/dashboard/NurseDashboard';
import DoctorDashboard from '../features/dashboard/DoctorDashboard';
import DistrictDashboard from '../features/dashboard/DistrictDashboard';
import AdminDashboard from '../features/dashboard/AdminDashboard';
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

const A = AuthGuard;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <RoleRedirect /> },

      // ─── Mother Portal ────────────────────────────────────
      {
        path: 'mother/dashboard',
        element: <A allowedRoles={['mother']}><MotherDashboard /></A>
      },
      {
        path: 'mother/pregnancy',
        element: <A allowedRoles={['mother']}><MotherHealth /></A>
      },
      {
        path: 'mother/children',
        element: <A allowedRoles={['mother']}><ChildList /></A>
      },
      {
        path: 'mother/children/new',
        element: <A allowedRoles={['mother']}><ChildForm /></A>
      },
      {
        path: 'mother/children/:id',
        element: <A allowedRoles={['mother']}><ChildProfile /></A>
      },
      {
        path: 'mother/children/:id/edit',
        element: <A allowedRoles={['mother']}><ChildForm /></A>
      },
      {
        path: 'mother/appointments',
        element: <A allowedRoles={['mother']}><AppointmentList /></A>
      },

      // ─── CHW Portal ───────────────────────────────────────
      {
        path: 'chw/dashboard',
        element: <A allowedRoles={['chw']}><CHWDashboard /></A>
      },
      {
        path: 'chw/mothers',
        element: <A allowedRoles={['chw']}><MotherList /></A>
      },
      {
        path: 'chw/mothers/new',
        element: <A allowedRoles={['chw']}><MotherForm /></A>
      },
      {
        path: 'chw/mothers/:id',
        element: <A allowedRoles={['chw']}><MotherProfile /></A>
      },
      {
        path: 'chw/mothers/:id/edit',
        element: <A allowedRoles={['chw']}><MotherForm /></A>
      },
      {
        path: 'chw/children',
        element: <A allowedRoles={['chw']}><ChildList /></A>
      },
      {
        path: 'chw/children/new',
        element: <A allowedRoles={['chw']}><ChildForm /></A>
      },
      {
        path: 'chw/children/:id',
        element: <A allowedRoles={['chw']}><ChildProfile /></A>
      },
      {
        path: 'chw/children/:id/edit',
        element: <A allowedRoles={['chw']}><ChildForm /></A>
      },
      {
        path: 'chw/visits',
        element: <A allowedRoles={['chw']}><VisitList /></A>
      },
      {
        path: 'chw/visits/new',
        element: <A allowedRoles={['chw']}><VisitForm /></A>
      },
      {
        path: 'chw/visits/:id/edit',
        element: <A allowedRoles={['chw']}><VisitForm /></A>
      },
      {
        path: 'chw/referrals',
        element: <A allowedRoles={['chw']}><ReferralList /></A>
      },
      {
        path: 'chw/referrals/new',
        element: <A allowedRoles={['chw']}><ReferralForm /></A>
      },

      // ─── Nurse Portal ─────────────────────────────────────
      {
        path: 'nurse/dashboard',
        element: <A allowedRoles={['nurse']}><NurseDashboard /></A>
      },
      {
        path: 'nurse/mothers',
        element: <A allowedRoles={['nurse']}><MotherList /></A>
      },
      {
        path: 'nurse/mothers/new',
        element: <A allowedRoles={['nurse']}><MotherForm /></A>
      },
      {
        path: 'nurse/mothers/:id',
        element: <A allowedRoles={['nurse']}><MotherProfile /></A>
      },
      {
        path: 'nurse/mothers/:id/edit',
        element: <A allowedRoles={['nurse']}><MotherForm /></A>
      },
      {
        path: 'nurse/anc',
        element: <A allowedRoles={['nurse']}><AppointmentList /></A>
      },
      {
        path: 'nurse/appointments',
        element: <A allowedRoles={['nurse']}><AppointmentList /></A>
      },
      {
        path: 'nurse/referrals',
        element: <A allowedRoles={['nurse']}><ReferralList /></A>
      },
      {
        path: 'nurse/referrals/new',
        element: <A allowedRoles={['nurse']}><ReferralForm /></A>
      },
      {
        path: 'nurse/reports',
        element: <A allowedRoles={['nurse']}><ReportsPage /></A>
      },

      // ─── Doctor Portal ────────────────────────────────────
      {
        path: 'doctor/dashboard',
        element: <A allowedRoles={['doctor']}><DoctorDashboard /></A>
      },
      {
        path: 'doctor/mothers',
        element: <A allowedRoles={['doctor']}><MotherList /></A>
      },
      {
        path: 'doctor/mothers/new',
        element: <A allowedRoles={['doctor']}><MotherForm /></A>
      },
      {
        path: 'doctor/mothers/:id',
        element: <A allowedRoles={['doctor']}><MotherProfile /></A>
      },
      {
        path: 'doctor/mothers/:id/edit',
        element: <A allowedRoles={['doctor']}><MotherForm /></A>
      },
      {
        path: 'doctor/referrals',
        element: <A allowedRoles={['doctor']}><ReferralList /></A>
      },
      {
        path: 'doctor/referrals/new',
        element: <A allowedRoles={['doctor']}><ReferralForm /></A>
      },
      {
        path: 'doctor/reports',
        element: <A allowedRoles={['doctor']}><ReportsPage /></A>
      },

      // ─── District Officer Portal ──────────────────────────
      {
        path: 'district/dashboard',
        element: <A allowedRoles={['district_officer']}><DistrictDashboard /></A>
      },
      {
        path: 'district/facilities',
        element: <A allowedRoles={['district_officer']}><AdminFacilities /></A>
      },
      {
        path: 'district/reports',
        element: <A allowedRoles={['district_officer']}><ReportsPage /></A>
      },
      {
        path: 'district/users',
        element: <A allowedRoles={['district_officer']}><AdminUsers /></A>
      },

      // ─── Admin Portal ─────────────────────────────────────
      {
        path: 'admin/dashboard',
        element: <A allowedRoles={['admin']}><AdminDashboard /></A>
      },
      {
        path: 'admin/users',
        element: <A allowedRoles={['admin']}><AdminUsers /></A>
      },
      {
        path: 'admin/mothers',
        element: <A allowedRoles={['admin']}><MotherList /></A>
      },
      {
        path: 'admin/mothers/:id',
        element: <A allowedRoles={['admin']}><MotherProfile /></A>
      },
      {
        path: 'admin/children',
        element: <A allowedRoles={['admin']}><ChildList /></A>
      },
      {
        path: 'admin/children/:id',
        element: <A allowedRoles={['admin']}><ChildProfile /></A>
      },
      {
        path: 'admin/facilities',
        element: <A allowedRoles={['admin', 'district_officer']}><AdminFacilities /></A>
      },
      {
        path: 'admin/referrals',
        element: <A allowedRoles={['admin']}><ReferralList /></A>
      },
      {
        path: 'admin/reports',
        element: <A allowedRoles={['admin']}><ReportsPage /></A>
      },
      {
        path: 'admin/archive',
        element: <A allowedRoles={['admin']}><AdminArchive /></A>
      },

      // ─── Shared Routes ────────────────────────────────────
      {
        path: 'shared/amina',
        element: <A><AminaChat /></A>
      },
      {
        path: 'shared/settings',
        element: <A><SettingsPage /></A>
      },

      // ─── Legacy Flat Routes (redirects) ───────────────────
      { path: 'dashboard', element: <RoleRedirect /> },
      { path: 'amina', element: <Navigate to="/shared/amina" replace /> },
      { path: 'settings', element: <Navigate to="/shared/settings" replace /> },
      { path: 'health', element: <Navigate to="/mother/pregnancy" replace /> },
      { path: 'mothers', element: <Navigate to="/chw/mothers" replace /> },
      { path: 'children', element: <Navigate to="/chw/children" replace /> },
      { path: 'visits', element: <Navigate to="/chw/visits" replace /> },
      { path: 'referrals', element: <Navigate to="/chw/referrals" replace /> },
    ]
  },

  // ─── Auth Routes ──────────────────────────────────────────
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { index: true, element: <Navigate to="/auth/login" replace /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot-password', element: <ForgotPassword /> }
    ]
  },

  { path: '*', element: <Navigate to="/" replace /> }
]);

export default router;
