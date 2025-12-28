#!/usr/bin/perl

# KLF200 Plugin - Main CGI Interface

use strict;
use warnings;
use CGI;
use CGI::Carp qw(fatalsToBrowser);
use LoxBerry::System;
use LoxBerry::Web;
use LoxBerry::JSON;

my $q = CGI->new;
my $template_title = "Velux KLF-200 MQTT Bridge";
my $helplink = "https://github.com/tschlottke/loxberry-plugin-klf200";

# Config file path
my $cfgfile = "$lbpconfigdir/klf200.json";
my $logfile = "$lbplogdir/klf200.log";

# Get current tab
my $tab = $q->param('tab') || 'settings';

# Handle form submission
if ($q->param('saveconfig')) {
    eval {
        my $json = LoxBerry::JSON->new();
        my $cfg = $json->open(filename => $cfgfile) || {};

        $cfg->{klf200}{host} = $q->param('host') || '';
        $cfg->{klf200}{password} = $q->param('password') || '';
        $cfg->{klf200}{port} = $q->param('port') || 51200;
        $cfg->{mqtt}{topicPrefix} = $q->param('topicPrefix') || 'klf200';
        $cfg->{mqtt}{retain} = $q->param('retain') ? \1 : \0;
        $cfg->{mqtt}{qos} = int($q->param('qos') || 1);
        $cfg->{polling}{enabled} = $q->param('pollingEnabled') ? \1 : \0;
        $cfg->{polling}{interval} = int($q->param('pollingInterval') || 60000);
        $cfg->{logging}{level} = $q->param('logLevel') || 'info';

        $json->write();
    };
}

# Load config
my $cfg = {};
eval {
    my $json = LoxBerry::JSON->new();
    $cfg = $json->open(filename => $cfgfile) || {};
};

# Set defaults
$cfg->{klf200} //= {};
$cfg->{mqtt} //= {};
$cfg->{polling} //= {};
$cfg->{logging} //= {};
$cfg->{klf200}{host} //= '';
$cfg->{klf200}{password} //= '';
$cfg->{klf200}{port} //= 51200;
$cfg->{mqtt}{topicPrefix} //= 'klf200';
$cfg->{mqtt}{retain} //= 1;
$cfg->{mqtt}{qos} //= 1;
$cfg->{polling}{enabled} //= 1;
$cfg->{polling}{interval} //= 60000;
$cfg->{logging}{level} //= 'info';

# Check service status
my $service_status = `systemctl is-active klf200.service 2>/dev/null` || 'unknown';
chomp($service_status);
my $service_running = ($service_status eq 'active') ? 1 : 0;

# Handle service actions
my $action = $q->param('action') || '';
my $action_result = '';
if ($action eq 'start') {
    my $result = `sudo /usr/bin/systemctl start klf200.service 2>&1`;
    sleep(2);
    $action_result = "Service start requested. $result";
} elsif ($action eq 'stop') {
    my $result = `sudo /usr/bin/systemctl stop klf200.service 2>&1`;
    sleep(1);
    $action_result = "Service stopped. $result";
} elsif ($action eq 'restart') {
    my $result = `sudo /usr/bin/systemctl restart klf200.service 2>&1`;
    sleep(2);
    $action_result = "Service restart requested. $result";
}

# Refresh service status after action
if ($action) {
    $service_status = `systemctl is-active klf200.service 2>/dev/null` || 'unknown';
    chomp($service_status);
    $service_running = ($service_status eq 'active') ? 1 : 0;
}

# Print header
LoxBerry::Web::lbheader($template_title, $helplink);

# Build status labels
my $status_class = $service_running ? 'label-success' : 'label-danger';
my $status_text = $service_running ? 'Running' : 'Stopped';

# Build form field values
my $host_val = $cfg->{klf200}{host};
my $password_val = $cfg->{klf200}{password};
my $port_val = $cfg->{klf200}{port};
my $prefix_val = $cfg->{mqtt}{topicPrefix};
my $qos_val = $cfg->{mqtt}{qos};
my $retain_checked = $cfg->{mqtt}{retain} ? 'checked' : '';
my $polling_checked = $cfg->{polling}{enabled} ? 'checked' : '';
my $interval_val = $cfg->{polling}{interval};
my $loglevel_val = $cfg->{logging}{level};

my $qos0_sel = ($qos_val == 0) ? 'selected' : '';
my $qos1_sel = ($qos_val == 1) ? 'selected' : '';
my $qos2_sel = ($qos_val == 2) ? 'selected' : '';

my $log_debug_sel = ($loglevel_val eq 'debug') ? 'selected' : '';
my $log_info_sel = ($loglevel_val eq 'info') ? 'selected' : '';
my $log_warn_sel = ($loglevel_val eq 'warn') ? 'selected' : '';
my $log_error_sel = ($loglevel_val eq 'error') ? 'selected' : '';

my $tab_settings_class = ($tab eq 'settings') ? 'active' : '';
my $tab_logs_class = ($tab eq 'logs') ? 'active' : '';

# Print styles
print qq{
<style>
.form-group { margin-bottom: 15px; }
.form-group label { display: block; font-weight: bold; margin-bottom: 5px; }
.form-group input, .form-group select { width: 100%; max-width: 400px; padding: 8px; }
.btn { padding: 10px 20px; margin-right: 10px; cursor: pointer; border: none; border-radius: 4px; text-decoration: none; display: inline-block; }
.btn-primary { background: #337ab7; color: white; }
.btn-success { background: #5cb85c; color: white; }
.btn-danger { background: #d9534f; color: white; }
.btn-warning { background: #f0ad4e; color: white; }
.btn-info { background: #5bc0de; color: white; }
.panel { border: 1px solid #ddd; margin-bottom: 20px; border-radius: 4px; }
.panel-heading { background: #f5f5f5; padding: 10px 15px; border-bottom: 1px solid #ddd; border-radius: 4px 4px 0 0; }
.panel-heading h3 { margin: 0; }
.panel-body { padding: 15px; }
.label { padding: 3px 8px; border-radius: 3px; font-size: 12px; }
.label-success { background: #5cb85c; color: white; }
.label-danger { background: #d9534f; color: white; }
.tabs { margin-bottom: 20px; border-bottom: 2px solid #ddd; }
.tabs a { display: inline-block; padding: 10px 20px; text-decoration: none; color: #333; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.tabs a.active { border-bottom-color: #337ab7; color: #337ab7; font-weight: bold; }
.tabs a:hover { background: #f5f5f5; }
.log-container { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; max-height: 500px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word; }
.alert { padding: 15px; margin-bottom: 20px; border-radius: 4px; }
.alert-info { background: #d9edf7; border: 1px solid #bce8f1; color: #31708f; }
</style>

<div class="tabs">
    <a href="?tab=settings" class="$tab_settings_class">Settings</a>
    <a href="?tab=logs" class="$tab_logs_class">Logs</a>
</div>
};

if ($action_result) {
    $action_result =~ s/</&lt;/g;
    $action_result =~ s/>/&gt;/g;
    print qq{<div class="alert alert-info">$action_result</div>\n};
}

# Settings tab
if ($tab eq 'settings') {
    print qq{
<form method="post">
<input type="hidden" name="tab" value="settings">

<div class="panel">
    <div class="panel-heading"><h3>Service Status</h3></div>
    <div class="panel-body">
        <p>Status: <span class="label $status_class">$status_text</span></p>
        <p>
            <a href="?tab=settings&action=start" class="btn btn-success">Start</a>
            <a href="?tab=settings&action=stop" class="btn btn-danger">Stop</a>
            <a href="?tab=settings&action=restart" class="btn btn-warning">Restart</a>
        </p>
    </div>
</div>

<div class="panel">
    <div class="panel-heading"><h3>KLF-200 Connection</h3></div>
    <div class="panel-body">
        <div class="form-group">
            <label for="host">KLF-200 IP Address *</label>
            <input type="text" id="host" name="host" value="$host_val" placeholder="192.168.1.100">
        </div>
        <div class="form-group">
            <label for="password">Password *</label>
            <input type="password" id="password" name="password" value="$password_val" placeholder="WiFi password from device label">
            <br><small style="color: #666;">The WiFi password printed on the label on the back of your KLF-200</small>
        </div>
        <div class="form-group">
            <label for="port">Port</label>
            <input type="number" id="port" name="port" value="$port_val" min="1" max="65535">
        </div>
    </div>
</div>

<div class="panel">
    <div class="panel-heading"><h3>MQTT Settings</h3></div>
    <div class="panel-body">
        <div class="form-group">
            <label for="topicPrefix">Topic Prefix</label>
            <input type="text" id="topicPrefix" name="topicPrefix" value="$prefix_val" placeholder="klf200">
            <br><small style="color: #666;">MQTT topics will be: {prefix}/devices/{id}/...</small>
        </div>
        <div class="form-group">
            <label for="qos">QoS Level</label>
            <select id="qos" name="qos">
                <option value="0" $qos0_sel>0 - At most once</option>
                <option value="1" $qos1_sel>1 - At least once</option>
                <option value="2" $qos2_sel>2 - Exactly once</option>
            </select>
        </div>
        <div class="form-group">
            <label><input type="checkbox" name="retain" $retain_checked> Retain messages</label>
        </div>
    </div>
</div>

<div class="panel">
    <div class="panel-heading"><h3>Options</h3></div>
    <div class="panel-body">
        <div class="form-group">
            <label><input type="checkbox" name="pollingEnabled" $polling_checked> Enable state polling</label>
            <br><small style="color: #666;">Periodically query device states from KLF-200</small>
        </div>
        <div class="form-group">
            <label for="pollingInterval">Polling Interval (ms)</label>
            <input type="number" id="pollingInterval" name="pollingInterval" value="$interval_val" min="10000" step="1000">
        </div>
        <div class="form-group">
            <label for="logLevel">Log Level</label>
            <select id="logLevel" name="logLevel">
                <option value="debug" $log_debug_sel>Debug</option>
                <option value="info" $log_info_sel>Info</option>
                <option value="warn" $log_warn_sel>Warning</option>
                <option value="error" $log_error_sel>Error</option>
            </select>
        </div>
    </div>
</div>

<button type="submit" name="saveconfig" value="1" class="btn btn-primary">Save Configuration</button>
</form>
};
}

# Logs tab
if ($tab eq 'logs') {
    # Get journal logs for the service (with sudo)
    my $journal_logs = `sudo /usr/bin/journalctl -u klf200.service -n 100 --no-pager 2>&1` || 'No journal logs available';
    $journal_logs =~ s/</&lt;/g;
    $journal_logs =~ s/>/&gt;/g;

    # Get plugin log file
    my $file_logs = '';
    if (-f $logfile && -r $logfile) {
        $file_logs = `tail -n 200 "$logfile" 2>&1` || '';
        $file_logs =~ s/</&lt;/g;
        $file_logs =~ s/>/&gt;/g;
    } else {
        $file_logs = "Log file not found or not readable: $logfile";
    }

    print qq{
<div class="panel">
    <div class="panel-heading"><h3>Service Status</h3></div>
    <div class="panel-body">
        <p>Status: <span class="label $status_class">$status_text</span></p>
        <p>
            <a href="?tab=logs&action=start" class="btn btn-success">Start</a>
            <a href="?tab=logs&action=stop" class="btn btn-danger">Stop</a>
            <a href="?tab=logs&action=restart" class="btn btn-warning">Restart</a>
            <a href="?tab=logs" class="btn btn-info">Refresh</a>
        </p>
    </div>
</div>

<div class="panel">
    <div class="panel-heading"><h3>System Journal (systemd)</h3></div>
    <div class="panel-body">
        <p><small>Shows output from systemctl/journalctl - useful for startup errors</small></p>
        <div class="log-container">$journal_logs</div>
    </div>
</div>

<div class="panel">
    <div class="panel-heading"><h3>Plugin Log File</h3></div>
    <div class="panel-body">
        <p><small>Log file: $logfile</small></p>
        <div class="log-container">$file_logs</div>
    </div>
</div>
};
}

LoxBerry::Web::lbfooter();
exit 0;
