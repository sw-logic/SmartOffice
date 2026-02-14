<?php
/**
 * SmartOffice Connector — GitHub self-updater.
 *
 * Checks a private GitHub repository for new releases and integrates
 * with WordPress's native update system for one-click updates.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class SmartOffice_Updater {

    /** Plugin basename, e.g. "smartoffice-connector/smartoffice-connector.php". */
    private static $plugin_basename;

    /** Plugin slug. */
    private static $slug = 'smartoffice-connector';

    /** Transient key for cached release data. */
    private static $cache_key = 'smartoffice_github_update';

    /** Cache lifetime in seconds (12 hours). */
    private static $cache_ttl = 43200;

    /** Last error message from fetch_release(). */
    private static $last_error = '';

    /**
     * Register WordPress filters for the update system.
     */
    public static function init() {
        // Kill switch — define SMARTOFFICE_DISABLE_UPDATER in wp-config.php to disable.
        if ( defined( 'SMARTOFFICE_DISABLE_UPDATER' ) && SMARTOFFICE_DISABLE_UPDATER ) {
            return;
        }

        self::$plugin_basename = plugin_basename( SMARTOFFICE_CONNECTOR_FILE );

        add_filter( 'pre_set_site_transient_update_plugins', [ __CLASS__, 'check_for_update' ] );
        add_filter( 'plugins_api', [ __CLASS__, 'plugin_info' ], 20, 3 );
        add_filter( 'upgrader_post_install', [ __CLASS__, 'post_install' ], 10, 3 );

        // Inject auth header for GitHub downloads.
        add_filter( 'http_request_args', [ __CLASS__, 'inject_auth_header' ], 10, 2 );
    }

    /**
     * Inject update info into the transient when WordPress checks for plugin updates.
     *
     * @param object $transient The update_plugins transient.
     * @return object
     */
    public static function check_for_update( $transient ) {
        if ( empty( $transient->checked ) ) {
            return $transient;
        }

        $release = self::fetch_release();
        if ( ! $release ) {
            return $transient;
        }

        $remote_version = ltrim( $release['tag_name'], 'v' );
        $current_version = SMARTOFFICE_CONNECTOR_VERSION;

        if ( ! version_compare( $remote_version, $current_version, '>' ) ) {
            // No update available — report as "no_update" so WP knows we checked.
            $transient->no_update[ self::$plugin_basename ] = (object) [
                'id'            => self::$plugin_basename,
                'slug'          => self::$slug,
                'plugin'        => self::$plugin_basename,
                'new_version'   => $current_version,
                'url'           => $release['html_url'] ?? '',
                'package'       => '',
            ];
            return $transient;
        }

        $download_url = self::get_download_url( $release );
        if ( ! $download_url ) {
            return $transient;
        }

        $transient->response[ self::$plugin_basename ] = (object) [
            'id'            => self::$plugin_basename,
            'slug'          => self::$slug,
            'plugin'        => self::$plugin_basename,
            'new_version'   => $remote_version,
            'url'           => $release['html_url'] ?? '',
            'package'       => $download_url,
            'icons'         => [],
            'banners'       => [],
            'requires'      => '5.6',
            'requires_php'  => '7.4',
            'tested'        => '',
        ];

        return $transient;
    }

    /**
     * Provide plugin details for the "View details" modal in WP Admin.
     *
     * @param false|object $result
     * @param string       $action
     * @param object       $args
     * @return false|object
     */
    public static function plugin_info( $result, $action, $args ) {
        if ( 'plugin_information' !== $action ) {
            return $result;
        }

        if ( ! isset( $args->slug ) || $args->slug !== self::$slug ) {
            return $result;
        }

        $release = self::fetch_release();
        if ( ! $release ) {
            return $result;
        }

        $remote_version = ltrim( $release['tag_name'], 'v' );
        $download_url   = self::get_download_url( $release );

        $info = new stdClass();
        $info->name           = 'SmartOffice Connector';
        $info->slug           = self::$slug;
        $info->version        = $remote_version;
        $info->author         = '<a href="https://github.com/' . esc_attr( self::get_repo() ) . '">SmartOffice</a>';
        $info->homepage       = $release['html_url'] ?? '';
        $info->requires       = '5.6';
        $info->requires_php   = '7.4';
        $info->tested         = '';
        $info->download_link  = $download_url;
        $info->trunk          = $download_url;
        $info->last_updated   = $release['published_at'] ?? '';

        // Release body as changelog (rendered from markdown by GitHub).
        $info->sections = [
            'changelog'   => ! empty( $release['body'] )
                ? '<pre>' . esc_html( $release['body'] ) . '</pre>'
                : '<p>No changelog provided.</p>',
            'description' => 'Connects WordPress sites to SmartOffice for remote monitoring, health checks, and secure auto-login.',
        ];

        return $info;
    }

    /**
     * After ZIP extraction, rename the directory to "smartoffice-connector" and re-activate.
     *
     * GitHub ZIPs extract as "{repo}-{hash}/" which breaks the plugin path.
     *
     * @param array $response   Install response.
     * @param array $hook_extra Extra args from the upgrader.
     * @param array $result     Install result with destination paths.
     * @return array
     */
    public static function post_install( $response, $hook_extra, $result ) {
        // Only act on our plugin.
        if ( ! isset( $hook_extra['plugin'] ) || $hook_extra['plugin'] !== self::$plugin_basename ) {
            return $result;
        }

        global $wp_filesystem;

        $install_dir = $result['destination'];
        $plugins_dir = WP_PLUGIN_DIR . '/' . self::$slug;

        // If the extracted dir is not already correct, rename it.
        if ( $install_dir !== $plugins_dir ) {
            $wp_filesystem->move( $install_dir, $plugins_dir );
            $result['destination']     = $plugins_dir;
            $result['destination_name'] = self::$slug;
        }

        // Re-activate the plugin.
        $activate = activate_plugin( self::$plugin_basename );
        if ( is_wp_error( $activate ) ) {
            error_log( 'SmartOffice Updater: Failed to re-activate plugin after update: ' . $activate->get_error_message() );
        }

        return $result;
    }

    /**
     * Add Authorization header for GitHub API requests.
     *
     * For asset downloads, sets Accept: application/octet-stream which triggers
     * a 302 redirect to a pre-signed S3 URL (no auth needed for the redirect target).
     *
     * @param array  $args HTTP request args.
     * @param string $url  Request URL.
     * @return array
     */
    public static function inject_auth_header( $args, $url ) {
        // Only intercept GitHub API requests — browser URLs don't support Bearer auth.
        if ( strpos( $url, 'api.github.com' ) === false ) {
            return $args;
        }

        $repo = self::get_repo();
        if ( ! $repo || strpos( $url, $repo ) === false ) {
            return $args;
        }

        $pat = self::get_pat();
        if ( ! $pat ) {
            return $args;
        }

        $args['headers']['Authorization'] = 'Bearer ' . $pat;
        // Asset downloads: octet-stream triggers 302 to pre-signed S3 URL
        if ( strpos( $url, '/assets/' ) !== false ) {
            $args['headers']['Accept'] = 'application/octet-stream';
        }

        return $args;
    }

    /**
     * Fetch the latest GitHub release (cached).
     *
     * @param bool $force_refresh Skip cache and fetch fresh data.
     * @return array|false Release data or false on failure.
     */
    /**
     * Get the last error message from fetch_release().
     *
     * @return string
     */
    public static function get_last_error(): string {
        return self::$last_error;
    }

    public static function fetch_release( $force_refresh = false ) {
        self::$last_error = '';
        $repo = self::get_repo();
        $pat  = self::get_pat();

        if ( ! $repo || ! $pat ) {
            self::$last_error = 'GitHub repository or access token is not configured.';
            return false;
        }

        // Check transient cache.
        if ( ! $force_refresh ) {
            $cached = get_transient( self::$cache_key );
            if ( false !== $cached ) {
                return $cached;
            }
        }

        $url = 'https://api.github.com/repos/' . $repo . '/releases/latest';

        $response = wp_remote_get( $url, [
            'timeout' => 15,
            'headers' => [
                'Authorization' => 'Bearer ' . $pat,
                'Accept'        => 'application/vnd.github.v3+json',
                'User-Agent'    => 'SmartOffice-Connector/' . SMARTOFFICE_CONNECTOR_VERSION,
            ],
        ] );

        if ( is_wp_error( $response ) ) {
            self::$last_error = 'Network error: ' . $response->get_error_message();
            error_log( 'SmartOffice Updater: GitHub API error — ' . $response->get_error_message() );
            return false;
        }

        $code = wp_remote_retrieve_response_code( $response );
        if ( 200 !== $code ) {
            $body_text = wp_remote_retrieve_body( $response );
            $body_json = json_decode( $body_text, true );
            $detail    = $body_json['message'] ?? substr( $body_text, 0, 200 );
            self::$last_error = "GitHub API returned HTTP {$code}: {$detail}";
            error_log( 'SmartOffice Updater: GitHub API returned HTTP ' . $code . ' — ' . $detail );
            return false;
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( ! is_array( $body ) || empty( $body['tag_name'] ) ) {
            self::$last_error = 'Invalid response from GitHub API (no tag_name found).';
            error_log( 'SmartOffice Updater: Invalid response from GitHub API.' );
            return false;
        }

        // Store only the fields we need.
        $data = [
            'tag_name'     => $body['tag_name'],
            'html_url'     => $body['html_url'] ?? '',
            'body'         => $body['body'] ?? '',
            'published_at' => $body['published_at'] ?? '',
            'zipball_url'  => $body['zipball_url'] ?? '',
            'assets'       => [],
        ];

        if ( ! empty( $body['assets'] ) && is_array( $body['assets'] ) ) {
            foreach ( $body['assets'] as $asset ) {
                if ( ! empty( $asset['name'] ) && substr( $asset['name'], -4 ) === '.zip' ) {
                    $data['assets'][] = [
                        'name'                 => $asset['name'],
                        'url'                  => $asset['url'] ?? '',
                        'browser_download_url' => $asset['browser_download_url'] ?? '',
                    ];
                }
            }
        }

        set_transient( self::$cache_key, $data, self::$cache_ttl );

        return $data;
    }

    /**
     * Clear the cached release data.
     */
    public static function clear_cache() {
        delete_transient( self::$cache_key );
    }

    /**
     * Determine the download URL for a release.
     *
     * Uses the GitHub API asset URL (not browser_download_url) because private repos
     * require Bearer token auth which only works via the API. The API returns a 302
     * redirect to a pre-signed S3 URL that needs no authentication.
     *
     * @param array $release Release data from fetch_release().
     * @return string|false Download URL or false.
     */
    private static function get_download_url( $release ) {
        $repo = self::get_repo();
        $pat  = self::get_pat();

        if ( ! $repo || ! $pat ) {
            return false;
        }

        // Prefer API URL for .zip asset (works with Bearer auth for private repos).
        // browser_download_url requires cookie-based auth and doesn't work with tokens.
        if ( ! empty( $release['assets'] ) ) {
            if ( ! empty( $release['assets'][0]['url'] ) ) {
                return $release['assets'][0]['url'];
            }
        }

        // Fallback to zipball (also goes through the auth filter).
        if ( ! empty( $release['zipball_url'] ) ) {
            return $release['zipball_url'];
        }

        return false;
    }

    /**
     * Get the configured GitHub repository (owner/repo).
     *
     * @return string|false
     */
    private static function get_repo() {
        $repo = get_option( 'smartoffice_github_repo', '' );
        return ! empty( $repo ) ? $repo : false;
    }

    /**
     * Get the configured GitHub Personal Access Token.
     *
     * @return string|false
     */
    private static function get_pat() {
        $pat = get_option( 'smartoffice_github_pat', '' );
        return ! empty( $pat ) ? $pat : false;
    }
}
