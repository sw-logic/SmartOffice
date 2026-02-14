<?php
/**
 * SmartOffice Connector — Settings page.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class SmartOffice_Settings {

    public static function init() {
        add_action( 'admin_menu', [ __CLASS__, 'add_menu_page' ] );
        add_action( 'admin_init', [ __CLASS__, 'register_settings' ] );
        add_action( 'wp_ajax_smartoffice_clear_update_cache', [ __CLASS__, 'ajax_clear_update_cache' ] );
    }

    /**
     * Add settings page under the Settings menu.
     */
    public static function add_menu_page() {
        add_options_page(
            __( 'SmartOffice Connector', 'smartoffice-connector' ),
            __( 'SmartOffice', 'smartoffice-connector' ),
            'manage_options',
            'smartoffice-connector',
            [ __CLASS__, 'render_page' ]
        );
    }

    /**
     * Register settings fields.
     */
    public static function register_settings() {
        register_setting( 'smartoffice_settings', 'smartoffice_api_key', [
            'sanitize_callback' => 'sanitize_text_field',
        ] );
        register_setting( 'smartoffice_settings', 'smartoffice_admin_user_id', [
            'sanitize_callback' => 'absint',
        ] );
        register_setting( 'smartoffice_settings', 'smartoffice_token_expiry', [
            'sanitize_callback' => 'absint',
        ] );
        register_setting( 'smartoffice_settings', 'smartoffice_ip_binding', [
            'sanitize_callback' => 'sanitize_text_field',
        ] );
        register_setting( 'smartoffice_settings', 'smartoffice_allowed_ips', [
            'sanitize_callback' => 'sanitize_textarea_field',
        ] );
        register_setting( 'smartoffice_settings', 'smartoffice_github_repo', [
            'sanitize_callback' => [ __CLASS__, 'sanitize_github_repo' ],
        ] );
        register_setting( 'smartoffice_settings', 'smartoffice_github_pat', [
            'sanitize_callback' => 'sanitize_text_field',
        ] );

        // Connection Settings section
        add_settings_section(
            'smartoffice_main',
            __( 'Connection Settings', 'smartoffice-connector' ),
            [ __CLASS__, 'section_description' ],
            'smartoffice-connector'
        );

        // Connection fields
        add_settings_field( 'smartoffice_api_key', __( 'API Key', 'smartoffice-connector' ), [ __CLASS__, 'field_api_key' ], 'smartoffice-connector', 'smartoffice_main' );
        add_settings_field( 'smartoffice_admin_user_id', __( 'Login As User', 'smartoffice-connector' ), [ __CLASS__, 'field_admin_user' ], 'smartoffice-connector', 'smartoffice_main' );
        add_settings_field( 'smartoffice_token_expiry', __( 'Token Expiry (seconds)', 'smartoffice-connector' ), [ __CLASS__, 'field_token_expiry' ], 'smartoffice-connector', 'smartoffice_main' );
        add_settings_field( 'smartoffice_ip_binding', __( 'IP Binding', 'smartoffice-connector' ), [ __CLASS__, 'field_ip_binding' ], 'smartoffice-connector', 'smartoffice_main' );
        add_settings_field( 'smartoffice_allowed_ips', __( 'Allowed IPs', 'smartoffice-connector' ), [ __CLASS__, 'field_allowed_ips' ], 'smartoffice-connector', 'smartoffice_main' );

        // Auto-Update section
        add_settings_section(
            'smartoffice_updater',
            __( 'Auto-Update', 'smartoffice-connector' ),
            [ __CLASS__, 'section_updater_description' ],
            'smartoffice-connector'
        );

        add_settings_field( 'smartoffice_github_repo', __( 'GitHub Repository', 'smartoffice-connector' ), [ __CLASS__, 'field_github_repo' ], 'smartoffice-connector', 'smartoffice_updater' );
        add_settings_field( 'smartoffice_github_pat', __( 'GitHub Access Token', 'smartoffice-connector' ), [ __CLASS__, 'field_github_pat' ], 'smartoffice-connector', 'smartoffice_updater' );

        // Clear update cache when repo or PAT changes.
        add_action( 'update_option_smartoffice_github_repo', [ __CLASS__, 'on_updater_settings_change' ] );
        add_action( 'update_option_smartoffice_github_pat', [ __CLASS__, 'on_updater_settings_change' ] );
    }

    public static function section_description() {
        echo '<p>' . esc_html__( 'Configure the connection between this WordPress site and your SmartOffice instance.', 'smartoffice-connector' ) . '</p>';
    }

    public static function section_updater_description() {
        echo '<p>' . esc_html__( 'Enable automatic updates from a private GitHub repository. Requires a Personal Access Token with "contents: read" scope.', 'smartoffice-connector' ) . '</p>';
    }

    public static function field_api_key() {
        $value = get_option( 'smartoffice_api_key', '' );
        echo '<input type="text" name="smartoffice_api_key" value="' . esc_attr( $value ) . '" class="regular-text code" readonly />';
        echo '<button type="button" class="button" onclick="this.previousElementSibling.select(); document.execCommand(\'copy\'); this.textContent=\'Copied!\';">' . esc_html__( 'Copy', 'smartoffice-connector' ) . '</button>';
        echo ' <button type="button" class="button" id="smartoffice-regenerate-key">' . esc_html__( 'Regenerate', 'smartoffice-connector' ) . '</button>';
        echo '<p class="description">' . esc_html__( 'This key authenticates requests from SmartOffice. Keep it secret.', 'smartoffice-connector' ) . '</p>';
        // Inline JS for regenerate
        echo '<script>
            document.getElementById("smartoffice-regenerate-key").addEventListener("click", function() {
                if (!confirm("' . esc_js( __( 'Regenerate API key? You will need to update it in SmartOffice.', 'smartoffice-connector' ) ) . '")) return;
                var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                var key = "";
                var array = new Uint8Array(48);
                crypto.getRandomValues(array);
                for (var i = 0; i < 48; i++) key += chars[array[i] % chars.length];
                document.querySelector("input[name=smartoffice_api_key]").value = key;
                document.querySelector("input[name=smartoffice_api_key]").removeAttribute("readonly");
            });
        </script>';
    }

    public static function field_admin_user() {
        $current = get_option( 'smartoffice_admin_user_id', 1 );
        $admins  = get_users( [ 'role' => 'administrator', 'orderby' => 'display_name' ] );
        echo '<select name="smartoffice_admin_user_id">';
        foreach ( $admins as $admin ) {
            $selected = selected( $current, $admin->ID, false );
            echo '<option value="' . esc_attr( $admin->ID ) . '"' . $selected . '>' . esc_html( $admin->display_name ) . ' (' . esc_html( $admin->user_email ) . ')</option>';
        }
        echo '</select>';
        echo '<p class="description">' . esc_html__( 'The WordPress account used when SmartOffice users auto-login.', 'smartoffice-connector' ) . '</p>';
    }

    public static function field_token_expiry() {
        $value = get_option( 'smartoffice_token_expiry', 30 );
        echo '<input type="number" name="smartoffice_token_expiry" value="' . esc_attr( $value ) . '" min="10" max="120" step="1" class="small-text" /> ';
        echo '<span class="description">' . esc_html__( 'seconds (10-120)', 'smartoffice-connector' ) . '</span>';
    }

    public static function field_ip_binding() {
        $value = get_option( 'smartoffice_ip_binding', 'yes' );
        echo '<label><input type="checkbox" name="smartoffice_ip_binding" value="yes" ' . checked( $value, 'yes', false ) . ' /> ';
        echo esc_html__( 'Require login token to be used from the same IP as the SmartOffice server', 'smartoffice-connector' ) . '</label>';
    }

    public static function field_allowed_ips() {
        $value = get_option( 'smartoffice_allowed_ips', '' );
        echo '<textarea name="smartoffice_allowed_ips" rows="3" class="regular-text code">' . esc_textarea( $value ) . '</textarea>';
        echo '<p class="description">' . esc_html__( 'One IP per line. If empty, all IPs are allowed for API requests. Auto-login IP binding (above) is separate.', 'smartoffice-connector' ) . '</p>';
    }

    public static function field_github_repo() {
        $value = get_option( 'smartoffice_github_repo', '' );
        echo '<input type="text" name="smartoffice_github_repo" value="' . esc_attr( $value ) . '" class="regular-text code" placeholder="owner/repo" />';
        echo '<p class="description">' . esc_html__( 'Format: owner/repo (e.g. your-org/smartoffice-connector). You can also paste the full GitHub URL.', 'smartoffice-connector' ) . '</p>';
    }

    public static function field_github_pat() {
        $value = get_option( 'smartoffice_github_pat', '' );
        echo '<input type="password" name="smartoffice_github_pat" value="' . esc_attr( $value ) . '" class="regular-text code" autocomplete="off" />';
        echo '<p class="description">';
        echo esc_html__( 'Personal Access Token with "contents: read" scope.', 'smartoffice-connector' ) . ' ';
        echo '<a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener">';
        echo esc_html__( 'Create token', 'smartoffice-connector' );
        echo '</a></p>';
    }

    /**
     * Sanitize the GitHub repo field — accept full URL or owner/repo format.
     */
    public static function sanitize_github_repo( $value ) {
        $value = sanitize_text_field( $value );

        // Extract owner/repo from full GitHub URL.
        if ( preg_match( '#github\.com[/:]([^/]+/[^/.\s]+)#', $value, $matches ) ) {
            $value = rtrim( $matches[1], '/' );
            // Strip .git suffix if present.
            $value = preg_replace( '/\.git$/', '', $value );
        }

        // Validate owner/repo format.
        if ( ! empty( $value ) && ! preg_match( '#^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$#', $value ) ) {
            add_settings_error(
                'smartoffice_github_repo',
                'invalid_repo',
                __( 'Invalid GitHub repository format. Use owner/repo (e.g. your-org/smartoffice-connector).', 'smartoffice-connector' )
            );
            return get_option( 'smartoffice_github_repo', '' );
        }

        return $value;
    }

    /**
     * Clear update cache when repo or PAT settings change.
     */
    public static function on_updater_settings_change() {
        SmartOffice_Updater::clear_cache();
    }

    /**
     * AJAX handler: clear update cache and force recheck.
     */
    public static function ajax_clear_update_cache() {
        check_ajax_referer( 'smartoffice_check_updates', '_nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized', 403 );
        }

        SmartOffice_Updater::clear_cache();
        delete_site_transient( 'update_plugins' );

        // Force a fresh fetch so the status card shows current data.
        $release = SmartOffice_Updater::fetch_release( true );

        if ( $release ) {
            $remote_version = ltrim( $release['tag_name'], 'v' );
            wp_send_json_success( [
                'current'   => SMARTOFFICE_CONNECTOR_VERSION,
                'latest'    => $remote_version,
                'has_update' => version_compare( $remote_version, SMARTOFFICE_CONNECTOR_VERSION, '>' ),
            ] );
        } else {
            $error = SmartOffice_Updater::get_last_error();
            wp_send_json_error( $error ?: __( 'Could not reach GitHub. Check your repository and token settings.', 'smartoffice-connector' ) );
        }
    }

    /**
     * Render the settings page.
     */
    public static function render_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>

            <div class="card" style="max-width:600px; margin-bottom:20px; padding:12px 20px;">
                <h3 style="margin-top:0;"><?php esc_html_e( 'Connection Info', 'smartoffice-connector' ); ?></h3>
                <p><strong><?php esc_html_e( 'API URL:', 'smartoffice-connector' ); ?></strong>
                    <code><?php echo esc_url( rest_url( 'smartoffice/v1/' ) ); ?></code>
                </p>
                <p><strong><?php esc_html_e( 'WordPress Version:', 'smartoffice-connector' ); ?></strong>
                    <?php echo esc_html( get_bloginfo( 'version' ) ); ?>
                </p>
                <p><strong><?php esc_html_e( 'PHP Version:', 'smartoffice-connector' ); ?></strong>
                    <?php echo esc_html( phpversion() ); ?>
                </p>
            </div>

            <?php self::render_update_status_card(); ?>

            <form method="post" action="options.php">
                <?php
                settings_fields( 'smartoffice_settings' );
                do_settings_sections( 'smartoffice-connector' );
                submit_button();
                ?>
            </form>

            <div class="card" style="max-width:600px; margin-top:20px; padding:12px 20px;">
                <h3 style="margin-top:0;"><?php esc_html_e( 'Recent Auto-Logins', 'smartoffice-connector' ); ?></h3>
                <?php
                $log = get_option( 'smartoffice_login_log', [] );
                if ( empty( $log ) ) {
                    echo '<p>' . esc_html__( 'No auto-logins recorded yet.', 'smartoffice-connector' ) . '</p>';
                } else {
                    echo '<table class="widefat striped"><thead><tr><th>Time</th><th>Requester</th><th>IP</th></tr></thead><tbody>';
                    foreach ( array_reverse( $log ) as $entry ) {
                        echo '<tr>';
                        echo '<td>' . esc_html( $entry['time'] ?? '-' ) . '</td>';
                        echo '<td>' . esc_html( $entry['requester'] ?? '-' ) . '</td>';
                        echo '<td>' . esc_html( $entry['ip'] ?? '-' ) . '</td>';
                        echo '</tr>';
                    }
                    echo '</tbody></table>';
                }
                ?>
            </div>
        </div>
        <?php
    }

    /**
     * Render the Update Status card between Connection Info and the settings form.
     */
    private static function render_update_status_card() {
        $repo = get_option( 'smartoffice_github_repo', '' );
        $pat  = get_option( 'smartoffice_github_pat', '' );
        $disabled = defined( 'SMARTOFFICE_DISABLE_UPDATER' ) && SMARTOFFICE_DISABLE_UPDATER;
        ?>
        <div class="card" style="max-width:600px; margin-bottom:20px; padding:12px 20px;">
            <h3 style="margin-top:0;"><?php esc_html_e( 'Update Status', 'smartoffice-connector' ); ?></h3>

            <?php if ( $disabled ) : ?>
                <p><span class="dashicons dashicons-dismiss" style="color:#d63638;"></span>
                    <?php esc_html_e( 'Auto-updater is disabled via SMARTOFFICE_DISABLE_UPDATER constant.', 'smartoffice-connector' ); ?>
                </p>
            <?php elseif ( empty( $repo ) || empty( $pat ) ) : ?>
                <p><span class="dashicons dashicons-info" style="color:#dba617;"></span>
                    <?php esc_html_e( 'Auto-updater is not configured. Set the GitHub Repository and Access Token below.', 'smartoffice-connector' ); ?>
                </p>
            <?php else :
                $release = SmartOffice_Updater::fetch_release();
                ?>
                <p><strong><?php esc_html_e( 'Repository:', 'smartoffice-connector' ); ?></strong>
                    <code><?php echo esc_html( $repo ); ?></code>
                </p>
                <p><strong><?php esc_html_e( 'Installed Version:', 'smartoffice-connector' ); ?></strong>
                    <?php echo esc_html( SMARTOFFICE_CONNECTOR_VERSION ); ?>
                </p>

                <?php if ( $release ) :
                    $remote_version = ltrim( $release['tag_name'], 'v' );
                    $has_update = version_compare( $remote_version, SMARTOFFICE_CONNECTOR_VERSION, '>' );
                ?>
                    <p><strong><?php esc_html_e( 'Latest Release:', 'smartoffice-connector' ); ?></strong>
                        <?php echo esc_html( $remote_version ); ?>
                        <?php if ( $has_update ) : ?>
                            <span style="color:#00a32a; font-weight:600;">&mdash; <?php esc_html_e( 'Update available!', 'smartoffice-connector' ); ?></span>
                        <?php else : ?>
                            <span style="color:#50575e;">&mdash; <?php esc_html_e( 'You are up to date.', 'smartoffice-connector' ); ?></span>
                        <?php endif; ?>
                    </p>
                    <?php if ( $has_update ) : ?>
                        <p>
                            <a href="<?php echo esc_url( self_admin_url( 'update-core.php' ) ); ?>" class="button button-primary">
                                <?php esc_html_e( 'Go to Updates', 'smartoffice-connector' ); ?>
                            </a>
                        </p>
                    <?php endif; ?>
                <?php else :
                    $fetch_error = SmartOffice_Updater::get_last_error();
                ?>
                    <p><span class="dashicons dashicons-warning" style="color:#d63638;"></span>
                        <?php esc_html_e( 'Could not fetch release info from GitHub.', 'smartoffice-connector' ); ?>
                    </p>
                    <?php if ( $fetch_error ) : ?>
                        <p><code style="display:block; padding:8px; background:#f0f0f0; word-break:break-all;"><?php echo esc_html( $fetch_error ); ?></code></p>
                    <?php endif; ?>
                <?php endif; ?>

                <p style="margin-bottom:0;">
                    <button type="button" class="button" id="smartoffice-check-updates">
                        <?php esc_html_e( 'Check for Updates Now', 'smartoffice-connector' ); ?>
                    </button>
                    <span id="smartoffice-check-updates-status" style="margin-left:8px;"></span>
                </p>
                <script>
                document.getElementById('smartoffice-check-updates').addEventListener('click', function() {
                    var btn = this;
                    var status = document.getElementById('smartoffice-check-updates-status');
                    btn.disabled = true;
                    status.textContent = '<?php echo esc_js( __( 'Checking...', 'smartoffice-connector' ) ); ?>';

                    var formData = new FormData();
                    formData.append('action', 'smartoffice_clear_update_cache');
                    formData.append('_nonce', '<?php echo esc_js( wp_create_nonce( 'smartoffice_check_updates' ) ); ?>');

                    fetch(ajaxurl, { method: 'POST', body: formData })
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            if (data.success) {
                                location.reload();
                            } else {
                                status.textContent = data.data || '<?php echo esc_js( __( 'Error checking for updates.', 'smartoffice-connector' ) ); ?>';
                                status.style.color = '#d63638';
                                btn.disabled = false;
                            }
                        })
                        .catch(function() {
                            status.textContent = '<?php echo esc_js( __( 'Network error.', 'smartoffice-connector' ) ); ?>';
                            status.style.color = '#d63638';
                            btn.disabled = false;
                        });
                });
                </script>
            <?php endif; ?>
        </div>
        <?php
    }
}
