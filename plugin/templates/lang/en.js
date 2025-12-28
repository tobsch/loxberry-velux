module.exports = {
  // General
  plugin_title: 'Velux KLF-200 MQTT Bridge',
  save: 'Save',
  cancel: 'Cancel',
  test: 'Test',
  refresh: 'Refresh',

  // Settings
  settings_title: 'Settings',
  klf_connection: 'KLF-200 Connection',
  klf_host: 'KLF-200 IP Address',
  klf_host_help: 'IP address of your KLF-200 gateway',
  klf_password: 'Password',
  klf_password_help: 'Default: WiFi password printed on the KLF-200 label',
  klf_port: 'Port',
  klf_port_help: 'Default: 51200 (usually does not need changing)',
  test_connection: 'Test Connection',

  // MQTT
  mqtt_settings: 'MQTT Settings',
  topic_prefix: 'Topic Prefix',
  topic_prefix_help: 'Prefix for all MQTT topics',
  qos_level: 'QoS Level',
  retain_messages: 'Retain messages',
  retain_messages_help: 'Keep last state on broker for new subscribers',

  // Options
  options_title: 'Options',
  enable_polling: 'Enable state polling',
  polling_interval: 'Polling Interval (ms)',
  polling_interval_help: 'How often to refresh device states',
  auto_discovery: 'Auto-discover devices on startup',
  log_level: 'Log Level',

  // Service
  service_control: 'Service Control',
  service_status: 'Service Status',
  service_running: 'Running',
  service_stopped: 'Stopped',
  start_service: 'Start',
  stop_service: 'Stop',
  restart_service: 'Restart',

  // Devices
  devices_title: 'Devices',
  discovered_devices: 'Discovered Devices',
  no_devices: 'No devices discovered yet',
  node_id: 'Node ID',
  device_name: 'Name',
  device_type: 'Type',
  position: 'Position',
  status: 'Status',
  last_update: 'Last Update',
  actions: 'Actions',
  moving: 'Moving',
  online: 'Online',
  offline: 'Offline',
  open: 'Open',
  close: 'Close',
  stop: 'Stop',

  // Messages
  config_saved: 'Configuration saved successfully',
  config_save_failed: 'Failed to save configuration',
  connection_success: 'Connection successful!',
  connection_failed: 'Connection failed'
};
