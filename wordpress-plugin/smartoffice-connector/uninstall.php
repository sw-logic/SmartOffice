<?php
/**
 * SmartOffice Connector — Uninstall.
 *
 * Cleans up all options and transients when the plugin is deleted
 * (not just deactivated).
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

// Remove options
delete_option( 'smartoffice_api_key' );
delete_option( 'smartoffice_admin_user_id' );
delete_option( 'smartoffice_token_expiry' );
delete_option( 'smartoffice_ip_binding' );
delete_option( 'smartoffice_allowed_ips' );
delete_option( 'smartoffice_login_log' );

// Clean up any lingering transients
global $wpdb;
$wpdb->query(
    "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_smartoffice_token_%' OR option_name LIKE '_transient_timeout_smartoffice_token_%'"
);
