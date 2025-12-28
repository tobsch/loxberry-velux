/**
 * KLF200 Plugin - Express Routes (Authenticated)
 *
 * Provides the web UI for plugin configuration and device management.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Configuration paths
const LBPCONFIG = process.env.LBPCONFIG || '/opt/loxberry/config/plugins/klf200';
const LBPDATA = process.env.LBPDATA || '/opt/loxberry/data/plugins/klf200';
const LBPLOG = process.env.LBPLOG || '/opt/loxberry/log/plugins/klf200';
const CONFIG_FILE = path.join(LBPCONFIG, 'klf200.json');
const DEVICES_FILE = path.join(LBPDATA, 'devices.json');

module.exports = ({ router, logger, translate }) => {

  /**
   * Load configuration from file
   */
  function loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      }
    } catch (error) {
      logger.error('Failed to load config', error);
    }
    return getDefaultConfig();
  }

  /**
   * Save configuration to file
   */
  function saveConfig(config) {
    try {
      const configDir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
      return true;
    } catch (error) {
      logger.error('Failed to save config', error);
      return false;
    }
  }

  /**
   * Load devices from cache
   */
  function loadDevices() {
    try {
      if (fs.existsSync(DEVICES_FILE)) {
        const data = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
        return data.devices || {};
      }
    } catch (error) {
      logger.error('Failed to load devices', error);
    }
    return {};
  }

  /**
   * Get service status
   */
  function getServiceStatus() {
    try {
      const result = execSync('systemctl is-active klf200.service 2>/dev/null || echo inactive', {
        encoding: 'utf8'
      }).trim();
      return result === 'active';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get default configuration
   */
  function getDefaultConfig() {
    return {
      klf200: {
        host: '',
        password: '',
        port: 51200,
        keepaliveInterval: 600000,
        reconnectBaseDelay: 5000,
        reconnectMaxDelay: 300000
      },
      mqtt: {
        topicPrefix: 'klf200',
        retain: true,
        qos: 1
      },
      polling: {
        enabled: true,
        interval: 60000
      },
      features: {
        autoDiscovery: true,
        publishOnStartup: true
      },
      logging: {
        level: 'info',
        maxFiles: 5,
        maxSize: '10m'
      }
    };
  }

  /**
   * Main settings page
   */
  router.get('/', (req, res) => {
    const config = loadConfig();
    const serviceRunning = getServiceStatus();

    res.render('settings', {
      title: 'KLF200 - Settings',
      config: config,
      serviceRunning: serviceRunning,
      host: config.klf200?.host || '',
      password: config.klf200?.password || '',
      port: config.klf200?.port || 51200,
      topicPrefix: config.mqtt?.topicPrefix || 'klf200',
      retain: config.mqtt?.retain !== false,
      qos: config.mqtt?.qos || 1,
      pollingEnabled: config.polling?.enabled !== false,
      pollingInterval: config.polling?.interval || 60000,
      autoDiscovery: config.features?.autoDiscovery !== false,
      logLevel: config.logging?.level || 'info'
    });
  });

  /**
   * Save configuration
   */
  router.post('/config', (req, res) => {
    const body = req.body;

    const config = {
      klf200: {
        host: body.host || '',
        password: body.password || '',
        port: parseInt(body.port, 10) || 51200,
        tlsFingerprint: null,
        connectionTimeout: 10000,
        keepaliveInterval: 600000,
        reconnectBaseDelay: 5000,
        reconnectMaxDelay: 300000
      },
      mqtt: {
        topicPrefix: body.topicPrefix || 'klf200',
        retain: body.retain === 'on' || body.retain === true,
        qos: parseInt(body.qos, 10) || 1
      },
      polling: {
        enabled: body.pollingEnabled === 'on' || body.pollingEnabled === true,
        interval: parseInt(body.pollingInterval, 10) || 60000
      },
      features: {
        autoDiscovery: body.autoDiscovery === 'on' || body.autoDiscovery === true,
        publishOnStartup: true,
        homeAssistantDiscovery: false
      },
      logging: {
        level: body.logLevel || 'info',
        maxFiles: 5,
        maxSize: '10m'
      }
    };

    if (saveConfig(config)) {
      res.json({ success: true, message: 'Configuration saved' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to save configuration' });
    }
  });

  /**
   * Devices page
   */
  router.get('/devices', (req, res) => {
    const devices = loadDevices();
    const deviceList = Object.values(devices).map(device => ({
      ...device,
      lastUpdate: device.lastUpdate ? new Date(device.lastUpdate).toLocaleString() : 'Unknown'
    }));

    res.render('devices', {
      title: 'KLF200 - Devices',
      devices: deviceList,
      deviceCount: deviceList.length
    });
  });

  /**
   * Get service status
   */
  router.get('/status', (req, res) => {
    const running = getServiceStatus();
    const devices = loadDevices();
    const deviceCount = Object.keys(devices).length;

    res.json({
      running: running,
      deviceCount: deviceCount
    });
  });

  /**
   * Start service
   */
  router.post('/service/start', (req, res) => {
    try {
      execSync('sudo systemctl start klf200.service');
      res.json({ success: true, message: 'Service started' });
    } catch (error) {
      logger.error('Failed to start service', error);
      res.status(500).json({ success: false, message: 'Failed to start service' });
    }
  });

  /**
   * Stop service
   */
  router.post('/service/stop', (req, res) => {
    try {
      execSync('sudo systemctl stop klf200.service');
      res.json({ success: true, message: 'Service stopped' });
    } catch (error) {
      logger.error('Failed to stop service', error);
      res.status(500).json({ success: false, message: 'Failed to stop service' });
    }
  });

  /**
   * Restart service
   */
  router.post('/service/restart', (req, res) => {
    try {
      execSync('sudo systemctl restart klf200.service');
      res.json({ success: true, message: 'Service restarted' });
    } catch (error) {
      logger.error('Failed to restart service', error);
      res.status(500).json({ success: false, message: 'Failed to restart service' });
    }
  });

  /**
   * Test connection to KLF-200
   */
  router.post('/test', async (req, res) => {
    const { host, password } = req.body;

    if (!host || !password) {
      return res.status(400).json({
        success: false,
        message: 'Host and password are required'
      });
    }

    try {
      // Try to connect using the klf-200-api
      const { Connection } = require('klf-200-api');
      const connection = new Connection(host, password, true);

      await connection.loginAsync(password);
      await connection.logoutAsync();

      res.json({
        success: true,
        message: 'Connection successful!'
      });
    } catch (error) {
      logger.error('Connection test failed', error);
      res.json({
        success: false,
        message: `Connection failed: ${error.message}`
      });
    }
  });

  /**
   * Get logs
   */
  router.get('/logs', (req, res) => {
    const logFile = path.join(LBPLOG, 'klf200.log');
    const lines = parseInt(req.query.lines, 10) || 100;

    try {
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        const logLines = content.split('\n').slice(-lines).join('\n');
        res.json({ success: true, logs: logLines });
      } else {
        res.json({ success: true, logs: 'No log file found.' });
      }
    } catch (error) {
      logger.error('Failed to read logs', error);
      res.status(500).json({ success: false, message: 'Failed to read logs' });
    }
  });

  return router;
};
