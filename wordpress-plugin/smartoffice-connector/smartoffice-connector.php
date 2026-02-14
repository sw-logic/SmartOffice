<?php
/**
 * Plugin Name: SmartOffice Connector
 * Plugin URI:  https://github.com/sw-logic/smartoffice-connector
 * Description: Connects WordPress sites to SmartOffice for remote monitoring, health checks, and secure auto-login.
 * Version:     1.0.5
 * Author:      SmartOffice
 * License:     GPL-2.0-or-later
 * Text Domain: smartoffice-connector
 * Requires at least: 5.6
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'SMARTOFFICE_CONNECTOR_VERSION', '1.0.5' );
define( 'SMARTOFFICE_CONNECTOR_FILE', __FILE__ );
define( 'SMARTOFFICE_CONNECTOR_DIR', plugin_dir_path( __FILE__ ) );

require_once SMARTOFFICE_CONNECTOR_DIR . 'includes/class-settings.php';
require_once SMARTOFFICE_CONNECTOR_DIR . 'includes/class-rest-api.php';
require_once SMARTOFFICE_CONNECTOR_DIR . 'includes/class-auto-login.php';
require_once SMARTOFFICE_CONNECTOR_DIR . 'includes/class-updater.php';

/**
 * Initialize the plugin.
 */
function smartoffice_connector_init() {
    SmartOffice_Settings::init();
    SmartOffice_Auto_Login::init();
    SmartOffice_Updater::init();
}
add_action( 'init', 'smartoffice_connector_init', 1 );

/**
 * Register REST API routes.
 */
function smartoffice_connector_rest_init() {
    $api = new SmartOffice_REST_API();
    $api->register_routes();
}
add_action( 'rest_api_init', 'smartoffice_connector_rest_init' );

/**
 * On activation, generate a default API key if none exists.
 */
function smartoffice_connector_activate() {
    if ( ! get_option( 'smartoffice_api_key' ) ) {
        update_option( 'smartoffice_api_key', wp_generate_password( 48, false ) );
    }
    if ( ! get_option( 'smartoffice_admin_user_id' ) ) {
        // Default to the first administrator
        $admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'orderby' => 'ID' ] );
        if ( ! empty( $admins ) ) {
            update_option( 'smartoffice_admin_user_id', $admins[0]->ID );
        }
    }
    // Default settings
    if ( get_option( 'smartoffice_token_expiry' ) === false ) {
        update_option( 'smartoffice_token_expiry', 30 );
    }
    if ( get_option( 'smartoffice_ip_binding' ) === false ) {
        update_option( 'smartoffice_ip_binding', 'yes' );
    }
}
register_activation_hook( __FILE__, 'smartoffice_connector_activate' );
