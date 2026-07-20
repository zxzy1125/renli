// 路由配置
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FullScreenLoading } from '@/components/Loading';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/NotFound';

import PositionList from '@/pages/Positions/PositionList';
import PositionDetail from '@/pages/Positions/PositionDetail';
import PositionForm from '@/pages/Positions/PositionForm';

import ResumeList from '@/pages/Resumes/ResumeList';
import ResumeDetail from '@/pages/Resumes/ResumeDetail';
import ResumeForm from '@/pages/Resumes/ResumeForm';

import ClientList from '@/pages/Clients/ClientList';
import ConflictList from '@/pages/Conflicts/ConflictList';

import MatchList from '@/pages/Matches/MatchList';
import MatchNew from '@/pages/Matches/MatchNew';
import MatchDetail from '@/pages/Matches/MatchDetail';

import FollowupHome from '@/pages/Followups/FollowupHome';
import PlanDetail from '@/pages/Followups/PlanDetail';

import ConversionList from '@/pages/Conversions/ConversionList';

import ChatList from '@/pages/Chat/ChatList';
import ChatSessionPage from '@/pages/Chat/ChatSession';

import Settings from '@/pages/Settings/Settings';
import ProfileSettings from '@/pages/Settings/ProfileSettings';
import TeamSettings from '@/pages/Settings/TeamSettings';
import AIConfig from '@/pages/Settings/AIConfig';
import Guidelines from '@/pages/Settings/Guidelines';

export default function App() {
  const { token, user, initialized, fetchMe } = useAuthStore();

  // 应用启动时尝试拉取当前用户
  useEffect(() => {
    if (token && !user && !initialized) {
      fetchMe().catch(() => {});
    }
  }, [token, user, initialized, fetchMe]);

  // 有 token 但还没拿到用户：显示全屏 loading
  const showInitialLoading = !!token && !user && !initialized;

  return (
    <BrowserRouter>
      {showInitialLoading ? (
        <FullScreenLoading />
      ) : (
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<Login />} />

          {/* 受保护路由：套主布局 */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            {/* 职位库 */}
            <Route path="/positions" element={<PositionList />} />
            <Route path="/positions/new" element={<PositionForm />} />
            <Route path="/positions/:id" element={<PositionDetail />} />
            <Route path="/positions/:id/edit" element={<PositionForm />} />

            {/* 简历库 */}
            <Route path="/resumes" element={<ResumeList />} />
            <Route path="/resumes/new" element={<ResumeForm />} />
            <Route path="/resumes/:id" element={<ResumeDetail />} />
            <Route path="/resumes/:id/edit" element={<ResumeForm />} />

            {/* 客户公司 */}
            <Route path="/clients" element={<ClientList />} />

            {/* 匹配 / 跟进 / 转化 */}
            <Route path="/matches" element={<MatchList />} />
            <Route path="/matches/new" element={<MatchNew />} />
            <Route path="/matches/:id" element={<MatchDetail />} />
            <Route path="/followups" element={<FollowupHome />} />
            <Route path="/followups/:id" element={<PlanDetail />} />
            <Route path="/conversions" element={<ConversionList />} />

            {/* 对话辅助（BOSS 实时对话） */}
            <Route path="/chat" element={<ChatList />} />
            <Route path="/chat/:id" element={<ChatSessionPage />} />

            {/* 撞单管理（管理员） */}
            <Route
              path="/conflicts"
              element={
                <ProtectedRoute requireAdmin>
                  <ConflictList />
                </ProtectedRoute>
              }
            />

            {/* 设置 */}
            <Route path="/settings" element={<Settings />}>
              <Route index element={<Navigate to="/settings/profile" replace />} />
              <Route path="profile" element={<ProfileSettings />} />
              <Route
                path="team"
                element={
                  <ProtectedRoute requireAdmin>
                    <TeamSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="ai"
                element={
                  <ProtectedRoute requireAdmin>
                    <AIConfig />
                  </ProtectedRoute>
                }
              />
              <Route path="guidelines" element={<Guidelines />} />
            </Route>
          </Route>

          {/* 403 / 404 */}
          <Route path="/403" element={<NotFound code={403} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
