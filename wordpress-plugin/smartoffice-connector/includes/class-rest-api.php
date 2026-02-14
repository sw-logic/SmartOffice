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
 *   POST /wp-json/smartoffice/v1/plugins/update  (update one or all plugins)
 *   POST /wp-json/smartoffice/v1/themes/update   (update one or all themes)
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

        register_rest_route( self::NAMESPACE, '/plugins/update', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'update_plugins' ],
            'permission_callback' => [ $this, 'verify_api_key' ],
        ] );

        register_rest_route( self::NAMESPACE, '/themes/update', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'update_themes' ],
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
        // Load admin includes needed by health tests
        if ( ! class_exists( 'WP_Site_Health' ) ) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-site-health.php';
        }
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if ( ! function_exists( 'get_plugin_updates' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }
        if ( ! function_exists( 'got_url_rewrite' ) ) {
            require_once ABSPATH . 'wp-admin/includes/misc.php';
        }
        if ( ! function_exists( 'submit_button' ) ) {
            require_once ABSPATH . 'wp-admin/includes/template.php';
        }

        $health = WP_Site_Health::get_instance();
        $tests  = WP_Site_Health::get_tests();
        $results = [
            'good'        => 0,
            'recommended' => 0,
            'critical'    => 0,
        ];
        $issues  = [];
        $skipped = [];

        // Helper: record a test result
        $record = function ( array $result, string $fallback_label = '' ) use ( &$results, &$issues ) {
            if ( ! isset( $result['status'] ) ) {
                return false;
            }
            $status = $result['status'];
            if ( isset( $results[ $status ] ) ) {
                $results[ $status ]++;
            }
            $issues[] = [
                'label'  => $result['label'] ?? $fallback_label,
                'status' => $status,
                'badge'  => $result['badge']['label'] ?? '',
            ];
            return true;
        };

        // Helper: try to resolve and run a test callback
        $run_test = function ( array $test ) use ( $health, $record, &$skipped ): bool {
            // 1. async_direct_test callable (WP 6.1+)
            if ( ! empty( $test['async_direct_test'] ) && is_callable( $test['async_direct_test'] ) ) {
                try {
                    $r = call_user_func( $test['async_direct_test'] );
                    if ( is_array( $r ) && $record( $r, $test['label'] ?? '' ) ) {
                        return true;
                    }
                } catch ( \Throwable $e ) {
                    // Fall through
                }
            }

            // 2. String test name → resolve to WP_Site_Health::get_test_{name}()
            $callback = $test['test'] ?? null;
            if ( is_string( $callback ) ) {
                $test_name = $callback;
                if ( strpos( $test_name, '/' ) !== false ) {
                    $test_name = str_replace( '-', '_', basename( $test_name ) );
                }
                if ( method_exists( $health, 'get_test_' . $test_name ) ) {
                    try {
                        $r = call_user_func( [ $health, 'get_test_' . $test_name ] );
                        if ( is_array( $r ) && $record( $r, $test['label'] ?? '' ) ) {
                            return true;
                        }
                    } catch ( \Throwable $e ) {
                        // Fall through
                    }
                }
            }

            // 3. Already a callable
            if ( isset( $test['test'] ) && is_callable( $test['test'] ) ) {
                try {
                    $r = call_user_func( $test['test'] );
                    if ( is_array( $r ) && $record( $r, $test['label'] ?? '' ) ) {
                        return true;
                    }
                } catch ( \Throwable $e ) {
                    // Fall through
                }
            }

            // 4. Internal REST dispatch for async tests with REST routes
            if ( ! empty( $test['has_rest'] ) && ! empty( $test['test'] ) && is_string( $test['test'] ) ) {
                $rest_url  = $test['test'];
                $rest_base = rest_url();
                $rest_path = $rest_url;
                if ( strpos( $rest_url, $rest_base ) === 0 ) {
                    $rest_path = '/' . substr( $rest_url, strlen( $rest_base ) );
                }
                try {
                    $request  = new WP_REST_Request( 'GET', $rest_path );
                    $response = rest_do_request( $request );
                    if ( ! $response->is_error() ) {
                        $data = $response->get_data();
                        if ( is_array( $data ) && $record( $data, $test['label'] ?? '' ) ) {
                            return true;
                        }
                    }
                } catch ( \Throwable $e ) {
                    // Fall through
                }
            }

            $skipped[] = $test['label'] ?? 'unknown';
            return false;
        };

        // Run all tests (direct + async)
        $all_tests = array_merge( $tests['direct'] ?? [], $tests['async'] ?? [] );
        foreach ( $all_tests as $test ) {
            $run_test( $test );
        }

        // Fallback — if cached transient has higher counts, use those
        // This catches tests we couldn't run (custom plugin tests, missing context, etc.)
        $cached = get_transient( 'health-check-site-status-result' );
        if ( $cached ) {
            $cached_data = is_string( $cached ) ? json_decode( $cached, true ) : $cached;
            if ( is_array( $cached_data ) && isset( $cached_data['good'] ) && ! is_array( $cached_data['good'] ) ) {
                $results['good']        = max( $results['good'],        (int) ( $cached_data['good'] ?? 0 ) );
                $results['recommended'] = max( $results['recommended'], (int) ( $cached_data['recommended'] ?? 0 ) );
                $results['critical']    = max( $results['critical'],    (int) ( $cached_data['critical'] ?? 0 ) );
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
            'skipped'     => $skipped,
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
    //  Remote Updates
    // ──────────────────────────────────────────────

    /**
     * POST /plugins/update — Update one or all plugins.
     *
     * Body: { "plugins": ["akismet/akismet.php", ...] } or { "all": true }
     */
    public function update_plugins( WP_REST_Request $request ): WP_REST_Response {
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        require_once ABSPATH . 'wp-admin/includes/update.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';

        wp_update_plugins();
        $updates = get_plugin_updates();

        $update_all = $request->get_param( 'all' );
        $requested  = $request->get_param( 'plugins' );

        if ( $update_all ) {
            $to_update = array_keys( $updates );
        } elseif ( is_array( $requested ) && ! empty( $requested ) ) {
            // Only update plugins that actually have updates available
            $to_update = array_intersect( $requested, array_keys( $updates ) );
        } else {
            return new WP_REST_Response( [
                'error' => 'Provide "plugins" array or "all": true.',
            ], 400 );
        }

        if ( empty( $to_update ) ) {
            return new WP_REST_Response( [
                'updated' => 0,
                'failed'  => 0,
                'results' => [],
                'message' => 'No plugins need updating.',
            ], 200 );
        }

        $skin     = new Automatic_Upgrader_Skin();
        $upgrader = new Plugin_Upgrader( $skin );
        $results  = [];
        $updated  = 0;
        $failed   = 0;

        foreach ( $to_update as $plugin_file ) {
            $plugin_data = get_plugin_data( WP_PLUGIN_DIR . '/' . $plugin_file );
            $result      = $upgrader->upgrade( $plugin_file );

            if ( $result === true || ! is_wp_error( $result ) ) {
                // Re-read plugin data to get new version
                $new_data = get_plugin_data( WP_PLUGIN_DIR . '/' . $plugin_file );
                $results[] = [
                    'file'        => $plugin_file,
                    'name'        => $plugin_data['Name'],
                    'success'     => true,
                    'new_version' => $new_data['Version'],
                ];
                $updated++;
            } else {
                $error_msg = is_wp_error( $result ) ? $result->get_error_message() : 'Unknown error';
                $results[] = [
                    'file'    => $plugin_file,
                    'name'    => $plugin_data['Name'],
                    'success' => false,
                    'error'   => $error_msg,
                ];
                $failed++;
            }
        }

        // Clear update transient so next check is fresh
        delete_site_transient( 'update_plugins' );

        return new WP_REST_Response( [
            'updated' => $updated,
            'failed'  => $failed,
            'results' => $results,
        ], 200 );
    }

    /**
     * POST /themes/update — Update one or all themes.
     *
     * Body: { "themes": ["theme-slug", ...] } or { "all": true }
     */
    public function update_themes( WP_REST_Request $request ): WP_REST_Response {
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        require_once ABSPATH . 'wp-admin/includes/update.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';

        wp_update_themes();
        $updates = get_theme_updates();

        $update_all = $request->get_param( 'all' );
        $requested  = $request->get_param( 'themes' );

        if ( $update_all ) {
            $to_update = array_keys( $updates );
        } elseif ( is_array( $requested ) && ! empty( $requested ) ) {
            $to_update = array_intersect( $requested, array_keys( $updates ) );
        } else {
            return new WP_REST_Response( [
                'error' => 'Provide "themes" array or "all": true.',
            ], 400 );
        }

        if ( empty( $to_update ) ) {
            return new WP_REST_Response( [
                'updated' => 0,
                'failed'  => 0,
                'results' => [],
                'message' => 'No themes need updating.',
            ], 200 );
        }

        $skin     = new Automatic_Upgrader_Skin();
        $upgrader = new Theme_Upgrader( $skin );
        $results  = [];
        $updated  = 0;
        $failed   = 0;

        foreach ( $to_update as $theme_slug ) {
            $theme  = wp_get_theme( $theme_slug );
            $name   = $theme->exists() ? $theme->get( 'Name' ) : $theme_slug;
            $result = $upgrader->upgrade( $theme_slug );

            if ( $result === true || ! is_wp_error( $result ) ) {
                $new_theme = wp_get_theme( $theme_slug );
                $results[] = [
                    'slug'        => $theme_slug,
                    'name'        => $name,
                    'success'     => true,
                    'new_version' => $new_theme->get( 'Version' ),
                ];
                $updated++;
            } else {
                $error_msg = is_wp_error( $result ) ? $result->get_error_message() : 'Unknown error';
                $results[] = [
                    'slug'    => $theme_slug,
                    'name'    => $name,
                    'success' => false,
                    'error'   => $error_msg,
                ];
                $failed++;
            }
        }

        delete_site_transient( 'update_themes' );

        return new WP_REST_Response( [
            'updated' => $updated,
            'failed'  => $failed,
            'results' => $results,
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
