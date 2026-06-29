'use client';

import React, { useState, useEffect } from 'react';

interface SetupStatus {
  setupComplete: boolean;
  envExists?: boolean;
  currentConfig?: Record<string, string>;
  mongoStatus?: string;
  nodeVersion?: string;
}

interface TestResult {
  success: boolean;
  collections?: string[];
  documentCounts?: Record<string, number>;
  message?: string;
  error?: string;
}

export default function SetupPage() {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Form state
  const [config, setConfig] = useState({
    MONGODB_URI: 'mongodb://localhost:27017',
    MONGODB_DB_NAME: 'gracemusic',
    JWT_SECRET: '',
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: '',
    GROQ_API_KEY: '',
    GEMINI_API_KEY: '',
    GOOGLE_GENERATIVE_AI_API_KEY: '',
    NEXT_PUBLIC_DOMAIN: 'graceahmedabad.org',
  });

  // Migration state
  const [migration, setMigration] = useState({
    sourceUri: '',
    sourceDbName: 'gracemusic_backup_2026_06_13',
    targetDbName: 'gracemusic',
  });

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/setup');
      const data = await res.json();
      setStatus(data);

      if (data.setupComplete) {
        setMessage('Setup is already complete. Redirecting...');
        setMessageType('info');
        setTimeout(() => { window.location.href = '/'; }, 2000);
      }
    } catch (e) {
      setMessage('Failed to check setup status.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const generateJWTSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setConfig(c => ({ ...c, JWT_SECRET: result }));
  };

  const testMongo = async () => {
    setActionLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-mongo',
          uri: config.MONGODB_URI,
          dbName: config.MONGODB_DB_NAME,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        setMessage(data.message);
        setMessageType('success');
      } else {
        setMessage(data.error || 'Connection failed');
        setMessageType('error');
      }
    } catch (e: any) {
      setMessage(e.message);
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  };

  const migrateDb = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'migrate-db',
          sourceUri: migration.sourceUri,
          sourceDbName: migration.sourceDbName,
          targetUri: config.MONGODB_URI,
          targetDbName: migration.targetDbName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        setMessageType('success');
      } else {
        setMessage(data.error || 'Migration failed');
        setMessageType('error');
      }
    } catch (e: any) {
      setMessage(e.message);
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  };

  const saveEnv = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-env', config }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        setMessageType('success');
      } else {
        setMessage(data.error || 'Failed to save');
        setMessageType('error');
      }
    } catch (e: any) {
      setMessage(e.message);
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  };

  const completeSetup = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        setMessageType('success');
        setStep(4); // Show completion screen
      } else {
        setMessage(data.error || 'Failed to complete');
        setMessageType('error');
      }
    } catch (e: any) {
      setMessage(e.message);
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Checking setup status...</p>
        </div>
      </div>
    );
  }

  if (status?.setupComplete) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">Setup Already Complete</h2>
          <p className="text-zinc-400">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  const steps = [
    { title: 'Welcome', icon: '🚀' },
    { title: 'Database Migration', icon: '🗄️' },
    { title: 'Configuration', icon: '⚙️' },
    { title: 'Test & Complete', icon: '✅' },
    { title: 'Done', icon: '🎉' },
  ];

  return (
    <div className="min-h-screen bg-transparent text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-900/40 to-indigo-900/40 border-b border-white/10 py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold">🎵 Grace Music — Server Setup Wizard</h1>
          <p className="text-zinc-400 text-sm mt-1">Configure your self-hosted instance</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all cursor-pointer ${
                  i === step
                    ? 'bg-violet-600 border-violet-400 scale-110'
                    : i < step
                    ? 'bg-green-600/30 border-green-500 text-green-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                }`}
                onClick={() => i < step && setStep(i)}
                title={s.title}
              >
                {i < step ? '✓' : s.icon}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 sm:w-16 h-0.5 mx-1 ${i < step ? 'bg-green-500/50' : 'bg-zinc-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Message banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl border text-sm ${
            messageType === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
            messageType === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
            'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}>
            {message}
          </div>
        )}

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">🚀 Welcome to Grace Music Setup</h2>
            <p className="text-zinc-400">
              This wizard will help you migrate your Grace Music app to this server. Here's what we'll do:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-zinc-300 text-sm pl-2">
              <li>Import your MongoDB Atlas database to the local MongoDB server</li>
              <li>Configure environment variables (MongoDB URI, API keys, etc.)</li>
              <li>Test the connection and verify your data</li>
              <li>Complete the setup and lock this wizard</li>
            </ol>

            <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-zinc-300">System Info</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-zinc-500">Node.js</div>
                <div className="font-mono text-green-400">{status?.nodeVersion || 'Unknown'}</div>
                <div className="text-zinc-500">MongoDB</div>
                <div className={`font-mono ${status?.mongoStatus === 'connected' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {status?.mongoStatus || 'Unknown'}
                </div>
                <div className="text-zinc-500">.env.local</div>
                <div className="font-mono text-zinc-300">{status?.envExists ? 'Found' : 'Not found'}</div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300">
              <strong>⚠️ Prerequisites:</strong> Before continuing, make sure you have:
              <ul className="list-disc list-inside mt-2 space-y-1 text-amber-200/80">
                <li>MongoDB installed and running on this server</li>
                <li>Your MongoDB Atlas URI and credentials</li>
              </ul>
            </div>

            <button
              onClick={() => { setMessage(''); setStep(1); }}
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-semibold transition-colors"
            >
              Let's Get Started →
            </button>
          </div>
        )}

        {/* Step 1: Database Migration */}
        {step === 1 && (
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">🗄️ Database Migration</h2>
            <p className="text-zinc-400 text-sm">
              Import your MongoDB Atlas data into the local MongoDB. If you've already imported, skip this step.
            </p>

            <div className="bg-zinc-800/50 rounded-xl p-4 space-y-1 text-sm">
              <p className="text-zinc-400">The system will automatically download your data from Atlas and restore it locally.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1 block">Source MongoDB Atlas URI</label>
                <input
                  type="text"
                  value={migration.sourceUri}
                  onChange={(e) => setMigration(m => ({ ...m, sourceUri: e.target.value }))}
                  placeholder="mongodb+srv://user:pass@cluster.mongodb.net/"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-zinc-300 mb-1 block">Source DB Name</label>
                  <input
                    type="text"
                    value={migration.sourceDbName}
                    onChange={(e) => setMigration(m => ({ ...m, sourceDbName: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-300 mb-1 block">Target DB Name (local)</label>
                  <input
                    type="text"
                    value={migration.targetDbName}
                    onChange={(e) => setMigration(m => ({ ...m, targetDbName: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <button
                onClick={migrateDb}
                disabled={actionLoading || !migration.sourceUri || !migration.sourceDbName}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl font-semibold transition-colors"
              >
                {actionLoading ? 'Migrating...' : '🔄 Auto-Migrate Database'}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setMessage(''); setStep(0); }}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => { setMessage(''); setStep(2); }}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-semibold transition-colors"
              >
                Next: Configuration →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Environment Configuration */}
        {step === 2 && (
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">⚙️ Environment Configuration</h2>
            <p className="text-zinc-400 text-sm">
              Configure your environment variables. These will be saved to <code className="bg-zinc-800 px-1 rounded">.env.local</code>.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1 block">MongoDB URI</label>
                <input
                  type="text"
                  value={config.MONGODB_URI}
                  onChange={(e) => setConfig(c => ({ ...c, MONGODB_URI: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500"
                />
                <p className="text-xs text-zinc-500 mt-1">Default: mongodb://localhost:27017</p>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1 block">Database Name</label>
                <input
                  type="text"
                  value={config.MONGODB_DB_NAME}
                  onChange={(e) => setConfig(c => ({ ...c, MONGODB_DB_NAME: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1 flex items-center justify-between">
                  JWT Secret
                  <button
                    onClick={generateJWTSecret}
                    className="text-xs bg-violet-600/20 text-violet-400 px-2 py-0.5 rounded hover:bg-violet-600/30 transition-colors"
                  >
                    🔑 Generate Random
                  </button>
                </label>
                <input
                  type="text"
                  value={config.JWT_SECRET}
                  onChange={(e) => setConfig(c => ({ ...c, JWT_SECRET: e.target.value }))}
                  placeholder="A strong random string..."
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1 block">Google OAuth Client ID</label>
                <input
                  type="text"
                  value={config.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
                  onChange={(e) => setConfig(c => ({ ...c, NEXT_PUBLIC_GOOGLE_CLIENT_ID: e.target.value }))}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  ⚠️ Remember to add <strong>{config.NEXT_PUBLIC_DOMAIN || 'your domain'}</strong> to Google Cloud Console authorized origins!
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1 block">Groq API Key</label>
                <input
                  type="password"
                  value={config.GROQ_API_KEY}
                  onChange={(e) => setConfig(c => ({ ...c, GROQ_API_KEY: e.target.value }))}
                  placeholder="gsk_..."
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1 block">Domain (for Nginx)</label>
                <input
                  type="text"
                  value={config.NEXT_PUBLIC_DOMAIN}
                  onChange={(e) => setConfig(c => ({ ...c, NEXT_PUBLIC_DOMAIN: e.target.value }))}
                  placeholder="graceahmedabad.org"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <button
                onClick={saveEnv}
                disabled={actionLoading}
                className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 rounded-xl font-semibold transition-colors"
              >
                {actionLoading ? 'Saving...' : '💾 Save .env.local'}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setMessage(''); setStep(1); }}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => { setMessage(''); setStep(3); }}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-semibold transition-colors"
              >
                Next: Test & Complete →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Test & Complete */}
        {step === 3 && (
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">✅ Test & Complete</h2>
            <p className="text-zinc-400 text-sm">
              Verify your MongoDB connection and data before finalizing the setup.
            </p>

            <button
              onClick={testMongo}
              disabled={actionLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 rounded-xl font-semibold transition-colors"
            >
              {actionLoading ? 'Testing...' : '🔍 Test MongoDB Connection'}
            </button>

            {testResult && testResult.success && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-green-400">✅ Connection Successful!</h3>
                <div className="space-y-2">
                  <p className="text-xs text-zinc-400">Collections found:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {testResult.collections?.map(name => (
                      <div key={name} className="flex justify-between bg-zinc-900/50 px-3 py-2 rounded-lg text-xs">
                        <span className="text-zinc-300 capitalize">{name}</span>
                        <span className="text-zinc-500 font-mono">{testResult.documentCounts?.[name] || 0} docs</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-200/80 space-y-2">
              <strong className="text-amber-300">Before completing, make sure:</strong>
              <ul className="list-disc list-inside space-y-1">
                <li>MongoDB connection test passed above ✅</li>
                <li>All your collections and data are present</li>
                <li>You've added <strong>https://graceahmedabad.org</strong> to Google OAuth authorized origins</li>
              </ul>
            </div>

            <button
              onClick={completeSetup}
              disabled={actionLoading}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:from-zinc-700 disabled:to-zinc-700 rounded-xl font-bold text-lg transition-all"
            >
              {actionLoading ? 'Completing...' : '🎉 Complete Setup'}
            </button>

            <button
              onClick={() => { setMessage(''); setStep(2); }}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-colors"
            >
              ← Back to Configuration
            </button>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold">Setup Complete!</h2>
            <p className="text-zinc-400">
              Your Grace Music server is configured. This setup wizard is now locked.
            </p>

            <div className="bg-zinc-800/50 rounded-xl p-4 text-left space-y-3 text-sm">
              <h3 className="font-bold text-zinc-300">Next Steps:</h3>
              <ol className="list-decimal list-inside space-y-2 text-zinc-400">
                <li>Restart the server: <code className="bg-zinc-900 px-2 py-0.5 rounded text-green-400">sudo systemctl restart gracemusic</code></li>
                <li>Set up Nginx reverse proxy (see below)</li>
                <li>Set up SSL with Let's Encrypt</li>
              </ol>
            </div>

            <div className="bg-zinc-800/50 rounded-xl p-4 text-left space-y-2 text-sm">
              <h3 className="font-bold text-zinc-300">Nginx Config for graceahmedabad.org:</h3>
              <pre className="bg-transparent text-green-400 p-3 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap">
{`server {
    listen 80;
    server_name graceahmedabad.org www.graceahmedabad.org;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Then run: sudo certbot --nginx -d graceahmedabad.org -d www.graceahmedabad.org`}
              </pre>
            </div>

            <div className="bg-zinc-800/50 rounded-xl p-4 text-left space-y-2 text-sm">
              <h3 className="font-bold text-zinc-300">systemd Service File:</h3>
              <pre className="bg-transparent text-green-400 p-3 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap">
{`# /etc/systemd/system/gracemusic.service
[Unit]
Description=Grace Music App
After=network.target mongod.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/grace-music
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target

# Enable: sudo systemctl enable gracemusic
# Start:  sudo systemctl start gracemusic`}
              </pre>
            </div>

            <a
              href="/"
              className="inline-block w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-semibold transition-colors text-center"
            >
              Go to Grace Music →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

