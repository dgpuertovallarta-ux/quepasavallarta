<?php
/**
 * Anuncios y patrocinios "Presentado por" (antes: panel → Comercial).
 * Cada anuncio es una entrada del tipo "Anuncios" en el panel de WordPress:
 * anunciante (título), espacio, imagen, liga, vigencia y clics.
 */
if (!defined('ABSPATH')) exit;

const QPV_ESPACIOS = [
    'home' => 'Portada (franja ancha)',
    'article' => 'Dentro de las notas',
    'section' => 'Secciones (arriba de la lista)',
    'pat-trafico' => 'Presentado por · QPV al Volante (tráfico)',
    'pat-huracanes' => 'Presentado por · Videos de huracán',
    'pat-clima' => 'Presentado por · Clima',
    'pat-reportes' => 'Presentado por · Reporte Ciudadano',
];

add_action('init', function () {
    register_post_type('qpv_anuncio', [
        'label' => 'Anuncios',
        'labels' => ['name' => 'Anuncios', 'singular_name' => 'Anuncio', 'add_new_item' => 'Nuevo anuncio', 'edit_item' => 'Editar anuncio'],
        'public' => false, 'show_ui' => true, 'show_in_menu' => true, 'menu_icon' => 'dashicons-megaphone',
        'supports' => ['title', 'thumbnail'], 'show_in_rest' => true,
    ]);
    foreach (['qpv_espacio' => 'string', 'qpv_liga' => 'string', 'qpv_imagen' => 'string', 'qpv_vence' => 'string', 'qpv_activo' => 'boolean', 'qpv_clics' => 'integer'] as $k => $t) {
        register_post_meta('qpv_anuncio', $k, ['type' => $t, 'single' => true, 'show_in_rest' => true, 'auth_callback' => fn() => current_user_can('edit_posts')]);
    }
});

/* Formulario del anuncio en el panel */
add_action('add_meta_boxes', function () {
    add_meta_box('qpv_anuncio_datos', 'Datos del anuncio', function ($post) {
        $m = fn($k) => get_post_meta($post->ID, $k, true);
        wp_nonce_field('qpv_anuncio', 'qpv_anuncio_nonce');
        $esp = $m('qpv_espacio') ?: 'home';
        echo '<p><label><strong>Espacio</strong><br><select name="qpv_espacio">';
        foreach (QPV_ESPACIOS as $k => $v) echo '<option value="' . esc_attr($k) . '"' . selected($esp, $k, false) . '>' . esc_html($v) . '</option>';
        echo '</select></label></p>';
        echo '<p><label><strong>Imagen del banner o logo</strong> (URL; o usa "Imagen destacada" a la derecha)<br><input type="url" name="qpv_imagen" value="' . esc_attr($m('qpv_imagen')) . '" style="width:100%"></label></p>';
        echo '<p><label><strong>Liga al hacer clic</strong><br><input type="url" name="qpv_liga" value="' . esc_attr($m('qpv_liga')) . '" style="width:100%" placeholder="https://"></label></p>';
        echo '<p><label><strong>Vence</strong> (opcional)<br><input type="date" name="qpv_vence" value="' . esc_attr($m('qpv_vence')) . '"></label></p>';
        echo '<p><label><input type="checkbox" name="qpv_activo" value="1"' . checked($m('qpv_activo') !== '' ? (bool) $m('qpv_activo') : true, true, false) . '> Activo</label></p>';
        echo '<p>Clics registrados: <strong>' . (int) $m('qpv_clics') . '</strong></p>';
    }, 'qpv_anuncio', 'normal', 'high');
});

add_action('save_post_qpv_anuncio', function ($id) {
    if (!isset($_POST['qpv_anuncio_nonce']) || !wp_verify_nonce($_POST['qpv_anuncio_nonce'], 'qpv_anuncio')) return;
    if (!current_user_can('edit_post', $id)) return;
    $esp = sanitize_key($_POST['qpv_espacio'] ?? 'home');
    update_post_meta($id, 'qpv_espacio', isset(QPV_ESPACIOS[$esp]) ? $esp : 'home');
    update_post_meta($id, 'qpv_imagen', esc_url_raw($_POST['qpv_imagen'] ?? ''));
    update_post_meta($id, 'qpv_liga', esc_url_raw($_POST['qpv_liga'] ?? ''));
    update_post_meta($id, 'qpv_vence', sanitize_text_field($_POST['qpv_vence'] ?? ''));
    update_post_meta($id, 'qpv_activo', !empty($_POST['qpv_activo']));
});

/* Columnas útiles en la lista de anuncios */
add_filter('manage_qpv_anuncio_posts_columns', fn($c) => ['cb' => $c['cb'], 'title' => 'Anunciante', 'espacio' => 'Espacio', 'vence' => 'Vence', 'clics' => 'Clics', 'date' => 'Alta']);
add_action('manage_qpv_anuncio_posts_custom_column', function ($col, $id) {
    if ($col === 'espacio') echo esc_html(QPV_ESPACIOS[get_post_meta($id, 'qpv_espacio', true)] ?? '—') . (get_post_meta($id, 'qpv_activo', true) ? '' : ' <em>(pausado)</em>');
    if ($col === 'vence') echo esc_html(get_post_meta($id, 'qpv_vence', true) ?: 'Sin fecha');
    if ($col === 'clics') echo (int) get_post_meta($id, 'qpv_clics', true);
}, 10, 2);

/** Un anuncio vigente del espacio (al azar si hay varios). */
function qpv_anuncio(string $espacio): ?array
{
    $hoy = wp_date('Y-m-d', null, new DateTimeZone(QPV_TZ));
    $q = get_posts([
        'post_type' => 'qpv_anuncio', 'post_status' => 'publish', 'numberposts' => 20,
        'meta_query' => [['key' => 'qpv_espacio', 'value' => $espacio], ['key' => 'qpv_activo', 'value' => '1']],
    ]);
    $q = array_values(array_filter($q, function ($p) use ($hoy) {
        $v = get_post_meta($p->ID, 'qpv_vence', true);
        return !$v || $v >= $hoy;
    }));
    if (!$q) return null;
    $p = $q[array_rand($q)];
    $img = get_post_meta($p->ID, 'qpv_imagen', true) ?: (string) get_the_post_thumbnail_url($p, 'full');
    if (!$img) return null;
    return ['id' => $p->ID, 'nombre' => $p->post_title, 'imagen' => $img, 'clic' => home_url('/?qpv_ad=' . $p->ID)];
}

/** Patrocinador "Presentado por" de una sección: trafico | clima | reportes | huracanes. */
function qpv_patrocinio(string $seccion): ?array
{
    $a = qpv_anuncio('pat-' . $seccion);
    return $a ? ['id' => $a['id'], 'nombre' => $a['nombre'], 'logo' => $a['imagen'], 'clic' => $a['clic']] : null;
}

/** Banner (equivale a <AdSlot>). Devuelve false si no hay anuncio. */
function qpv_ad_slot(string $espacio): bool
{
    $a = qpv_anuncio($espacio);
    if (!$a) return false;
    echo '<aside class="ad-band ad-slot-' . esc_attr($espacio) . '" aria-label="Publicidad"><div class="container"><div class="ad-label">Publicidad</div>';
    echo '<a href="' . esc_url($a['clic']) . '" rel="sponsored noopener" target="_blank"><img src="' . esc_url($a['imagen']) . '" alt="Publicidad: ' . esc_attr($a['nombre']) . '" loading="lazy"></a></div></aside>';
    return true;
}

/* Clic en un banner: se cuenta y se manda al sitio del anunciante. */
add_action('template_redirect', function () {
    if (empty($_GET['qpv_ad'])) return;
    $id = (int) $_GET['qpv_ad'];
    $p = get_post($id);
    $dest = home_url('/');
    if ($p && $p->post_type === 'qpv_anuncio') {
        update_post_meta($id, 'qpv_clics', (int) get_post_meta($id, 'qpv_clics', true) + 1);
        $l = get_post_meta($id, 'qpv_liga', true);
        if ($l && preg_match('#^https?://#i', $l)) $dest = $l;
    }
    wp_redirect($dest, 302);
    exit;
});
