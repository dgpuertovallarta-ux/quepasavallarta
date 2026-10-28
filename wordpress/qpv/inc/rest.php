<?php
/**
 * API para el "robot" (GitHub Actions) — reemplaza a Netlify Blobs y a las rutas /api del sitio anterior.
 *
 *  GET/PUT/DELETE /wp-json/qpv/v1/kv/{almacen}/{clave}   guardar estado (cola de Facebook, tráfico, etc.)
 *  GET            /wp-json/qpv/v1/kv/{almacen}?prefijo=   listar claves
 *  GET            /wp-json/qpv/v1/patrocinio?seccion=     patrocinador vigente (público)
 *  GET            /wp-json/qpv/v1/estado                  prueba de conexión del robot
 *
 * El robot entra con una "contraseña de aplicación" de WordPress (Usuarios → Perfil),
 * guardada como secreto en GitHub; nunca va en el código.
 * Para publicar notas usa la API nativa: /wp-json/wp/v2/posts y /wp-json/wp/v2/media.
 */
if (!defined('ABSPATH')) exit;

function qpv_tabla_kv(): string { global $wpdb; return $wpdb->prefix . 'qpv_kv'; }

add_action('after_switch_theme', function () {
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta('CREATE TABLE ' . qpv_tabla_kv() . " (
        almacen varchar(64) NOT NULL,
        clave varchar(191) NOT NULL,
        valor longtext NOT NULL,
        actualizado datetime NOT NULL,
        PRIMARY KEY  (almacen, clave),
        KEY actualizado (actualizado)
    ) " . $wpdb->get_charset_collate() . ';');
});

function qpv_kv_get(string $almacen, string $clave)
{
    global $wpdb;
    $v = $wpdb->get_var($wpdb->prepare('SELECT valor FROM ' . qpv_tabla_kv() . ' WHERE almacen = %s AND clave = %s', $almacen, $clave));
    return $v === null ? null : json_decode($v, true);
}

function qpv_kv_set(string $almacen, string $clave, $valor): void
{
    global $wpdb;
    $wpdb->replace(qpv_tabla_kv(), ['almacen' => $almacen, 'clave' => $clave, 'valor' => wp_json_encode($valor, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'actualizado' => current_time('mysql', true)]);
}

$puede = fn() => current_user_can('edit_others_posts');

add_action('rest_api_init', function () use ($puede) {
    $ok = '.+';
    register_rest_route('qpv/v1', '/kv/(?P<almacen>[a-z0-9-]+)/(?P<clave>' . $ok . ')', [
        ['methods' => 'GET', 'permission_callback' => $puede, 'callback' => function ($r) {
            $v = qpv_kv_get($r['almacen'], $r['clave']);
            return $v === null ? new WP_REST_Response(null, 404) : $v;
        }],
        ['methods' => 'PUT,POST', 'permission_callback' => $puede, 'callback' => function ($r) {
            $v = json_decode($r->get_body(), true);
            if ($v === null && trim($r->get_body()) !== 'null') return new WP_REST_Response(['error' => 'JSON inválido'], 400);
            qpv_kv_set($r['almacen'], $r['clave'], $v);
            return ['ok' => true];
        }],
        ['methods' => 'DELETE', 'permission_callback' => $puede, 'callback' => function ($r) {
            global $wpdb;
            $wpdb->delete(qpv_tabla_kv(), ['almacen' => $r['almacen'], 'clave' => $r['clave']]);
            return ['ok' => true];
        }],
    ]);
    register_rest_route('qpv/v1', '/kv/(?P<almacen>[a-z0-9-]+)', ['methods' => 'GET', 'permission_callback' => $puede, 'callback' => function ($r) {
        global $wpdb;
        $pre = (string) ($r['prefijo'] ?? '');
        $filas = $wpdb->get_col($wpdb->prepare('SELECT clave FROM ' . qpv_tabla_kv() . ' WHERE almacen = %s AND clave LIKE %s ORDER BY clave LIMIT 2000', $r['almacen'], $wpdb->esc_like($pre) . '%'));
        return ['claves' => $filas];
    }]);
    register_rest_route('qpv/v1', '/patrocinio', ['methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => function ($r) {
        $s = sanitize_key($r['seccion'] ?? '');
        $p = $s ? qpv_patrocinio($s) : null;
        return $p ? ['nombre' => $p['nombre'], 'logo' => $p['logo'], 'id' => $p['id']] : null;
    }]);
    register_rest_route('qpv/v1', '/estado', ['methods' => 'GET', 'permission_callback' => $puede, 'callback' => fn() => [
        'ok' => true, 'tema' => QPV_VER, 'hora' => current_time('c'), 'notas' => (int) wp_count_posts('post')->publish,
    ]]);
    // Reels de Facebook para la portada (los manda el robot).
    register_rest_route('qpv/v1', '/reels', ['methods' => 'PUT,POST', 'permission_callback' => $puede, 'callback' => function ($r) {
        $v = json_decode($r->get_body(), true);
        update_option('qpv_reels', is_array($v) ? array_slice($v, 0, 30) : [], false);
        return ['ok' => true];
    }]);
});

/* El robot busca notas por su slug anterior o por la clave del hecho. */
$qpv_filtro_meta = function ($args, $req) {
    foreach (['qpv_original_slug', 'qpv_story_key'] as $k) {
        if (!empty($req[$k])) $args['meta_query'][] = ['key' => $k, 'value' => sanitize_text_field($req[$k])];
    }
    return $args;
};
add_filter('rest_post_query', $qpv_filtro_meta, 10, 2);
add_filter('rest_explica_query', $qpv_filtro_meta, 10, 2);
