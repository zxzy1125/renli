module.exports = {
  apps: [{
    name: 'recruit-api',
    script: 'npx',
    args: 'tsx server/src/index.ts',
    cwd: '/opt/recruit-tool',
    env: {
      NODE_ENV: 'production',
      PORT: '3002',
      JWT_SECRET: 'recruit-jwt-' + require('crypto').randomBytes(32).toString('hex')
    },
    max_memory_restart: '512M',
    error_file: '/opt/recruit-tool/logs/error.log',
    out_file: '/opt/recruit-tool/logs/out.log',
    merge_logs: true,
    autorestart: true,
    watch: false
  }]
};
