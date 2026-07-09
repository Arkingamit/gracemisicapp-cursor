module.exports = {
  apps: [
    {
      name: 'grace-music-app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4001',
      instances: 'max', // Must be a string "max", not {max}
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};