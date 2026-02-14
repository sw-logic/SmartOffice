<?php
/**
 * SmartOffice Connector — REST API endpoints.
 *
 * Endpoints:
 *   GET  /wp-json/smartoffice/v1/health
 *   GET  /wp-json/smartoffice/v1/plugins
 *   GET  /wp-json/smartoffice/v1/themes
 *   GET  /wp-json/smartoffice/v1/core
 *   GET  /wp-json/smartoffice/v1/overview     (all-in-one summary)
 *   POST /wp-json/smartoffice/v1/auth/token   (generate auto-login token)
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class SmartOffice_REST_API {

    const NAMESPACE = 'smartoffice/v1';

    /**
     * Register all routes.
     */
    public function register_routes() {
        register_rest_route( self::NAMESPACE, '/health', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_health' ],
            'permission_callback' => [ $this, 'verify_api_key' ],
        ] );

        register_rest_route( self::NAMESPACE, '/plugins', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_plugins' ],
            'permission_callback' => [ $this, 'verify_api_key' ],
        ] );

        register_rest_route( self::NAMESPACE, '/themes', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_themes' ],
            'permission_callback' => [ $this, 'verify_api_key' ],
        ] );

        register_rest_route( self::NAMESPACE, '/core', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_core' ],
            'permission_callback' => [ $this, 'verify_api_key' ],
        ] );

        register_rest_route( self::NAMESPACE, '/overview', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'get_overview' ],
            'permission_callback' => [ $this, 'verify_api_key' ],
        ] );

        register_rest_route( self::NAMESPACE, '/auth/token', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'create_login_token' ],
            'permission_callback' => [ $this, 'verify_api_key' ],
        ] );
    }

    // ──────────────────────────────────────────────
    //  Authentication
    // ──────────────────────────────────────────────

    /**
     * Verify the X-SmartOffice-Key header (or Bearer token) against stored API key.
     */
    public function verify_api_key( WP_REST_Request $request ): bool {
        $stored_key = get_option( 'smartoffice_api_key', '' );
        if ( empty( $stored_key ) ) {
            return false;
        }

        // Check allowed IPs
        $allowed_ips = get_option( 'smartoffice_allowed_ips', '' );
        if ( ! empty( $allowed_ips ) ) {
            $ip_list    = array_filter( array_map( 'trim', explode( "\n", $allowed_ips ) ) );
            $request_ip = self::get_client_ip();
            if ( ! empty( $ip_list ) && ! in_array( $request_ip, $ip_list, true ) ) {
                return false;
            }
        }

        // Accept via custom header or Bearer token
        $key = $request->get_header( 'X-SmartOffice-Key' );
        if ( empty( $key ) ) {
            $auth = $request->get_header( 'Authorization' );
            if ( $auth && str_starts_with( $auth, 'Bearer ' ) ) {
                $key = substr( $auth, 7 );
            }
        }

        return hash_equals( $stored_key, (string) $key );
    }

    // ──────────────────────────────────────────────
    //  Endpoints
    // ──────────────────────────────────────────────

    /**
     * GET /health — Site Health summary.
     */
    public function get_health(): WP_REST_Response {
        if ( ! class_exists( 'WP_Site_Health' ) ) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-site-health.php';
        }

        $health = WP_Site_Health::get_instance();

        $tests  = WP_Site_Health::get_tests();
        $results = [
            'good'        => 0,
            'recommended' => 0,
            'critical'    => 0,
        ];
        $issues = [];

        // 1. Run direct (synchronous) tests
        foreach ( $tests['direct'] as $test ) {
            $callback = $test['test'];
            // WP stores test names as strings — resolve to WP_Site_Health method
            if ( is_string( $callback ) && method_exists( $health, 'get_test_' . $callback ) ) {
                $callback = [ $health, 'get_test_' . $callback ];
            }
            if ( is_callable( $callback ) ) {
                try {
                    $result = call_user_func( $callback );
                    if ( isset( $result['status'] ) ) {
                        $status = $result['status'];
                        if ( isset( $results[ $status ] ) ) {
                            $results[ $status ]++;
                        }
                        if ( $status !== 'good' ) {
                            $issues[] = [
                                'label'  => $result['label'] ?? $test['label'] ?? '',
                                'status' => $status,
                                'badge'  => $result['badge']['label'] ?? '',
                            ];
                        }
                    }
                } catch ( \Throwable $e ) {
                    // Skip failing tests
                }
            }
        }

        // 2. Include cached async test results (stored by WP Site Health in wp-admin)
        $async_results = get_transient( 'health-check-site-status-result' );
        if ( $async_results ) {
            $async_data = is_string( $async_results ) ? json_decode( $async_results, true ) : $async_results;
            if ( is_array( $async_data ) ) {
                // WP stores counts: {"good": N, "recommended": N, "critical": N}
                if ( isset( $async_data['good'] ) && ! is_array( $async_data['good'] ) ) {
                    $results['good']        += (int) ( $async_data['good'] ?? 0 );
                    $results['recommended'] += (int) ( $async_data['recommended'] ?? 0 );
                    $results['critical']    += (int) ( $async_data['critical'] ?? 0 );
                } else {
                    // Fallback: array of individual test results
                    foreach ( $async_data as $result ) {
                        if ( isset( $result['status'] ) ) {
                            $status = $result['status'];
                            if ( isset( $results[ $status ] ) ) {
                                $results[ $status ]++;
                            }
                            if ( $status !== 'good' ) {
                                $issues[] = [
                                    'label'  => $result['label'] ?? '',
                                    'status' => $status,
                                    'badge'  => $result['badge']['label'] ?? '',
                                ];
                            }
                        }
                    }
                }
            }
        }

        $total = $results['good'] + $results['recommended'] + $results['critical'];

        if ( $results['critical'] > 0 ) {
            $overall = 'critical';
        } elseif ( $results['recommended'] > 0 ) {
            $overall = 'should_improve';
        } else {
            $overall = 'good';
        }

        return new WP_REST_Response( [
            'status'      => $overall,
            'score'       => $total > 0 ? round( ( $results['good'] / $total ) * 100 ) : 0,
            'counts'      => $results,
            'issues'      => $issues,
            'php_version' => phpversion(),
            'wp_version'  => get_bloginfo( 'version' ),
            'server'      => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
            'checked_at'  => gmdate( 'c' ),
        ], 200 );
    }

    /**
     * GET /plugins — Installed plugins with update status.
     */
    public function get_plugins(): WP_REST_Response {
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if ( ! function_exists( 'get_plugin_updates' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }

        wp_update_plugins();
        $all_plugins = get_plugins();
        $updates     = get_plugin_updates();
        $active      = get_option( 'active_plugins', [] );

        $plugins = [];
        foreach ( $all_plugins as $file => $data ) {
            $has_update  = isset( $updates[ $file ] );
            $new_version = $has_update ? $updates[ $file ]->update->new_version : null;

            $plugins[] = [
                'file'        => $file,
                'name'        => $data['Name'],
                'version'     => $data['Version'],
                'author'      => wp_strip_all_tags( $data['Author'] ?? '' ),
                'active'      => in_array( $file, $active, true ),
                'update'      => $has_update,
                'new_version' => $new_version,
            ];
        }

        $update_count = count( array_filter( $plugins, fn( $p ) => $p['update'] ) );

        return new WP_REST_Response( [
            'total'        => count( $plugins ),
            'active'       => count( array_filter( $plugins, fn( $p ) => $p['active'] ) ),
            'updates'      => $update_count,
            'plugins'      => $plugins,
            'checked_at'   => gmdate( 'c' ),
        ], 200 );
    }

    /**
     * GET /themes — Installed themes with update status.
     */
    public function get_themes(): WP_REST_Response {
        if ( ! function_exists( 'get_theme_updates' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }

        wp_update_themes();
        $all_themes   = wp_get_themes();
        $updates      = get_theme_updates();
        $active_theme = get_stylesheet();

        $themes = [];
        foreach ( $all_themes as $slug => $theme ) {
            $has_update  = isset( $updates[ $slug ] );
            $new_version = $has_update ? $updates[ $slug ]->update['new_version'] : null;

            $themes[] = [
                'slug'        => $slug,
                'name'        => $theme->get( 'Name' ),
                'version'     => $theme->get( 'Version' ),
                'active'      => ( $slug === $active_theme ),
                'update'      => $has_update,
                'new_version' => $new_version,
            ];
        }

        return new WP_REST_Response( [
            'total'      => count( $themes ),
            'updates'    => count( array_filter( $themes, fn( $t ) => $t['update'] ) ),
            'themes'     => $themes,
            'checked_at' => gmdate( 'c' ),
        ], 200 );
    }

    /**
     * GET /core — WordPress core version and update status.
     */
    public function get_core(): WP_REST_Response {
        if ( ! function_exists( 'get_preferred_from_update_core' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }

        wp_version_check();
        $update = get_preferred_from_update_core();

        $current_version = get_bloginfo( 'version' );
        $has_update      = ( $update && isset( $update->current ) && version_compare( $update->current, $current_version, '>' ) );

        // Disk usage
        $upload_dir = wp_upload_dir();
        $upload_size = $this->directory_size( $upload_dir['basedir'] );

        global $wpdb;
        $db_size = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT SUM(data_length + index_length) FROM information_schema.TABLES WHERE table_schema = %s",
                DB_NAME
            )
        );

        return new WP_REST_Response( [
            'version'        => $current_version,
            'update'         => $has_update,
            'latest_version' => $has_update ? $update->current : $current_version,
            'php_version'    => phpversion(),
            'mysql_version'  => $wpdb->db_version(),
            'server'         => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
            'multisite'      => is_multisite(),
            'site_url'       => get_site_url(),
            'home_url'       => get_home_url(),
            'upload_size'    => (int) $upload_size,
            'upload_size_hr' => size_format( $upload_size ),
            'db_size'        => (int) $db_size,
            'db_size_hr'     => size_format( $db_size ),
            'active_plugins' => count( get_option( 'active_plugins', [] ) ),
            'users'          => count_users(),
            'checked_at'     => gmdate( 'c' ),
        ], 200 );
    }

    /**
     * GET /overview — All-in-one summary for dashboard display.
     */
    public function get_overview(): WP_REST_Response {
        // Quick versions without full health tests
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if ( ! function_exists( 'get_plugin_updates' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }

        wp_update_plugins();
        wp_update_themes();

        $plugin_updates = get_plugin_updates();
        $theme_updates  = get_theme_updates();

        wp_version_check();
        $core_update     = get_preferred_from_update_core();
        $current_version = get_bloginfo( 'version' );
        $has_core_update = ( $core_update && isset( $core_update->current ) && version_compare( $core_update->current, $current_version, '>' ) );

        $total_updates = count( $plugin_updates ) + count( $theme_updates ) + ( $has_core_update ? 1 : 0 );

        if ( $total_updates === 0 ) {
            $status = 'good';
        } elseif ( $has_core_update || $total_updates > 3 ) {
            $status = 'critical';
        } else {
            $status = 'should_improve';
        }

        return new WP_REST_Response( [
            'status'         => $status,
            'wp_version'     => $current_version,
            'php_version'    => phpversion(),
            'core_update'    => $has_core_update,
            'plugin_updates' => count( $plugin_updates ),
            'theme_updates'  => count( $theme_updates ),
            'total_updates'  => $total_updates,
            'active_plugins' => count( get_option( 'active_plugins', [] ) ),
            'site_url'       => get_site_url(),
            'checked_at'     => gmdate( 'c' ),
        ], 200 );
    }

    /**
     * POST /auth/token — Generate a one-time auto-login token.
     */
    public function create_login_token( WP_REST_Request $request ): WP_REST_Response {
        $admin_user_id = (int) get_option( 'smartoffice_admin_user_id', 1 );
        $user          = get_user_by( 'id', $admin_user_id );

        if ( ! $user || ! user_can( $user, 'manage_options' ) ) {
            return new WP_REST_Response( [
                'error' => 'Configured admin user does not exist or lacks permissions.',
            ], 500 );
        }

        $token     = bin2hex( random_bytes( 32 ) ); // 64 chars
        $expiry    = (int) get_option( 'smartoffice_token_expiry', 30 );
        $requester = sanitize_text_field( $request->get_param( 'requester' ) ?? 'Unknown' );

        $token_data = [
            'user_id'    => $admin_user_id,
            'requester'  => $requester,
            'ip'         => self::get_client_ip(),
            'created_at' => time(),
        ];

        set_transient( 'smartoffice_token_' . $token, $token_data, $expiry );

        return new WP_REST_Response( [
            'token'      => $token,
            'login_url'  => add_query_arg( 'smartoffice_login', $token, home_url( '/' ) ),
            'expires_in' => $expiry,
        ], 200 );
    }

    // ──────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────

    /**
     * Get client IP, respecting proxy headers.
     */
    public static function get_client_ip(): string {
        foreach ( [ 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR' ] as $header ) {
            if ( ! empty( $_SERVER[ $header ] ) ) {
                // X-Forwarded-For can contain multiple IPs, take the first
                $ip = explode( ',', sanitize_text_field( $_SERVER[ $header ] ) )[0];
                return trim( $ip );
            }
        }
        return '0.0.0.0';
    }

    /**
     * Calculate directory size recursively.
     */
    private function directory_size( string $dir ): int {
        $size = 0;
        if ( ! is_dir( $dir ) ) {
            return 0;
        }
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator( $dir, RecursiveDirectoryIterator::SKIP_DOTS ),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ( $iterator as $file ) {
            if ( $file->isFile() ) {
                $size += $file->getSize();
            }
        }
        return $size;
    }
}
