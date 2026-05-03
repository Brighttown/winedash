import api from './axios';

export const getMe = () => api.get('/account/me').then(r => r.data);
export const updateProfile = (data) => api.patch('/account/profile', data).then(r => r.data);
export const updatePassword = (data) => api.patch('/account/password', data).then(r => r.data);
export const updateCompany = (data) => api.patch('/account/company', data).then(r => r.data);

export const listIntegrations = () => api.get('/integrations').then(r => r.data);
export const createIntegration = (data) => api.post('/integrations', data).then(r => r.data);
export const updateIntegration = (id, data) => api.patch(`/integrations/${id}`, data).then(r => r.data);
export const deleteIntegration = (id) => api.delete(`/integrations/${id}`);
