import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User, Shield, Key, CreditCard, Bell, Moon, LogOut, Plus,
  Trash2, Edit2, Check, X, Loader2, AlertCircle, Zap,
  Server, Globe, Settings2, Eye, EyeOff, TestTube2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/src/store';
import { configurationService } from '@/src/services';
import type { APIConfiguration, WebhookConfiguration } from '@/types';

const Toggle = ({ active, onChange }: { active: boolean; onChange?: () => void }) => (
  <button
    onClick={onChange}
    className={`w-11 h-6 rounded-full p-1 transition-colors ${active ? 'bg-violet-600' : 'bg-gray-700'}`}
  >
    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

const SettingsSection = ({ title, children, action }: any) => (
  <div className="mb-8">
    <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-4">
      <h3 className="text-lg font-medium text-white">{title}</h3>
      {action}
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

const Modal = ({ isOpen, onClose, title, children }: any) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#1a1a1d] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        >
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const Settings: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'general');
  const { user, logout, updateProfile } = useAuthStore();

  // API Configuration state
  const [apiConfigs, setApiConfigs] = useState<APIConfiguration[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfiguration[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<APIConfiguration | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [testingConfig, setTestingConfig] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Form state for API config
  const [configForm, setConfigForm] = useState<Partial<APIConfiguration>>({
    name: '',
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: '',
    isDefault: false,
    isActive: true,
    rateLimit: 100,
  });

  const isAdmin = user?.role === 'admin';

  const TABS = [
    { id: 'general', label: 'General', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'api', label: 'API Configuration', icon: Key, adminOnly: false },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  useEffect(() => {
    if (activeTab === 'api') {
      loadAPIConfigs();
    }
  }, [activeTab]);

  const loadAPIConfigs = async () => {
    setIsLoadingConfigs(true);
    try {
      const configs = await configurationService.getAPIConfigurations();
      setApiConfigs(configs);
      const hooks = await configurationService.getWebhookConfigurations();
      setWebhooks(hooks);
    } catch (error) {
      console.error('Failed to load API configs:', error);
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  const handleAddConfig = () => {
    setEditingConfig(null);
    setConfigForm({
      name: '',
      provider: 'openai',
      apiKey: '',
      baseUrl: '',
      model: '',
      isDefault: false,
      isActive: true,
      rateLimit: 100,
    });
    setIsModalOpen(true);
  };

  const handleEditConfig = (config: APIConfiguration) => {
    setEditingConfig(config);
    setConfigForm({
      name: config.name,
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      isDefault: config.isDefault,
      isActive: config.isActive,
      rateLimit: config.rateLimit,
    });
    setIsModalOpen(true);
  };

  const handleSaveConfig = async () => {
    try {
      const newConfig = {
        ...configForm,
        id: editingConfig?.id,
      } as APIConfiguration;

      // In real implementation, this would call the API
      if (editingConfig) {
        setApiConfigs(prev => prev.map(c => c.id === editingConfig.id ? { ...c, ...newConfig } : c));
      } else {
        setApiConfigs(prev => [...prev, { ...newConfig, id: `config-${Date.now()}` }]);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this API configuration?')) return;
    try {
      setApiConfigs(prev => prev.filter(c => c.id !== configId));
    } catch (error) {
      console.error('Failed to delete config:', error);
    }
  };

  const handleTestConfig = async (config: APIConfiguration) => {
    setTestingConfig(config.id || '');
    setTestResult(null);
    try {
      const result = await configurationService.testAPIConfiguration(config);
      setTestResult({ id: config.id || '', ...result });
    } catch (error) {
      setTestResult({ id: config.id || '', success: false, message: 'Connection test failed' });
    } finally {
      setTestingConfig(null);
    }
  };

  const handleSetDefault = async (configId: string) => {
    setApiConfigs(prev => prev.map(c => ({
      ...c,
      isDefault: c.id === configId,
    })));
  };

  const toggleShowApiKey = (configId: string) => {
    setShowApiKey(prev => ({ ...prev, [configId]: !prev[configId] }));
  };

  const availableModels = configForm.provider
    ? configurationService.getAvailableModels(configForm.provider)
    : [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Manage your account preferences and workspace configuration.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-surface/30 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden p-2 space-y-1 sticky top-8">
            {TABS.filter(tab => !tab.adminOnly || isAdmin).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
            <div className="h-px bg-white/5 my-2" />
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-surface/30 backdrop-blur-xl border border-white/5 rounded-3xl p-8 min-h-[600px]">
          {activeTab === 'general' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SettingsSection title="Profile Information">
                <div className="flex items-center gap-6 mb-6">
                  <img
                    src={user?.avatar || "https://picsum.photos/id/64/200/200"}
                    className="w-24 h-24 rounded-full border-4 border-surface object-cover"
                    alt="Profile"
                  />
                  <div>
                    <button className="px-4 py-2 bg-white text-black font-medium text-sm rounded-lg hover:bg-gray-200 transition-colors">
                      Change Avatar
                    </button>
                    <p className="text-xs text-gray-500 mt-2">JPG, GIF or PNG. Max 1MB.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      defaultValue={`${user?.firstname || ''} ${user?.lastname || ''}`.trim() || ''}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      defaultValue={user?.email || ''}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection title="Appearance">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-black/20 rounded-lg"><Moon size={18} className="text-violet-400" /></div>
                    <div>
                      <h4 className="text-white font-medium text-sm">Dark Mode</h4>
                      <p className="text-xs text-gray-500">Adjust the appearance of the application</p>
                    </div>
                  </div>
                  <Toggle active={true} />
                </div>
              </SettingsSection>
            </motion.div>
          )}

          {activeTab === 'api' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SettingsSection
                title="API Provider Configuration"
                action={
                  <button
                    onClick={handleAddConfig}
                    className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus size={16} /> Add Provider
                  </button>
                }
              >
                <div className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl mb-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-violet-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-violet-200 font-medium">API Configuration</p>
                      <p className="text-xs text-violet-300/70 mt-1">
                        Configure your AI providers, API keys, and rate limits. These settings control how the application connects to various AI services.
                      </p>
                    </div>
                  </div>
                </div>

                {isLoadingConfigs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                  </div>
                ) : apiConfigs.length === 0 ? (
                  <div className="text-center py-12">
                    <Server size={48} className="mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400">No API configurations yet</p>
                    <p className="text-gray-500 text-sm mt-1">Add your first API provider to get started</p>
                    <button
                      onClick={handleAddConfig}
                      className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Add Provider
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apiConfigs.map((config) => (
                      <div
                        key={config.id}
                        className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 group hover:border-violet-500/30 transition-all"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-white font-medium text-sm">{config.name}</h4>
                            {config.isDefault && (
                              <span className="text-[10px] bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded">Default</span>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded ${config.isActive
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-gray-500/20 text-gray-400'
                              }`}>
                              {config.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="capitalize">{config.provider}</span>
                            <span>•</span>
                            <span className="font-mono flex items-center gap-1">
                              {showApiKey[config.id || '']
                                ? config.apiKey
                                : config.apiKey.replace(/./g, '•').slice(0, 20) + '...'
                              }
                              <button
                                onClick={() => toggleShowApiKey(config.id || '')}
                                className="text-gray-400 hover:text-white ml-1"
                              >
                                {showApiKey[config.id || ''] ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </span>
                            {config.model && (
                              <>
                                <span>•</span>
                                <span>{config.model}</span>
                              </>
                            )}
                          </div>
                          {testResult?.id === config.id && (
                            <div className={`mt-2 text-xs px-2 py-1 rounded ${testResult.success
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400'
                              }`}>
                              {testResult.message}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestConfig(config)}
                            disabled={testingConfig === config.id}
                            className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Test Connection"
                          >
                            {testingConfig === config.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <TestTube2 size={16} />
                            )}
                          </button>
                          {!config.isDefault && (
                            <button
                              onClick={() => handleSetDefault(config.id || '')}
                              className="p-2 text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                              title="Set as Default"
                            >
                              <Zap size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditConfig(config)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteConfig(config.id || '')}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SettingsSection>

              <SettingsSection
                title="Webhook Endpoints"
                action={
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors">
                    <Plus size={16} /> Add Webhook
                  </button>
                }
              >
                <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center text-gray-400">
                  <Globe size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No webhooks configured</p>
                  <p className="text-xs text-gray-500 mt-1">Add webhooks to receive real-time notifications</p>
                </div>
              </SettingsSection>

              <SettingsSection title="Rate Limiting">
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-500/10 rounded-lg">
                        <Settings2 size={18} className="text-orange-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">Global Rate Limit</h4>
                        <p className="text-xs text-gray-500">Maximum requests per minute across all providers</p>
                      </div>
                    </div>
                    <input
                      type="number"
                      defaultValue={100}
                      className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-center text-sm focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Zap size={18} className="text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">Auto Rate Limit Handling</h4>
                        <p className="text-xs text-gray-500">Automatically retry requests when rate limited</p>
                      </div>
                    </div>
                    <Toggle active={true} />
                  </div>
                </div>
              </SettingsSection>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SettingsSection title="Password">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Current Password</label>
                    <input type="password" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">New Password</label>
                      <input type="password" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm Password</label>
                      <input type="password" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors" />
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">
                    Update Password
                  </button>
                </div>
              </SettingsSection>

              <SettingsSection title="Two-Factor Authentication">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg"><Shield size={18} className="text-emerald-400" /></div>
                    <div>
                      <h4 className="text-white font-medium text-sm">2FA Authentication</h4>
                      <p className="text-xs text-gray-500">Add an extra layer of security to your account</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors">
                    Enable
                  </button>
                </div>
              </SettingsSection>
            </motion.div>
          )}

          {/* Other tabs placeholders */}
          {(activeTab !== 'general' && activeTab !== 'api' && activeTab !== 'security') && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 pt-20">
              <Shield size={48} className="mb-4 opacity-20" />
              <p>This section is under development.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit API Config Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingConfig ? 'Edit API Configuration' : 'Add API Configuration'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Configuration Name</label>
            <input
              type="text"
              value={configForm.name}
              onChange={(e) => setConfigForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Production OpenAI"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Provider</label>
            <select
              value={configForm.provider}
              onChange={(e) => setConfigForm(prev => ({
                ...prev,
                provider: e.target.value as APIConfiguration['provider'],
                model: ''
              }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors"
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="mistral">Mistral AI</option>
              <option value="anthropic">Anthropic</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">API Key</label>
            <input
              type="password"
              value={configForm.apiKey}
              onChange={(e) => setConfigForm(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sk-..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors font-mono"
            />
          </div>

          {configForm.provider === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Base URL</label>
              <input
                type="text"
                value={configForm.baseUrl}
                onChange={(e) => setConfigForm(prev => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="https://api.example.com/v1"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Model</label>
            <select
              value={configForm.model}
              onChange={(e) => setConfigForm(prev => ({ ...prev, model: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors"
            >
              <option value="">Select a model</option>
              {availableModels.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Rate Limit (requests/min)</label>
            <input
              type="number"
              value={configForm.rateLimit}
              onChange={(e) => setConfigForm(prev => ({ ...prev, rateLimit: parseInt(e.target.value) || 0 }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={configForm.isDefault}
                onChange={(e) => setConfigForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-violet-600 focus:ring-violet-500"
              />
              Set as default provider
            </label>
            <Toggle
              active={configForm.isActive || false}
              onChange={() => setConfigForm(prev => ({ ...prev, isActive: !prev.isActive }))}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveConfig}
              className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Check size={16} />
              {editingConfig ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Settings;