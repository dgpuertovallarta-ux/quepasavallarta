<?php
/**
 * Formularios del sitio (antes /api/denuncia, /api/lead, /api/track):
 *  - Reporte ciudadano con foto → entra como BORRADOR "Pendiente" (nunca se publica solo).
 *    El nombre, contacto y ubicación exacta del lector se guardan aparte, solo para el equipo.
 *  - Vallarta Conecta (prospectos de publicidad) → "Prospectos" en el panel + correo al admin.
 *  - Boletín → lista de correos en el panel.
 *  - Conteo de visitas privado.
 */
if (!defined('ABSPATH')) exit;

const QPV_TIPOS_REPORTE = [
    'bache' => 'Bache o calle dañada', 'basura' => 'Basura', 'agua' => 'Agua o drenaje', 'luz' => 'Alumbrado o luz',
    'transito' => 'Tráfico o vialidad', 'seguridad' => 'Inseguridad', 'abuso' => 'Abuso en vía pública', 'otro' => 'Otro',
];

function qpv_limpio($v, int $max): string
{
    return is_string($v) ? mb_substr(trim(preg_replace('/\s+\n/', "\n", wp_unslash($v))), 0, $max) : '';
}

/** Límite sencillo por IP para que no llenen el panel de basura. */
function qpv_limite(string $que, int $max, int $seg): bool
{
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0';
    $k = 'qpv_lim_' . $que . '_' . md5(explode(',', $ip)[0]);
    $n = (int) get_transient($k);
    if ($n >= $max) return false;
    set_transient($k, $n + 1, $seg);
    return true;
}

add_action('rest_api_init', function () {
    register_rest_route('qpv/v1', '/reporte', ['methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => 'qpv_rest_reporte']);
    register_rest_route('qpv/v1', '/lead', ['methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => 'qpv_rest_lead']);
    register_rest_route('qpv/v1', '/boletin', ['methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => 'qpv_rest_boletin']);
    register_rest_route('qpv/v1', '/track', ['methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => 'qpv_rest_track']);
});

function qpv_rest_reporte(WP_REST_Request $r)
{
    $p = $r->get_params();
    if (qpv_limpio($p['web'] ?? '', 200)) return ['ok' => true]; // trampa para robots
    if (!qpv_limite('rep', 5, HOUR_IN_SECONDS)) return new WP_REST_Response(['error' => 'Mandaste varios reportes seguidos. Intenta en un rato.'], 429);
    $lugar = qpv_limpio($p['lugar'] ?? '', 140);
    $texto = qpv_limpio($p['texto'] ?? '', 3000);
    $titulo = qpv_limpio($p['titulo'] ?? '', 110);
    $contacto = qpv_limpio($p['contacto'] ?? '', 140);
    $nombre = qpv_limpio($p['nombre'] ?? '', 80);
    $tipo = QPV_TIPOS_REPORTE[qpv_limpio($p['tipo'] ?? '', 20)] ?? QPV_TIPOS_REPORTE['otro'];
    $lat = (float) ($p['lat'] ?? 0);
    $lon = (float) ($p['lon'] ?? 0);
    $mapa = ($lat && abs($lat) <= 90 && abs($lon) <= 180) ? sprintf('https://maps.google.com/?q=%.5f,%.5f', $lat, $lon) : '';
    if (mb_strlen($lugar) < 4) return new WP_REST_Response(['error' => 'Escribe dónde pasa (colonia, calle o punto de referencia).'], 400);
    if (mb_strlen($texto) < 40) return new WP_REST_Response(['error' => 'Cuéntanos un poco más: al menos un par de líneas sobre qué pasa.'], 400);

    $files = $r->get_file_params();
    $foto = $files['foto'] ?? null;
    if ($foto && !empty($foto['tmp_name'])) {
        $tipoMime = wp_check_filetype_and_ext($foto['tmp_name'], $foto['name']);
        if (!in_array($tipoMime['type'], ['image/jpeg', 'image/png', 'image/webp'], true)) return new WP_REST_Response(['error' => 'La foto debe ser JPG, PNG o WEBP.'], 400);
        if ($foto['size'] > 8 * 1024 * 1024) return new WP_REST_Response(['error' => 'La foto pesa más de 8 MB; manda una más ligera.'], 400);
    }

    $parrafos = array_values(array_filter(array_map('trim', preg_split('/\n+/', $texto))));
    $cap = fn($t) => mb_strtoupper(mb_substr($t, 0, 1)) . mb_substr($t, 1);
    $tituloFinal = mb_substr('Reporte ciudadano: ' . $cap($titulo ?: 'vecinos reportan ' . mb_strtolower($tipo) . " en $lugar"), 0, 140);
    $cuerpo = '<p>' . esc_html("Un lector de Qué Pasa Vallarta envió el siguiente reporte (" . mb_strtolower($tipo) . ") sobre una situación en $lugar:") . '</p>';
    foreach ($parrafos as $x) $cuerpo .= '<p>«' . esc_html(str_replace(['«', '»', '"'], '', $x)) . '»</p>';
    $cuerpo .= '<p>' . esc_html("Ubicación reportada: $lugar.") . '</p>';
    $cuerpo .= '<p>Este es un reporte ciudadano. Qué Pasa Vallarta lo publica para dar voz a los vecinos y buscará la postura de las autoridades correspondientes. ¿Viste algo en tu colonia? Mándanos tu reporte con foto en quepasavta.com/reporte.</p>';

    $cat = get_term_by('slug', 'comunidad', 'category');
    $id = wp_insert_post([
        'post_type' => 'post', 'post_status' => 'pending', 'post_title' => $tituloFinal,
        'post_excerpt' => mb_substr($parrafos[0], 0, 220), 'post_content' => $cuerpo,
        'post_category' => $cat ? [$cat->term_id] : [],
    ], true);
    if (is_wp_error($id)) return new WP_REST_Response(['error' => 'No se pudo enviar. Intenta de nuevo en unos minutos.'], 500);

    update_post_meta($id, 'qpv_score', 55);
    update_post_meta($id, 'qpv_author', 'redaccion');
    update_post_meta($id, 'qpv_es_reporte', 1);
    // Datos privados del lector: solo los ve el equipo en el panel.
    update_post_meta($id, '_qpv_reporte_privado', ['nombre' => $nombre, 'contacto' => $contacto, 'lugar' => $lugar, 'tipo' => $tipo, 'mapa' => $mapa, 'recibida' => current_time('c')]);

    if ($foto && !empty($foto['tmp_name'])) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        $att = media_handle_upload('foto', $id, ['post_title' => 'Reporte ciudadano']);
        if (!is_wp_error($att)) {
            set_post_thumbnail($id, $att);
            update_post_meta($id, 'qpv_image_url', wp_get_attachment_image_url($att, 'large'));
            update_post_meta($id, 'qpv_image_credit', 'Reporte ciudadano');
        }
    }
    // Aviso por correo al equipo.
    wp_mail(get_option('admin_email'), "Nuevo reporte ciudadano: $tipo en $lugar",
        "$tituloFinal\n\n" . implode("\n", $parrafos) . "\n\nRevisar y aprobar: " . admin_url("post.php?post=$id&action=edit") . ($mapa ? "\nMapa: $mapa" : ''));
    return ['ok' => true];
}

/* Datos privados del reporte dentro de la nota, en el panel. */
add_action('add_meta_boxes', function () {
    add_meta_box('qpv_reporte_privado', 'Datos privados del lector (no se publican)', function ($post) {
        $d = get_post_meta($post->ID, '_qpv_reporte_privado', true);
        if (!$d) { echo '<p>Esta nota no es un reporte ciudadano.</p>'; return; }
        echo '<p><strong>Tipo:</strong> ' . esc_html($d['tipo'] ?? '') . '<br><strong>Lugar:</strong> ' . esc_html($d['lugar'] ?? '') . '</p>';
        echo '<p><strong>Nombre:</strong> ' . esc_html($d['nombre'] ?: '—') . '<br><strong>Contacto:</strong> ' . esc_html($d['contacto'] ?: '—') . '</p>';
        if (!empty($d['mapa'])) echo '<p><a href="' . esc_url($d['mapa']) . '" target="_blank" rel="noopener">Ver ubicación en el mapa</a></p>';
    }, 'post', 'side', 'high');
});

/* Reportes pendientes: atajo en el menú del panel. */
add_action('admin_menu', function () {
    $n = (int) (new WP_Query(['post_type' => 'post', 'post_status' => 'pending', 'meta_key' => 'qpv_es_reporte', 'fields' => 'ids', 'posts_per_page' => 50]))->post_count;
    add_menu_page('Reportes ciudadanos', 'Reportes' . ($n ? " <span class='awaiting-mod'>$n</span>" : ''), 'edit_posts',
        'edit.php?post_status=pending&meta_key=qpv_es_reporte', '', 'dashicons-camera', 4);
});
add_action('pre_get_posts', function ($q) {
    if (is_admin() && $q->is_main_query() && ($_GET['meta_key'] ?? '') === 'qpv_es_reporte') {
        $q->set('meta_key', 'qpv_es_reporte');
    }
});

/* ---------- Prospectos de Vallarta Conecta ---------- */
add_action('init', function () {
    register_post_type('qpv_lead', [
        'label' => 'Prospectos', 'labels' => ['name' => 'Prospectos', 'singular_name' => 'Prospecto'],
        'public' => false, 'show_ui' => true, 'menu_icon' => 'dashicons-businessman', 'supports' => ['title', 'editor'],
        'capabilities' => ['create_posts' => 'do_not_allow'], 'map_meta_cap' => true,
    ]);
});

function qpv_rest_lead(WP_REST_Request $r)
{
    $p = $r->get_params();
    if (qpv_limpio($p['website'] ?? '', 200)) return ['ok' => true];
    if (!qpv_limite('lead', 5, HOUR_IN_SECONDS)) return new WP_REST_Response(['error' => 'Intenta en un rato.'], 429);
    $negocio = qpv_limpio($p['business'] ?? '', 160);
    $contacto = qpv_limpio($p['contact'] ?? '', 160);
    $msg = qpv_limpio($p['message'] ?? '', 2000);
    if (mb_strlen($negocio) < 2 || mb_strlen($contacto) < 6) return new WP_REST_Response(['error' => 'Escribe el nombre del negocio y un WhatsApp o correo.'], 400);
    wp_insert_post(['post_type' => 'qpv_lead', 'post_status' => 'private', 'post_title' => "$negocio — $contacto", 'post_content' => $msg]);
    wp_mail(get_option('admin_email'), "Nuevo prospecto Vallarta Conecta: $negocio", "Negocio: $negocio\nContacto: $contacto\n\n$msg");
    return ['ok' => true];
}

/* ---------- Boletín ---------- */
function qpv_rest_boletin(WP_REST_Request $r)
{
    $p = $r->get_params();
    if (qpv_limpio($p['sitio_web'] ?? '', 200)) return ['ok' => true];
    $email = sanitize_email($p['email'] ?? '');
    if (!is_email($email)) return new WP_REST_Response(['ok' => false, 'error' => 'Correo no válido.'], 400);
    if (!qpv_limite('bol', 5, HOUR_IN_SECONDS)) return new WP_REST_Response(['ok' => false], 429);
    $lista = get_option('qpv_boletin', []);
    if (!is_array($lista)) $lista = [];
    $lista[strtolower($email)] = current_time('c');
    update_option('qpv_boletin', $lista, false);
    return ['ok' => true];
}

add_action('admin_menu', function () {
    add_submenu_page('tools.php', 'Boletín', 'Boletín (correos)', 'edit_posts', 'qpv-boletin', function () {
        $l = get_option('qpv_boletin', []);
        echo '<div class="wrap"><h1>Suscriptores del boletín</h1><p>' . count((array) $l) . ' correos.</p><textarea readonly style="width:100%;height:400px">';
        foreach ((array) $l as $e => $f) echo esc_textarea("$e,$f\n");
        echo '</textarea></div>';
    });
});

/* ---------- Conteo de visitas (privado) ---------- */
function qpv_tabla_vistas(): string { global $wpdb; return $wpdb->prefix . 'qpv_vistas'; }

add_action('after_switch_theme', function () {
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta('CREATE TABLE ' . qpv_tabla_vistas() . " (
        dia date NOT NULL,
        ruta varchar(191) NOT NULL,
        vid varchar(40) NOT NULL,
        vistas int unsigned NOT NULL DEFAULT 1,
        PRIMARY KEY  (dia, ruta, vid)
    ) " . $wpdb->get_charset_collate() . ';');
});

function qpv_rest_track(WP_REST_Request $r)
{
    global $wpdb;
    $d = json_decode($r->get_body(), true);
    $ruta = mb_substr((string) ($d['path'] ?? ''), 0, 190);
    $vid = preg_replace('/[^a-z0-9]/', '', (string) ($d['vid'] ?? '')) ?: 'anon';
    if (!$ruta || str_starts_with($ruta, '/wp-')) return ['ok' => true];
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    if (preg_match('/bot|crawl|spider|preview|facebookexternalhit/i', $ua)) return ['ok' => true];
    $wpdb->query($wpdb->prepare('INSERT INTO ' . qpv_tabla_vistas() . ' (dia, ruta, vid) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE vistas = vistas + 1',
        wp_date('Y-m-d', null, new DateTimeZone(QPV_TZ)), $ruta, mb_substr($vid, 0, 40)));
    return ['ok' => true];
}

add_action('wp_enqueue_scripts', function () {
    wp_add_inline_script('qpv', 'window.QPV=' . wp_json_encode(['track' => rest_url('qpv/v1/track')]) . ';', 'before');
}, 30);

/* Estadísticas en el panel */
add_action('admin_menu', function () {
    add_menu_page('Estadísticas', 'Estadísticas', 'edit_posts', 'qpv-estadisticas', function () {
        global $wpdb;
        $t = qpv_tabla_vistas();
        $dias = $wpdb->get_results("SELECT dia, SUM(vistas) v, COUNT(DISTINCT vid) u FROM $t WHERE dia >= CURDATE() - INTERVAL 30 DAY GROUP BY dia ORDER BY dia DESC");
        $top = $wpdb->get_results("SELECT ruta, SUM(vistas) v FROM $t WHERE dia >= CURDATE() - INTERVAL 7 DAY GROUP BY ruta ORDER BY v DESC LIMIT 25");
        echo '<div class="wrap"><h1>Visitas al sitio</h1><div style="display:flex;gap:40px;flex-wrap:wrap"><div><h2>Últimos 30 días</h2><table class="widefat striped" style="width:auto"><tr><th>Día</th><th>Vistas</th><th>Visitantes</th></tr>';
        foreach ($dias as $d) echo '<tr><td>' . esc_html($d->dia) . '</td><td>' . (int) $d->v . '</td><td>' . (int) $d->u . '</td></tr>';
        echo '</table></div><div><h2>Lo más visto (7 días)</h2><table class="widefat striped" style="width:auto"><tr><th>Página</th><th>Vistas</th></tr>';
        foreach ($top as $x) echo '<tr><td><a href="' . esc_url(home_url($x->ruta)) . '" target="_blank">' . esc_html($x->ruta) . '</a></td><td>' . (int) $x->v . '</td></tr>';
        echo '</table></div></div></div>';
    }, 'dashicons-chart-bar', 3);
});
