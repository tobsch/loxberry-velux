module.exports = {
  // Allgemein
  plugin_title: 'Velux KLF-200 MQTT Bridge',
  save: 'Speichern',
  cancel: 'Abbrechen',
  test: 'Testen',
  refresh: 'Aktualisieren',

  // Einstellungen
  settings_title: 'Einstellungen',
  klf_connection: 'KLF-200 Verbindung',
  klf_host: 'KLF-200 IP-Adresse',
  klf_host_help: 'IP-Adresse Ihres KLF-200 Gateways',
  klf_password: 'Passwort',
  klf_password_help: 'Standard: WLAN-Passwort auf dem KLF-200 Aufkleber',
  klf_port: 'Port',
  klf_port_help: 'Standard: 51200 (muss normalerweise nicht geändert werden)',
  test_connection: 'Verbindung testen',

  // MQTT
  mqtt_settings: 'MQTT Einstellungen',
  topic_prefix: 'Topic-Präfix',
  topic_prefix_help: 'Präfix für alle MQTT Topics',
  qos_level: 'QoS Stufe',
  retain_messages: 'Nachrichten behalten',
  retain_messages_help: 'Letzten Status für neue Abonnenten speichern',

  // Optionen
  options_title: 'Optionen',
  enable_polling: 'Status-Abfrage aktivieren',
  polling_interval: 'Abfrage-Intervall (ms)',
  polling_interval_help: 'Wie oft der Gerätestatus abgefragt wird',
  auto_discovery: 'Geräte automatisch beim Start erkennen',
  log_level: 'Log-Level',

  // Dienst
  service_control: 'Dienst-Steuerung',
  service_status: 'Dienst-Status',
  service_running: 'Läuft',
  service_stopped: 'Gestoppt',
  start_service: 'Starten',
  stop_service: 'Stoppen',
  restart_service: 'Neustarten',

  // Geräte
  devices_title: 'Geräte',
  discovered_devices: 'Erkannte Geräte',
  no_devices: 'Noch keine Geräte erkannt',
  node_id: 'Node ID',
  device_name: 'Name',
  device_type: 'Typ',
  position: 'Position',
  status: 'Status',
  last_update: 'Letzte Aktualisierung',
  actions: 'Aktionen',
  moving: 'In Bewegung',
  online: 'Online',
  offline: 'Offline',
  open: 'Öffnen',
  close: 'Schließen',
  stop: 'Stopp',

  // Nachrichten
  config_saved: 'Konfiguration erfolgreich gespeichert',
  config_save_failed: 'Konfiguration konnte nicht gespeichert werden',
  connection_success: 'Verbindung erfolgreich!',
  connection_failed: 'Verbindung fehlgeschlagen'
};
