module.exports = {
  apps: [
    {
      name: "grace-music-app",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1, // Change to "max" to utilize all CPU cores in cluster mode
      exec_mode: "fork", // Change to "cluster" if instances is > 1
      env: {
        NODE_ENV: "production",
        PORT: 4001,
      },
    },
  ],
};
